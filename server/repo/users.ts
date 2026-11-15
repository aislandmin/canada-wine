import crypto from 'node:crypto';
import { deservedDiscount, windowStart } from '../../shared/discount';
import type { AdminUser, AdminUserListItem, Currency, Role, User, UserStatus } from '../../shared/types';
import { db } from '../db';
import { getSettings } from './settings';
import { today } from './transactions';

export interface UserRow {
  id: number;
  phone: string | null;
  email: string | null;
  password_hash: string;
  name: string;
  wechat: string;
  company: string;
  role: Role;
  status: 'active' | 'disabled';
  admin_note: string;
  created_at: string;
  last_login_at: string | null;
}

export function toUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    wechat: r.wechat,
    company: r.company,
    role: r.role,
    createdAt: r.created_at,
  };
}

export function getUserRowById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
}

export function getUserById(id: number): User | null {
  const row = getUserRowById(id);
  return row ? toUser(row) : null;
}

export function findUserRowByLogin(login: { phone?: string; email?: string }): UserRow | undefined {
  if (login.phone) return db.prepare('SELECT * FROM users WHERE phone = ?').get(login.phone) as unknown as UserRow | undefined;
  if (login.email)
    return db.prepare('SELECT * FROM users WHERE email = ?').get(login.email.toLowerCase()) as unknown as UserRow | undefined;
  return undefined;
}

export function isPhoneTaken(phone: string, exceptUserId?: number): boolean {
  return !!db.prepare('SELECT 1 FROM users WHERE phone = ? AND id <> ?').get(phone, exceptUserId ?? 0);
}

export function isEmailTaken(email: string, exceptUserId?: number): boolean {
  return !!db.prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?').get(email.toLowerCase(), exceptUserId ?? 0);
}

export interface NewUser {
  phone: string | null;
  email: string | null;
  passwordHash: string;
  name: string;
  wechat?: string;
  company?: string;
  role?: Role;
}

export function createUser(u: NewUser): number {
  const r = db
    .prepare(
      `INSERT INTO users (phone, email, password_hash, name, wechat, company, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(u.phone, u.email?.toLowerCase() ?? null, u.passwordHash, u.name, u.wechat ?? '', u.company ?? '', u.role ?? 'customer');
  return Number(r.lastInsertRowid);
}

export function updateProfile(
  id: number,
  p: { name: string; phone: string | null; email: string | null; wechat: string; company: string },
): void {
  db.prepare('UPDATE users SET name = ?, phone = ?, email = ?, wechat = ?, company = ? WHERE id = ?').run(
    p.name,
    p.phone,
    p.email?.toLowerCase() ?? null,
    p.wechat,
    p.company,
    id,
  );
}

export function setPasswordHash(id: number, hash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

// ---------- Admin ----------

export function toAdminUser(r: UserRow): AdminUser {
  return { ...toUser(r), status: r.status, adminNote: r.admin_note, lastLoginAt: r.last_login_at };
}

/** All accounts with their spending in the window ending today. Search matches name/phone/email/WeChat/company. */
export function listUsersForAdmin(opts: { q?: string; status?: UserStatus | '' }): AdminUserListItem[] {
  // Customers only: admin accounts are the seller and never appear in customer management or stats.
  const where: string[] = [`role = 'customer'`];
  const params: (string | number)[] = [];
  if (opts.q) {
    const like = `%${opts.q.replace(/[\s\-()]/g, '').replace(/[%_]/g, '')}%`;
    const likeRaw = `%${opts.q.replace(/[%_]/g, '')}%`;
    where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR wechat LIKE ? OR company LIKE ?)');
    params.push(likeRaw, like, likeRaw, likeRaw, likeRaw);
  }
  if (opts.status) {
    where.push('status = ?');
    params.push(opts.status);
  }
  const rows = db
    .prepare(`SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY id DESC`)
    .all(...params) as unknown as UserRow[];

  const { tiers, windowYears } = getSettings();
  const end = today();
  const start = windowStart(end, windowYears);
  const sums = db
    .prepare(
      `SELECT user_id, currency, SUM(amount_cents) AS cents FROM transactions
       WHERE order_date >= ? AND order_date <= ? GROUP BY user_id, currency`,
    )
    .all(start, end) as { user_id: number; currency: Currency; cents: number }[];
  const stats = db
    .prepare('SELECT user_id, COUNT(*) AS n, MAX(order_date) AS last FROM transactions GROUP BY user_id')
    .all() as { user_id: number; n: number; last: string }[];

  const totalsBy = new Map<number, { CAD: number; CNY: number }>();
  for (const s of sums) {
    const t = totalsBy.get(s.user_id) ?? { CAD: 0, CNY: 0 };
    t[s.currency] = s.cents / 100;
    totalsBy.set(s.user_id, t);
  }
  const statsBy = new Map(stats.map((s) => [s.user_id, s]));

  return rows.map((r) => {
    const totals = totalsBy.get(r.id) ?? { CAD: 0, CNY: 0 };
    const st = statsBy.get(r.id);
    return {
      ...toAdminUser(r),
      totals,
      rate: deservedDiscount(totals, tiers).rate,
      txCount: st?.n ?? 0,
      lastOrderDate: st?.last ?? null,
    };
  });
}

export function adminUpdateUser(
  id: number,
  p: {
    name: string;
    phone: string | null;
    email: string | null;
    wechat: string;
    company: string;
    adminNote: string;
    role: Role;
    status: UserStatus;
  },
): void {
  db.prepare(
    `UPDATE users SET name = ?, phone = ?, email = ?, wechat = ?, company = ?, admin_note = ?, role = ?, status = ?
     WHERE id = ?`,
  ).run(p.name, p.phone, p.email?.toLowerCase() ?? null, p.wechat, p.company, p.adminNote, p.role, p.status, id);
}

/** Readable temporary password: no 0/O/1/l/I to avoid confusion when read out over WeChat. */
export function generateTempPassword(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
