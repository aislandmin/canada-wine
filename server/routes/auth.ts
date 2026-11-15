import { Router, type Request } from 'express';
import { EMAIL_RE, normalizePhone, PASSWORD_MIN } from '../../shared/phone';
import { COUNTRY_CODES, type CountryCode } from '../../shared/types';
import {
  endOtherSessions,
  endSession,
  hashPassword,
  requireUser,
  startSession,
  verifyAgainstDummy,
  verifyPassword,
} from '../auth';
import { ah, HttpError, rateLimiter, str } from '../http';
import {
  createUser,
  findUserRowByLogin,
  getUserById,
  getUserRowById,
  isEmailTaken,
  isPhoneTaken,
  setPasswordHash,
  updateProfile,
} from '../repo/users';

export const authRouter = Router();

const loginByIp = rateLimiter(30, 15 * 60_000); // failed logins per IP
const loginByAccount = rateLimiter(8, 15 * 60_000); // failed logins per account
const signupByIp = rateLimiter(20, 60 * 60_000); // sign-ups per IP

function countryCode(body: unknown): CountryCode {
  const cc = str(body, 'countryCode', 4) || '+86';
  if (!COUNTRY_CODES.includes(cc as CountryCode)) throw new HttpError(400, '不支持的国家/地区区号');
  return cc as CountryCode;
}

/** Validate optional phone + email from a body. At least one is required. */
function contactFields(body: unknown): { phone: string | null; email: string | null } {
  const rawPhone = str(body, 'phone', 30);
  const rawEmail = str(body, 'email', 120);
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(countryCode(body), rawPhone);
    if (!phone) throw new HttpError(400, '手机号格式不正确');
  }
  if (rawEmail && !EMAIL_RE.test(rawEmail)) throw new HttpError(400, '邮箱格式不正确');
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (!phone && !email) throw new HttpError(400, '请填写手机号或邮箱（至少一项）');
  return { phone, email };
}

function password(body: unknown, key: string): string {
  const v = (body as Record<string, unknown>)?.[key];
  if (typeof v !== 'string' || v.length < PASSWORD_MIN) throw new HttpError(400, `密码至少需要 ${PASSWORD_MIN} 位`);
  if (v.length > 200) throw new HttpError(400, '密码过长');
  return v;
}

const clientIp = (req: Request) => req.ip ?? 'unknown';

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.post(
  '/signup',
  ah(async (req, res) => {
    signupByIp.hit(clientIp(req));
    const name = str(req.body, 'name', 60);
    if (!name) throw new HttpError(400, '请填写姓名');
    const { phone, email } = contactFields(req.body);
    const pw = password(req.body, 'password');
    if (phone && isPhoneTaken(phone)) throw new HttpError(409, '该手机号已注册，请直接登录');
    if (email && isEmailTaken(email)) throw new HttpError(409, '该邮箱已注册，请直接登录');

    const id = createUser({
      name,
      phone,
      email,
      passwordHash: await hashPassword(pw),
      wechat: str(req.body, 'wechat', 60),
      company: str(req.body, 'company', 100),
    });
    startSession(req, res, id);
    res.status(201).json({ user: getUserById(id) });
  }),
);

authRouter.post(
  '/login',
  ah(async (req, res) => {
    // Only FAILED attempts are counted, so many customers sharing one IP (common on Chinese
    // mobile networks) are never blocked by each other's successful logins.
    const ip = clientIp(req);
    loginByIp.check(ip);
    const method = str(req.body, 'method', 10);
    let login: { phone?: string; email?: string };
    if (method === 'email') {
      const email = str(req.body, 'email', 120).toLowerCase();
      if (!email) throw new HttpError(400, '请输入邮箱');
      login = { email };
    } else {
      const phone = normalizePhone(countryCode(req.body), str(req.body, 'phone', 30));
      if (!phone) throw new HttpError(400, '手机号格式不正确');
      login = { phone };
    }
    const accountKey = login.phone ?? login.email!;
    loginByAccount.check(accountKey);

    const pw = typeof req.body?.password === 'string' ? (req.body.password as string) : '';
    const row = findUserRowByLogin(login);
    const ok = row ? await verifyPassword(pw, row.password_hash) : await verifyAgainstDummy(pw);
    if (!row || !ok) {
      loginByIp.hit(ip);
      loginByAccount.hit(accountKey);
      throw new HttpError(401, '账号或密码不正确');
    }
    if (row.status !== 'active') throw new HttpError(403, '该账号已停用，请联系客服');

    loginByAccount.reset(accountKey);
    startSession(req, res, row.id);
    res.json({ user: getUserById(row.id) });
  }),
);

authRouter.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

authRouter.put('/profile', requireUser, (req, res) => {
  const me = req.user!;
  const name = str(req.body, 'name', 60);
  if (!name) throw new HttpError(400, '请填写姓名');
  const { phone, email } = contactFields(req.body);
  if (phone && isPhoneTaken(phone, me.id)) throw new HttpError(409, '该手机号已被其他账号使用');
  if (email && isEmailTaken(email, me.id)) throw new HttpError(409, '该邮箱已被其他账号使用');
  updateProfile(me.id, {
    name,
    phone,
    email,
    wechat: str(req.body, 'wechat', 60),
    company: str(req.body, 'company', 100),
  });
  res.json({ user: getUserById(me.id) });
});

authRouter.put(
  '/password',
  requireUser,
  ah(async (req, res) => {
    const me = req.user!;
    loginByAccount.hit(`pw:${me.id}`);
    const current = typeof req.body?.current === 'string' ? (req.body.current as string) : '';
    const next = password(req.body, 'next');
    const row = getUserRowById(me.id)!;
    if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, '当前密码不正确');
    setPasswordHash(me.id, await hashPassword(next));
    endOtherSessions(me.id, req); // sign out other devices
    loginByAccount.reset(`pw:${me.id}`);
    res.json({ ok: true });
  }),
);
