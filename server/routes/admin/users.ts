import { Router } from 'express';
import { itemsSubtotal } from '../../../shared/discount';
import { EMAIL_RE, normalizePhone, PASSWORD_MIN } from '../../../shared/phone';
import { COUNTRY_CODES, CURRENCIES, type CountryCode, type Currency, type TransactionItem, type UserStatus } from '../../../shared/types';
import { endOtherSessions, hashPassword } from '../../auth';
import { ah, HttpError, idParam, num, str } from '../../http';
import {
  accountSummary,
  createTransaction,
  deleteTransaction,
  discountPreview,
  isValidDate,
  listAllTransactions,
  today,
  transactionOwner,
  updateTransaction,
  type TransactionWrite,
} from '../../repo/transactions';
import {
  adminUpdateUser,
  createUser,
  generateTempPassword,
  getUserRowById,
  isEmailTaken,
  isPhoneTaken,
  listUsersForAdmin,
  setPasswordHash,
  toAdminUser,
} from '../../repo/users';

export const adminUsersRouter = Router();

function contact(body: unknown, exceptUserId?: number) {
  const ccRaw = str(body, 'countryCode', 4) || '+86';
  if (!COUNTRY_CODES.includes(ccRaw as CountryCode)) throw new HttpError(400, '不支持的区号');
  const rawPhone = str(body, 'phone', 30);
  const rawEmail = str(body, 'email', 120);
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(ccRaw as CountryCode, rawPhone);
    if (!phone) throw new HttpError(400, '手机号格式不正确');
    if (isPhoneTaken(phone, exceptUserId)) throw new HttpError(409, '该手机号已被其他账号使用');
  }
  if (rawEmail && !EMAIL_RE.test(rawEmail)) throw new HttpError(400, '邮箱格式不正确');
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (email && isEmailTaken(email, exceptUserId)) throw new HttpError(409, '该邮箱已被其他账号使用');
  if (!phone && !email) throw new HttpError(400, '请填写手机号或邮箱（至少一项）');
  return { phone, email };
}

/**
 * Customer management only ever touches customer accounts. Admin accounts (the seller)
 * are invisible here and are managed with `npm run create-admin` / `npm run admins`.
 */
function customerOr404(id: number) {
  const row = getUserRowById(id);
  if (!row || row.role !== 'customer') throw new HttpError(404, '客户不存在');
  return row;
}

// ---------- Customers ----------

adminUsersRouter.get('/users', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const status = req.query.status === 'active' || req.query.status === 'disabled' ? req.query.status : '';
  res.json(listUsersForAdmin({ q, status }));
});

/** Create an account for a customer (e.g. an existing offline/WeChat customer). */
adminUsersRouter.post(
  '/users',
  ah(async (req, res) => {
    const name = str(req.body, 'name', 60);
    if (!name) throw new HttpError(400, '请填写姓名');
    const { phone, email } = contact(req.body);
    let password = typeof req.body?.password === 'string' ? (req.body.password as string) : '';
    let tempPassword: string | null = null;
    if (!password) password = tempPassword = generateTempPassword();
    else if (password.length < PASSWORD_MIN) throw new HttpError(400, `密码至少需要 ${PASSWORD_MIN} 位`);

    const id = createUser({
      name,
      phone,
      email,
      passwordHash: await hashPassword(password),
      wechat: str(req.body, 'wechat', 60),
      company: str(req.body, 'company', 100),
    });
    const note = str(req.body, 'adminNote', 1000);
    if (note) {
      const row = customerOr404(id);
      adminUpdateUser(id, { ...toAdminUser(row), phone, email, adminNote: note });
    }
    res.status(201).json({ user: toAdminUser(customerOr404(id)), tempPassword });
  }),
);

adminUsersRouter.get('/users/:id', (req, res) => {
  res.json(toAdminUser(customerOr404(idParam(req.params.id))));
});

/** Edit a customer's details. The account status is NOT changed here — see /status below. */
adminUsersRouter.put('/users/:id', (req, res) => {
  const id = idParam(req.params.id);
  const row = customerOr404(id);
  const name = str(req.body, 'name', 60);
  if (!name) throw new HttpError(400, '请填写姓名');

  const { phone, email } = contact(req.body, id);
  adminUpdateUser(id, {
    name,
    phone,
    email,
    wechat: str(req.body, 'wechat', 60),
    company: str(req.body, 'company', 100),
    adminNote: str(req.body, 'adminNote', 1000),
    role: 'customer', // customers can't be promoted from the web page; use `npm run create-admin`
    status: row.status, // unchanged: an open edit form must never undo a disable/enable
  });
  res.json(toAdminUser(customerOr404(id)));
});

/** Disable (can't log in; signed out everywhere; history kept) or re-enable a customer. Body: { status }. */
adminUsersRouter.post('/users/:id/status', (req, res) => {
  const id = idParam(req.params.id);
  const row = customerOr404(id);
  const status = str(req.body, 'status', 10) as UserStatus;
  if (status !== 'active' && status !== 'disabled') throw new HttpError(400, '状态不正确');
  adminUpdateUser(id, { ...toAdminUser(row), adminNote: row.admin_note, role: 'customer', status });
  if (status === 'disabled') endOtherSessions(id);
  res.json(toAdminUser(customerOr404(id)));
});

