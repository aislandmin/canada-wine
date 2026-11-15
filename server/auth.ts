import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, RequestHandler, Response } from 'express';
import type { User } from '../shared/types';
import { SESSION_COOKIE, SESSION_DAYS } from './config';
import { db } from './db';
import { HttpError } from './http';
import { getUserById } from './repo/users';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// ---------- Passwords (scrypt, salted) ----------

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** A real hash to compare against when the account doesn't exist, so timing doesn't reveal that. */
const DUMMY_HASH = await hashPassword(crypto.randomBytes(12).toString('hex'));
export const verifyAgainstDummy = (password: string) => verifyPassword(password, DUMMY_HASH);

// ---------- Sessions (random token in an httpOnly cookie; only its hash is stored) ----------

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function startSession(req: Request, res: Response, userId: number): void {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    expires.toISOString(),
  );
  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure, // true behind HTTPS (with TRUST_PROXY=1)
    path: '/',
    expires,
  });
}

export function endSession(req: Request, res: Response): void {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Sign the user out everywhere except (optionally) the current browser. */
export function endOtherSessions(userId: number, req?: Request): void {
  const token = req ? readCookie(req, SESSION_COOKIE) : undefined;
  if (token) db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, sha256(token));
  else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function purgeExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** Attaches req.user when a valid session cookie is present. */
export const loadUser: RequestHandler = (req, _res, next) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const row = db
      .prepare(
        `SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
      )
      .get(sha256(token), new Date().toISOString()) as { user_id: number } | undefined;
    if (row) req.user = getUserById(row.user_id) ?? undefined;
  }
  next();
};

export const requireUser: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : new HttpError(401, '请先登录'));
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) next(new HttpError(401, '请先登录'));
  else if (req.user.role !== 'admin') next(new HttpError(403, '没有权限'));
  else next();
};
