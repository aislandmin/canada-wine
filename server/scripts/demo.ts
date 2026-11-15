// Demo customer with sample transactions, for trying the site out. Remove before going live.
//   npm run demo:add      create (or recreate) the demo customer
//   npm run demo:remove   delete the demo customer and their transactions
//
// Sample lines are linked to the real catalogue products (looked up by catalog number), the
// same way the admin "record transaction" form does it, so 产品排行 shows proper rankings.
import type { TransactionItem } from '../../shared/types';
import { hashPassword } from '../auth';
import { db, migrate, tx } from '../db';
import { createUser } from '../repo/users';
import { seedIfEmpty } from '../seed';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PHONE = '+8613800138000';
const DEMO_PASSWORD = 'demo12345';

/** `no` = catalog number of the wine; `gift` = a 礼盒礼袋 line for that wine. */
type Line = { no: string; qty: number; unitPrice: number; gift?: true };
const SAMPLE: { date: string; currency: 'CAD' | 'CNY'; rate: number; items: Line[]; note: string }[] = [
  {
    date: '2024-03-10', currency: 'CNY', rate: 0, note: '示例：已超出两年统计期',
    items: [{ no: '06', qty: 24, unitPrice: 280 }, { no: '19', qty: 10, unitPrice: 130 }],
  },
  {
    date: '2025-01-20', currency: 'CNY', rate: 0, note: '春节礼品',
    items: [{ no: '15', qty: 30, unitPrice: 260 }, { no: '20', qty: 30, unitPrice: 25, gift: true }, { no: '20', qty: 5, unitPrice: 190 }],
  },
  {
    date: '2025-06-05', currency: 'CAD', rate: 0, note: '',
    items: [{ no: '01', qty: 3, unitPrice: 280 }, { no: '03', qty: 14, unitPrice: 29 }],
  },
  {
    date: '2025-12-18', currency: 'CNY', rate: 0.05, note: '',
    items: [{ no: '06', qty: 24, unitPrice: 280 }],
  },
  {
    date: '2026-04-02', currency: 'CAD', rate: 0, note: '',
    items: [{ no: '14', qty: 12, unitPrice: 45 }, { no: '24', qty: 8, unitPrice: 45 }],
  },
  {
    date: '2026-09-15', currency: 'CNY', rate: 0.1, note: '中秋订单',
    items: [{ no: '15', qty: 30, unitPrice: 260 }, { no: '19', qty: 30, unitPrice: 25, gift: true }],
  },
];

function removeDemo(): boolean {
  const row = db.prepare('SELECT id FROM users WHERE email = ? OR phone = ?').get(DEMO_EMAIL, DEMO_PHONE) as
    | { id: number }
    | undefined;
  if (!row) return false;
  tx(() => {
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(row.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(row.id); // sessions cascade
  });
  return true;
}

/** Turn a sample line into a transaction item linked to the real product (if it exists). */
function toItem(line: Line, products: Map<string, { id: number; label: string; nameZh: string }>): TransactionItem {
  const p = products.get(line.no);
  if (line.gift) {
    return { productId: p?.id ?? null, name: `礼盒礼袋（${p?.nameZh ?? `No.${line.no}`}）`, qty: line.qty, unitPrice: line.unitPrice, giftBox: true };
  }
  return { productId: p?.id ?? null, name: p?.label ?? `No.${line.no}`, qty: line.qty, unitPrice: line.unitPrice };
}

migrate();
const cmd = process.argv[2];

if (cmd === 'remove') {
  console.log(removeDemo() ? '已删除示例客户及其交易记录。' : '没有找到示例客户。');
} else if (cmd === 'add') {
  seedIfEmpty(); // make sure the catalogue exists, so the sample can link to it
  const products = new Map(
    (db.prepare(`SELECT id, catalog_no, name_zh, volume FROM products WHERE catalog_no <> ''`).all() as {
      id: number;
      catalog_no: string;
      name_zh: string;
      volume: string;
    }[]).map((r) => [r.catalog_no, { id: r.id, nameZh: r.name_zh, label: [r.name_zh, r.volume].filter(Boolean).join(' ') }]),
  );
  removeDemo();
  const hash = await hashPassword(DEMO_PASSWORD);
  tx(() => {
    const id = createUser({ name: '示例客户', email: DEMO_EMAIL, phone: DEMO_PHONE, passwordHash: hash, company: '示例公司' });
    const ins = db.prepare(
      `INSERT INTO transactions (user_id, order_date, currency, subtotal_cents, discount_rate, amount_cents, items_json, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const t of SAMPLE) {
      const items = t.items.map((l) => toItem(l, products));
      const subtotal = items.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const amount = Math.round(subtotal * (1 - t.rate) * 100);
      ins.run(id, t.date, t.currency, Math.round(subtotal * 100), t.rate, amount, JSON.stringify(items), t.note);
    }
  });
  const unlinked = SAMPLE.flatMap((t) => t.items).filter((l) => !products.has(l.no));
  console.log('已创建示例客户：');
  console.log(`  手机号 +86 138 0013 8000 或 邮箱 ${DEMO_EMAIL}`);
  console.log(`  密码   ${DEMO_PASSWORD}`);
  if (unlinked.length) console.log(`  提示：编号 ${[...new Set(unlinked.map((l) => l.no))].join('、')} 的产品不存在，这些行未关联产品。`);
} else {
  console.log('用法：npm run demo:add | npm run demo:remove');
  process.exitCode = 1;
}
