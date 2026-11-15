import { Router, type Response } from 'express';
import { tierFor } from '../../../shared/discount';
import { formatPhone } from '../../../shared/phone';
import { CURRENCIES, type AdminStats, type Currency, type PublicSettings, type Tier, type TransactionItem } from '../../../shared/types';
import { db } from '../../db';
import { HttpError, num, str } from '../../http';
import { getSettings, setSetting } from '../../repo/settings';
import { rangeStats, monthlySales } from '../../repo/stats';
import { isValidDate, today } from '../../repo/transactions';
import { listUsersForAdmin } from '../../repo/users';

export const adminMiscRouter = Router();

// ---------- Settings ----------

adminMiscRouter.get('/settings', (_req, res) => {
  res.json(getSettings());
});

function parseTiers(raw: unknown, currency: Currency): Tier[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) throw new HttpError(400, `${currency} 折扣档位需要 1–10 档`);
  const tiers = raw.map((t, i) => ({
    min: num(t, 'min', { min: 0, max: 100_000_000, label: `${currency} 第 ${i + 1} 档金额` }),
    rate: num(t, 'rate', { min: 0.001, max: 0.9, label: `${currency} 第 ${i + 1} 档折扣` }),
  }));
  tiers.sort((a, b) => a.min - b.min);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].min === tiers[i - 1].min) throw new HttpError(400, `${currency} 折扣档位金额不能重复`);
    if (tiers[i].rate <= tiers[i - 1].rate) throw new HttpError(400, `${currency} 折扣应随金额增加而提高`);
  }
  return tiers;
}

adminMiscRouter.put('/settings', (req, res) => {
  const b = req.body as Record<string, unknown>;
  const highlights = b.highlights;
  if (!Array.isArray(highlights) || highlights.length > 8 || highlights.some((h) => typeof h !== 'string'))
    throw new HttpError(400, '首页亮点格式不正确');

  const next: PublicSettings = {
    siteTitle: str(b, 'siteTitle', 40) || '加拿大冰酒 · 葡萄酒',
    siteSubtitle: str(b, 'siteSubtitle', 120),
    highlights: (highlights as string[]).map((h) => h.trim().slice(0, 40)).filter(Boolean),
    policyText: str(b, 'policyText', 3000),
    contactText: str(b, 'contactText', 300),
    tiers: {
      CAD: parseTiers((b.tiers as Record<string, unknown> | undefined)?.CAD, 'CAD'),
      CNY: parseTiers((b.tiers as Record<string, unknown> | undefined)?.CNY, 'CNY'),
    },
    windowYears: num(b, 'windowYears', { min: 1, max: 10, int: true, label: '统计年限' }),
  };
  for (const key of Object.keys(next) as (keyof PublicSettings)[]) setSetting(key, next[key] as never);
  res.json(getSettings());
});

// ---------- Dashboard ----------

/** Earliest possible date: 全部时间 counts every order from the very beginning. */
const BEGINNING = '0001-01-01';

/** Resolve ?from=&to= (default: this month so far), or ?all=1 for 全部时间 (every order up to today). */
function statsRange(query: Record<string, unknown>): { from: string; to: string; all: boolean } {
  const t = today();
  if (query.all === '1') return { from: BEGINNING, to: t, all: true };
  const from = typeof query.from === 'string' && query.from ? query.from : `${t.slice(0, 7)}-01`;
  const to = typeof query.to === 'string' && query.to ? query.to : t;
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, '日期格式不正确');
  if (from > to) throw new HttpError(400, '开始日期不能晚于结束日期');
  return { from, to, all: false };
}

adminMiscRouter.get('/stats', (req, res) => {
  const { from, to } = statsRange(req.query);
  const monthStart = `${today().slice(0, 7)}-01`;
  const count = (sql: string, ...p: string[]) => (db.prepare(sql).get(...p) as { n: number }).n;

  // Customers within 25% of their next tier's threshold.
  const { tiers } = getSettings();
  const near: AdminStats['nearNextTier'] = [];
  for (const u of listUsersForAdmin({ status: 'active' })) {
    for (const c of CURRENCIES) {
      const r = tierFor(u.totals[c], tiers[c]);
      if (r.next && u.totals[c] > 0 && r.toNext <= r.next.min * 0.25)
        near.push({ id: u.id, name: u.name, currency: c, total: u.totals[c], toNext: r.toNext, nextRate: r.next.rate });
    }
  }
  near.sort((a, b) => a.toNext / (a.total + a.toNext) - b.toNext / (b.total + b.toNext));

  const stats: AdminStats = {
    customers: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`),
    newCustomersThisMonth: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND created_at >= ?`, monthStart),
    disabledCustomers: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND status = 'disabled'`),
    productsActive: count(`SELECT COUNT(*) AS n FROM products WHERE status = 'active'`),
    productsHidden: count(`SELECT COUNT(*) AS n FROM products WHERE status = 'hidden'`),
    nearNextTier: near.slice(0, 10),
    from,
    to,
    ...rangeStats(from, to),
    monthly: monthlySales(to),
  };
  res.json(stats);
});

// ---------- CSV export (opens in Excel; UTF-8 BOM keeps Chinese readable) ----------

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop Excel treating text as a formula
  return `"${s.replace(/"/g, '""')}"`;
}

