import { addDays } from '../../shared/discount';
import {
  CURRENCIES,
  type AdminStats,
  type Currency,
  type CustomerSalesRow,
  type ProductSalesRow,
  type SalesSummary,
  type TransactionItem,
} from '../../shared/types';
import { db } from '../db';

interface TxRow {
  id: number;
  user_id: number;
  user_name: string;
  order_date: string;
  currency: Currency;
  amount_cents: number;
  subtotal_cents: number | null;
  discount_rate: number;
  items_json: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const byName = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

/** Customers' transactions (never admins') with order_date in [from, to]. */
function customerTransactions(from: string, to: string): TxRow[] {
  return db
    .prepare(
      `SELECT t.id, t.user_id, u.name AS user_name, t.order_date, t.currency, t.amount_cents,
              t.subtotal_cents, t.discount_rate, t.items_json
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE u.role = 'customer' AND t.order_date >= ? AND t.order_date <= ?
       ORDER BY t.order_date, t.id`,
    )
    .all(from, to) as unknown as TxRow[];
}

/** A gift-box line: flagged explicitly, or (older records) named 礼盒礼袋…. */
const isGiftBox = (it: TransactionItem) => it.giftBox === true || it.name.startsWith('礼盒礼袋');

type RangeStats = Pick<AdminStats, 'summary' | 'products' | 'topCustomers' | 'ordersWithoutItems'>;

/**
 * Statistics for orders dated in [from, to]. `customerLimit` caps each currency's customer
 * ranking (10 on the dashboard; unlimited for the Excel export).
 */
export function rangeStats(from: string, to: string, customerLimit = 10): RangeStats {
  const rows = customerTransactions(from, to);
  const productNames = new Map(
    (db.prepare('SELECT id, name_zh, volume FROM products').all() as { id: number; name_zh: string; volume: string }[]).map(
      (p) => [p.id, [p.name_zh, p.volume].filter(Boolean).join(' ')],
    ),
  );

  const summary = {} as Record<Currency, SalesSummary>;
  const buyers = {} as Record<Currency, Set<number>>;
  for (const c of CURRENCIES) {
    summary[c] = { sales: 0, orders: 0, buyers: 0, avgOrder: 0, discountGiven: 0 };
    buyers[c] = new Set();
  }
  const products = new Map<string, ProductSalesRow>();
  const customers = { CAD: new Map<number, CustomerSalesRow>(), CNY: new Map<number, CustomerSalesRow>() };
  let ordersWithoutItems = 0;

  for (const t of rows) {
    const amount = t.amount_cents / 100;
    const s = summary[t.currency];
    s.sales += amount;
    s.orders += 1;
    if (t.subtotal_cents != null) s.discountGiven += (t.subtotal_cents / 100) * t.discount_rate;
    buyers[t.currency].add(t.user_id);

    const cust = customers[t.currency].get(t.user_id) ?? { id: t.user_id, name: t.user_name, sales: 0, orders: 0 };
    cust.sales += amount;
    cust.orders += 1;
    customers[t.currency].set(t.user_id, cust);

    const items = JSON.parse(t.items_json) as TransactionItem[];
    if (items.length === 0) {
      ordersWithoutItems++;
      continue;
    }
    // Spread the order's actual payment over its lines in proportion to list price,
    // so the product ranking adds up to what customers really paid.
    const listTotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
    const factor = listTotal > 0 ? amount / listTotal : 0;

    for (const it of items) {
      const gift = isGiftBox(it);
      // A line picked from the catalogue keeps its product id. If that product was later
      // deleted it still ranks, under the name saved on the transaction, marked （已删除）.
      const linked = it.productId != null;
      const stillExists = linked && productNames.has(it.productId!);
      const kind: ProductSalesRow['kind'] = gift ? 'giftBox' : linked ? 'product' : 'other';
      const key = kind === 'product' ? `p${it.productId}` : kind; // all gift boxes in one row, all manual lines in one row
      const name =
        kind === 'giftBox'
          ? '礼盒礼袋'
          : kind === 'other'
            ? '其他（手动填写的商品）'
            : stillExists
              ? productNames.get(it.productId!)!
              : `${it.name}（已删除）`;
      const row =
        products.get(key) ??
        ({
          key,
          kind,
          productId: stillExists ? it.productId : null, // no edit link for a deleted product
          name,
          qty: 0,
          sales: { CAD: 0, CNY: 0 },
        } satisfies ProductSalesRow);
      row.qty += it.qty;
      row.sales[t.currency] += it.qty * it.unitPrice * factor;
      products.set(key, row);
    }
  }

  for (const c of CURRENCIES) {
    const s = summary[c];
    s.buyers = buyers[c].size;
    s.sales = round2(s.sales);
    s.discountGiven = round2(s.discountGiven);
    s.avgOrder = s.orders ? round2(s.sales / s.orders) : 0;
  }

  const productList = [...products.values()].map((p) => ({
    ...p,
    sales: { CAD: round2(p.sales.CAD), CNY: round2(p.sales.CNY) },
  }));
  // Wines first by bottles sold; gift boxes and "other" go last.
  const order = { product: 0, giftBox: 1, other: 2 };
  productList.sort((a, b) => order[a.kind] - order[b.kind] || b.qty - a.qty || a.name.localeCompare(b.name));

  const top = (c: Currency) =>
    [...customers[c].values()]
      .map((r) => ({ ...r, sales: round2(r.sales) }))
      // Highest paid first; ties: more orders first, then by name (so the order is always the same).
      .sort((a, b) => b.sales - a.sales || b.orders - a.orders || byName.compare(a.name, b.name))
      .slice(0, customerLimit);

  return {
    summary,
    products: productList,
    topCustomers: { CAD: top('CAD'), CNY: top('CNY') },
    ordersWithoutItems,
  };
}

/** Sales per month for the 12 calendar months ending with the month containing `to`. */
export function monthlySales(to: string): AdminStats['monthly'] {
  const [y, m] = to.split('-').map(Number);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const first = `${months[0]}-01`;
  const lastDay = addDays(`${new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)}-01`, -1);

  const rows = db
    .prepare(
      `SELECT substr(t.order_date, 1, 7) AS month, t.currency, SUM(t.amount_cents) AS cents, COUNT(*) AS n
       FROM transactions t JOIN users u ON u.id = t.user_id
       WHERE u.role = 'customer' AND t.order_date >= ? AND t.order_date <= ?
       GROUP BY month, t.currency`,
    )
    .all(first, lastDay) as { month: string; currency: Currency; cents: number; n: number }[];

  const byMonth = new Map(months.map((mo) => [mo, { month: mo, sales: { CAD: 0, CNY: 0 }, orders: { CAD: 0, CNY: 0 } }]));
  for (const r of rows) {
    const e = byMonth.get(r.month);
    if (!e) continue;
    e.sales[r.currency] = r.cents / 100;
    e.orders[r.currency] = r.n;
  }
  return [...byMonth.values()];
}
