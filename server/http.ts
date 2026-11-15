import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Throw from a handler to send `{ error }` with the given status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Express 4 doesn't catch rejected promises; this forwards them to the error handler. */
export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Read an optional trimmed string field from a JSON body, enforcing a max length. */
export function str(body: unknown, key: string, max = 200): string {
  const v = (body as Record<string, unknown> | undefined)?.[key];
  if (v == null) return '';
  if (typeof v !== 'string') throw new HttpError(400, `字段 ${key} 格式不正确`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `字段 ${key} 过长（最多 ${max} 字）`);
  return s;
}

/** Read a number field, enforcing bounds. `optional` returns null when absent/empty. */
export function num(
  body: unknown,
  key: string,
  opts: { min?: number; max?: number; int?: boolean; label?: string } = {},
): number {
  const v = (body as Record<string, unknown> | undefined)?.[key];
  const label = opts.label ?? key;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new HttpError(400, `请填写有效的${label}`);
  if (opts.int && !Number.isInteger(n)) throw new HttpError(400, `${label}必须是整数`);
  if (opts.min != null && n < opts.min) throw new HttpError(400, `${label}不能小于 ${opts.min}`);
  if (opts.max != null && n > opts.max) throw new HttpError(400, `${label}不能大于 ${opts.max}`);
  return n;
}

/** Parse a positive integer route param or 404. */
export function idParam(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, '记录不存在');
  return id;
}

/**
 * Fixed-window in-memory rate limiter (single server process).
 * Returns a function that throws 429 once `limit` hits occur within `windowMs` for a key.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  const blocked = (key: string) => {
    const entry = hits.get(key);
    if (entry && entry.resetAt > Date.now() && entry.count >= limit) {
      const minutes = Math.ceil((entry.resetAt - Date.now()) / 60000);
      throw new HttpError(429, `尝试次数过多，请 ${minutes} 分钟后再试`);
    }
  };

  return {
    /** Throw 429 if `key` has already used up its attempts (doesn't count as an attempt). */
    check: blocked,
    /** Count one attempt; throws 429 once the limit is exceeded. */
    hit(key: string) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }
      entry.count++;
      if (entry.count > limit) {
        const minutes = Math.ceil((entry.resetAt - now) / 60000);
        throw new HttpError(429, `尝试次数过多，请 ${minutes} 分钟后再试`);
      }
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

/**
 * CSRF defence: state-changing API calls must be JSON (or a raw image upload).
 * Browsers can't send those content types cross-site without a CORS preflight,
 * which we never approve. Combined with SameSite=Lax cookies this blocks
 * cross-site form posts.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is(['application/json', 'image/*'])) {
    next(new HttpError(415, '请求格式不正确'));
    return;
  }
  next();
};