function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send('﻿' + body);
}

const phoneForCsv = (p: string | null) => (p ? formatPhone(p).replace(/^\+/, '') : '');

adminMiscRouter.get('/export/customers.csv', (_req, res) => {
  const users = listUsersForAdmin({});
  sendCsv(
    res,
    `全部客户名单_${today()}.csv`,
    ['编号', '姓名', '手机', '邮箱', '微信', '公司', '状态', '注册时间', '两年累计(加币)', '两年累计(人民币)', '可享折扣', '交易笔数', '最近订货', '备注'],
    users.map((u) => [
      u.id, u.name, phoneForCsv(u.phone), u.email ?? '', u.wechat, u.company,
      u.status === 'active' ? '正常' : '已停用',
      u.createdAt, u.totals.CAD, u.totals.CNY, `${Math.round(u.rate * 100)}%`, u.txCount, u.lastOrderDate ?? '', u.adminNote,
    ]),
  );
});

adminMiscRouter.get('/export/transactions.csv', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, u.name AS user_name, u.phone, u.email FROM transactions t
       JOIN users u ON u.id = t.user_id WHERE u.role = 'customer' ORDER BY t.order_date DESC, t.id DESC`,
    )
    .all() as {
    id: number; order_date: string; currency: Currency; subtotal_cents: number | null; discount_rate: number;
    amount_cents: number; items_json: string; note: string; user_name: string; phone: string | null; email: string | null;
  }[];
  sendCsv(
    res,
    `全部交易记录_${today()}.csv`,
    ['交易编号', '订货日期', '客户', '手机', '邮箱', '币种', '原价合计', '折扣', '实付金额', '商品明细', '备注'],
    rows.map((r) => [
      r.id, r.order_date, r.user_name, phoneForCsv(r.phone), r.email ?? '',
      r.currency === 'CAD' ? '加币' : '人民币',
      r.subtotal_cents == null ? '' : r.subtotal_cents / 100,
      `${Math.round(r.discount_rate * 100)}%`,
      r.amount_cents / 100,
      (JSON.parse(r.items_json) as TransactionItem[]).map((i) => `${i.name} ×${i.qty} @${i.unitPrice}`).join('；'),
      r.note,
    ]),
  );
});

/**
 * 本期销售统计: the dashboard's statistics for the selected period, as one Excel-readable
 * file with sections. Unlike the page (top 10), the rankings here are complete.
 */
adminMiscRouter.get('/export/stats.csv', (req, res) => {
  const { from, to, all } = statsRange(req.query);
  const r = rangeStats(from, to, Infinity);
  const periodText = all ? `全部时间（截至 ${to}）` : `${from} 至 ${to}`;
  const monthly = monthlySales(to);
  const cur = (c: Currency) => (c === 'CAD' ? '加币' : '人民币');
  let rank = 0;
  const rows: unknown[][] = [
    [`本期销售统计 ${periodText}`],
    [],
    ['【汇总】'],
    ['币种', '销售额（实付）', '订单数', '下单客户数', '平均每单', '折扣让利'],
    ...CURRENCIES.map((c) => {
      const s = r.summary[c];
      return [cur(c), s.sales, s.orders, s.buyers, s.avgOrder, s.discountGiven];
    }),
    [],
    ['【产品排行】按销售数量（瓶）从多到少；销售额已按订单折扣分摊（实收）'],
    ['排名', '产品', '数量', '销售额（加币）', '销售额（人民币）'],
    ...r.products.map((p) => [p.kind === 'product' ? ++rank : '', p.name, p.qty, p.sales.CAD, p.sales.CNY]),
    ...(r.ordersWithoutItems ? [[`另有 ${r.ordersWithoutItems} 笔订单未填写商品明细，未计入产品排行`]] : []),
    [],
    ['【客户排行】按实付金额从高到低，加币与人民币分开排名'],
    ['排名', '客户', '币种', '销售额', '订单数'],
    ...CURRENCIES.flatMap((c) => r.topCustomers[c].map((u, i) => [i + 1, u.name, cur(c), u.sales, u.orders])),
    [],
    [`【月度销售趋势】截至 ${to.slice(0, 7)} 的最近 12 个月`],
    ['月份', '销售额（加币）', '订单数（加币）', '销售额（人民币）', '订单数（人民币）'],
    ...monthly.map((m) => [m.month, m.sales.CAD, m.orders.CAD, m.sales.CNY, m.orders.CNY]),
  ];
  const fileName = all ? `本期销售统计_全部时间_截至_${to}.csv` : `本期销售统计_${from}_至_${to}.csv`;
  sendCsv(res, fileName, rows[0] as string[], rows.slice(1));
});