adminUsersRouter.post(
  '/users/:id/reset-password',
  ah(async (req, res) => {
    const id = idParam(req.params.id);
    customerOr404(id);
    const tempPassword = generateTempPassword();
    setPasswordHash(id, await hashPassword(tempPassword));
    endOtherSessions(id);
    res.json({ tempPassword });
  }),
);

adminUsersRouter.get('/users/:id/summary', (req, res) => {
  const id = idParam(req.params.id);
  customerOr404(id);
  const asOf = typeof req.query.asOf === 'string' && req.query.asOf ? req.query.asOf : today();
  if (!isValidDate(asOf)) throw new HttpError(400, '日期格式不正确');
  res.json(accountSummary(id, asOf));
});

adminUsersRouter.get('/users/:id/discount-preview', (req, res) => {
  const id = idParam(req.params.id);
  customerOr404(id);
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!isValidDate(date)) throw new HttpError(400, '日期格式不正确');
  // When editing, leave that transaction out of the "already paid" total (it's re-added at list price).
  const excludeRaw = typeof req.query.excludeTx === 'string' && req.query.excludeTx ? Number(req.query.excludeTx) : null;
  const exclude = excludeRaw != null && Number.isInteger(excludeRaw) && excludeRaw > 0 ? excludeRaw : null;
  res.json(discountPreview(id, date, exclude));
});

// ---------- Transactions ----------

function parseTransaction(body: unknown): TransactionWrite {
  const orderDate = str(body, 'orderDate', 10);
  if (!isValidDate(orderDate)) throw new HttpError(400, '请选择有效的订货日期');
  const currency = str(body, 'currency', 3) as Currency;
  if (!CURRENCIES.includes(currency)) throw new HttpError(400, '请选择币种');

  const rawItems = (body as { items?: unknown }).items ?? [];
  if (!Array.isArray(rawItems) || rawItems.length > 100) throw new HttpError(400, '商品明细格式不正确');
  const items: TransactionItem[] = rawItems.map((it, i) => {
    const label = `第 ${i + 1} 行`;
    const name = str(it, 'name', 120);
    if (!name) throw new HttpError(400, `${label}：请填写商品名称`);
    const pid = (it as { productId?: unknown }).productId;
    return {
      productId: typeof pid === 'number' && Number.isInteger(pid) ? pid : null,
      name,
      qty: num(it, 'qty', { min: 1, max: 100000, int: true, label: `${label}数量` }),
      unitPrice: num(it, 'unitPrice', { min: 0, max: 10_000_000, label: `${label}单价` }),
      ...((it as { giftBox?: unknown }).giftBox === true ? { giftBox: true } : {}),
    };
  });

  return {
    orderDate,
    currency,
    items,
    subtotal: items.length ? itemsSubtotal(items) : null,
    discountRate: num(body, 'discountRate', { min: 0, max: 1, label: '折扣' }),
    amount: num(body, 'amount', { min: 0, max: 100_000_000, label: '实付金额' }),
    note: str(body, 'note', 500),
  };
}

adminUsersRouter.post('/users/:id/transactions', (req, res) => {
  const id = idParam(req.params.id);
  customerOr404(id);
  const txId = createTransaction(id, parseTransaction(req.body), req.user!.id);
  res.status(201).json({ id: txId });
});

/**
 * GET /api/admin/transactions?from=&to=&currency=&q=&page= — every customer's transactions,
 * newest first, 50 per page, with the paid totals of everything matching the filters.
 */
adminUsersRouter.get('/transactions', (req, res) => {
  const qs = (k: string) => (typeof req.query[k] === 'string' ? (req.query[k] as string).trim() : '');
  const from = qs('from');
  const to = qs('to');
  if (from && !isValidDate(from)) throw new HttpError(400, '开始日期格式不正确');
  if (to && !isValidDate(to)) throw new HttpError(400, '结束日期格式不正确');
  if (from && to && from > to) throw new HttpError(400, '开始日期不能晚于结束日期');
  const currency = qs('currency');
  if (currency && !CURRENCIES.includes(currency as Currency)) throw new HttpError(400, '币种不正确');
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(qs('page')) || 1)));
  res.json(
    listAllTransactions({
      from: from || undefined,
      to: to || undefined,
      currency: (currency || undefined) as Currency | undefined,
      q: qs('q').slice(0, 60) || undefined,
      page,
      pageSize: 50,
    }),
  );
});

/** A transaction may only be changed if it exists and belongs to a customer account. */
function customerTransactionOr404(id: number): number {
  const owner = transactionOwner(id);
  if (owner == null) throw new HttpError(404, '交易记录不存在');
  customerOr404(owner);
  return owner;
}

adminUsersRouter.put('/transactions/:id', (req, res) => {
  const id = idParam(req.params.id);
  const owner = customerTransactionOr404(id);
  updateTransaction(id, parseTransaction(req.body));
  res.json({ ok: true, userId: owner });
});

adminUsersRouter.delete('/transactions/:id', (req, res) => {
  const id = idParam(req.params.id);
  customerTransactionOr404(id);
  deleteTransaction(id);
  res.json({ ok: true });
});
