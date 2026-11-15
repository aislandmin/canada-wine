import { deservedDiscount, windowStart } from '../../shared/discount';
import type {
  AccountSummary,
  Currency,
  DiscountPreview,
  Transaction,
  TransactionItem,
  TransactionListItem,
  TransactionListResponse,
} from '../../shared/types';
import { db } from '../db';
import { getSettings } from './settings';

interface TransactionRow {
  id: number;
  order_date: string;
  currency: Currency;
  amount_cents: number;
  subtotal_cents: number | null;
  discount_rate: number;
  items_json: string;
  note: string;
}

function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    orderDate: r.order_date,
    currency: r.currency,
    amount: r.amount_cents / 100,
    subtotal: r.subtotal_cents == null ? null : r.subtotal_cents / 100,
    discountRate: r.discount_rate,
    items: JSON.parse(r.items_json) as TransactionItem[],
    note: r.note,
  };
}

export function listUserTransactions(userId: number): Transaction[] {
  const rows = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY order_date DESC, id DESC')
    .all(userId) as unknown as TransactionRow[];
  return rows.map(toTransaction);
}

/**
 * A customer's spending and earned discount as of `asOf` (YYYY-MM-DD).
 * The window is [asOf − N years, asOf], both ends inclusive. Each currency is
 * totalled separately and checked against its own tiers; the better rate wins.
 */
export function accountSummary(userId: number, asOf: string): AccountSummary {
  const { tiers, windowYears } = getSettings();
  const start = windowStart(asOf, windowYears);

  const sums = db
    .prepare(
      `SELECT currency, SUM(amount_cents) AS cents FROM transactions
       WHERE user_id = ? AND order_date >= ? AND order_date <= ?
       GROUP BY currency`,
    )
    .all(userId, start, asOf) as { currency: Currency; cents: number }[];
  const totals = { CAD: 0, CNY: 0 };
  for (const s of sums) totals[s.currency] = s.cents / 100;

  const d = deservedDiscount(totals, tiers);
  const transactions = listUserTransactions(userId).map((t) => ({
    ...t,
    counted: t.orderDate >= start && t.orderDate <= asOf,
  }));

  return {
    asOf,
    windowStart: start,
    windowYears,
    totals,
    discount: {
      rate: d.rate,
      byCurrency: {
        CAD: pick(d.byCurrency.CAD),
        CNY: pick(d.byCurrency.CNY),
      },
    },
    transactions,
  };
}

const pick = (r: { total: number; rate: number; next: { min: number; rate: number } | null; toNext: number }) => ({
  total: r.total,
  rate: r.rate,
  next: r.next,
  toNext: r.toNext,
});

/** Today's date as YYYY-MM-DD in the server's local time zone. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ---------- Admin writes ----------

export interface TransactionWrite {
  orderDate: string;
  currency: Currency;
  items: TransactionItem[];
  subtotal: number | null;
  discountRate: number;
  amount: number;
  note: string;
}

const cents = (n: number) => Math.round(n * 100);

export function createTransaction(userId: number, t: TransactionWrite, createdBy: number): number {
  const r = db
    .prepare(
      `INSERT INTO transactions
         (user_id, order_date, currency, subtotal_cents, discount_rate, amount_cents, items_json, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      t.orderDate,
      t.currency,
      t.subtotal == null ? null : cents(t.subtotal),
      t.discountRate,
      cents(t.amount),
      JSON.stringify(t.items),
      t.note,
      createdBy,
    );
  return Number(r.lastInsertRowid);
}

export function updateTransaction(id: number, t: TransactionWrite): boolean {
  const r = db
    .prepare(
      `UPDATE transactions SET order_date = ?, currency = ?, subtotal_cents = ?, discount_rate = ?, amount_cents = ?,
         items_json = ?, note = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      t.orderDate,
      t.currency,
      t.subtotal == null ? null : cents(t.subtotal),
      t.discountRate,
      cents(t.amount),
      JSON.stringify(t.items),
      t.note,
      id,
    );
  return Number(r.changes) > 0;
}

export function deleteTransaction(id: number): boolean {
  return Number(db.prepare('DELETE FROM transactions WHERE id = ?').run(id).changes) > 0;
}

export function transactionOwner(id: number): number | null {
  const row = db.prepare('SELECT user_id FROM transactions WHERE id = ?').get(id) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

/**
 * The owner's rule: an order's discount is based on what the customer had already paid
 * for orders that ALREADY EXIST in the window ending on the order date — the same window
 * as the account page (two years back to the same day, both ends inclusive). The order
 * itself never counts; earlier orders on the same day do.
 *
 * When editing (`excludeTxId`), that order is left out, and so are same-day orders that
 * were recorded after it (higher id), so the first/second order of a day keep their order.
 */
