// Create an administrator, or promote an existing account to administrator.
//
//   npm run create-admin -- --email you@example.com --name 张三 --password "a-strong-password"
//   npm run create-admin -- --phone 13812345678 --name 张三 --password "..."
//   npm run create-admin -- --phone 4165551234 --cc +1 --name ... --password "..."
//
// If the phone/email already belongs to an account, it is promoted to admin (and the
// password is replaced only when --password is given).
import { parseArgs } from 'node:util';
import { EMAIL_RE, normalizePhone, PASSWORD_MIN } from '../../shared/phone';
import type { CountryCode } from '../../shared/types';
import { endOtherSessions, hashPassword } from '../auth';
import { db, migrate } from '../db';
import { createUser, findUserRowByLogin, setPasswordHash } from '../repo/users';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    phone: { type: 'string' },
    cc: { type: 'string', default: '+86' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
});

function fail(msg: string): never {
  console.error(`错误：${msg}`);
  console.error('用法：npm run create-admin -- --email you@example.com --name 姓名 --password "至少8位密码"');
  process.exit(1);
}

migrate();

const email = values.email?.trim().toLowerCase() || null;
if (email && !EMAIL_RE.test(email)) fail('邮箱格式不正确');
let phone: string | null = null;
if (values.phone) {
  if (values.cc !== '+86' && values.cc !== '+1') fail('--cc 只能是 +86 或 +1');
  phone = normalizePhone(values.cc as CountryCode, values.phone);
  if (!phone) fail('手机号格式不正确');
}
if (!email && !phone) fail('请提供 --email 或 --phone');
if (values.password && values.password.length < PASSWORD_MIN) fail(`密码至少需要 ${PASSWORD_MIN} 位`);

const existing = (phone && findUserRowByLogin({ phone })) || (email && findUserRowByLogin({ email })) || undefined;

if (existing) {
  db.prepare(`UPDATE users SET role = 'admin', status = 'active' WHERE id = ?`).run(existing.id);
  if (values.password) {
    setPasswordHash(existing.id, await hashPassword(values.password));
    endOtherSessions(existing.id);
  }
  console.log(`已将账号「${existing.name}」设为管理员${values.password ? '，并更新了密码' : ''}。`);
} else {
  if (!values.name?.trim()) fail('新建管理员需要 --name');
  if (!values.password) fail('新建管理员需要 --password');
  createUser({ name: values.name.trim(), email, phone, passwordHash: await hashPassword(values.password), role: 'admin' });
  console.log(`已创建管理员「${values.name.trim()}」。请登录网站后进入“管理后台”。`);
}