export function discountPreview(userId: number, orderDate: string, excludeTxId: number | null): DiscountPreview {
  const { windowYears } = getSettings();
  const start = windowStart(orderDate, windowYears);
  const exclude = excludeTxId ?? 0;
  const rows = db
    .prepare(
      `SELECT currency, SUM(amount_cents) AS cents FROM transactions
       WHERE user_id = ? AND order_date >= ? AND order_date <= ? AND id <> ?
         AND NOT (? > 0 AND order_date = ? AND id > ?)
       GROUP BY currency`,
    )
    .all(userId, start, orderDate, exclude, exclude, orderDate, exclude) as { currency: Currency; cents: number }[];
  const priorTotals = { CAD: 0, CNY: 0 };
  for (const r of rows) priorTotals[r.currency] = r.cents / 100;
  return { orderDate, windowStart: start, windowEnd: orderDate, priorTotals };
}

// ---------- All transactions (admin "交易记录" page) ----------

export interface TransactionListFilter {
  from?: string;
  to?: string;
  currency?: Currency;
  /** Matches the customer's name, phone, email, WeChat or company. */
  q?: string;
  page: number;
  pageSize: number;
}


/** Customers' transactions (never admins'), newest first, with filters and paging. */
export function listAllTransactions(f: TransactionListFilter): TransactionListResponse {
  const where = [`u.role = 'customer'`];
  const params: (string | number)[] = [];
  if (f.from) {
    where.push('t.order_date >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('t.order_date <= ?');
    params.push(f.to);
  }
  if (f.currency) {
    where.push('t.currency = ?');
    params.push(f.currency);
  }
  if (f.q) {
    const raw = `%${f.q.replace(/[%_]/g, '')}%`;
    const digits = `%${f.q.replace(/[\s\-()+]/g, '').replace(/[%_]/g, '')}%`;
    where.push('(u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR u.wechat LIKE ? OR u.company LIKE ?)');
    params.push(raw, digits, raw, raw, raw);
  }
  const from = `FROM transactions t JOIN users u ON u.id = t.user_id WHERE ${where.join(' AND ')}`;

  const totals = { CAD: 0, CNY: 0 };
  let count = 0;
  for (const r of db.prepare(`SELECT t.currency, COUNT(*) AS n, SUM(t.amount_cents) AS cents ${from} GROUP BY t.currency`).all(...params) as {
    currency: Currency;
    n: number;
    cents: number;
  }[]) {
    totals[r.currency] = r.cents / 100;
    count += r.n;
  }

  const rows = db
    .prepare(
      `SELECT t.*, u.id AS u_id, u.name AS u_name, u.phone AS u_phone, u.status AS u_status ${from}
       ORDER BY t.order_date DESC, t.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, f.pageSize, (f.page - 1) * f.pageSize) as unknown as (TransactionRow & {
    u_id: number;
    u_name: string;
    u_phone: string | null;
    u_status: 'active' | 'disabled';
  })[];

  return {
    total: count,
    totals,
    page: f.page,
    pageSize: f.pageSize,
    rows: rows.map(
      (r): TransactionListItem => ({ ...toTransaction(r), userId: r.u_id, userName: r.u_name, userPhone: r.u_phone, userStatus: r.u_status }),
    ),
  };
}
