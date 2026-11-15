// Manage administrator accounts from the command line (admins are not shown on the web pages).
//
//   npm run admins                                 list all admins
//   npm run admins -- disable --email x@y.com      disable an admin (can't log in any more)
//   npm run admins -- enable  --email x@y.com      re-enable a disabled admin
//   (use --phone 13812345678 [--cc +1] instead of --email for phone accounts)
//
// To create an admin or reset an admin's password: npm run create-admin -- ...
import { parseArgs } from 'node:util';
import { normalizePhone } from '../../shared/phone';
import type { CountryCode } from '../../shared/types';
import { endOtherSessions } from '../auth';
import { db, migrate } from '../db';
import { findUserRowByLogin } from '../repo/users';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: 'string' },
    phone: { type: 'string' },
    cc: { type: 'string', default: '+86' },
  },
});

function fail(msg: string): never {
  console.error(`错误：${msg}`);
  process.exit(1);
}

migrate();
const cmd = positionals[0] ?? 'list';

type Row = { id: number; name: string; phone: string | null; email: string | null; status: string; last_login_at: string | null };
const listAdmins = () =>
  db.prepare(`SELECT id, name, phone, email, status, last_login_at FROM users WHERE role = 'admin' ORDER BY id`).all() as Row[];

if (cmd === 'list') {
  const rows = listAdmins();
  if (rows.length === 0) console.log('还没有管理员。请运行：npm run create-admin -- --email ... --name ... --password ...');
  for (const r of rows)
    console.log(
      `${r.status === 'active' ? '✓ 正常' : '✗ 停用'}  ${r.name}  ${r.email ?? ''} ${r.phone ?? ''}  最近登录：${r.last_login_at ?? '从未'}`,
    );
} else if (cmd === 'disable' || cmd === 'enable') {
  let phone: string | null = null;
  if (values.phone) {
    phone = normalizePhone(values.cc as CountryCode, values.phone);
    if (!phone) fail('手机号格式不正确');
  }
  const email = values.email?.trim().toLowerCase();
  if (!phone && !email) fail('请提供 --email 或 --phone');
  const row = (phone && findUserRowByLogin({ phone })) || (email && findUserRowByLogin({ email })) || undefined;
  if (!row || row.role !== 'admin') fail('没有找到该管理员账号');

  if (cmd === 'disable') {
    const othersActive = listAdmins().filter((a) => a.status === 'active' && a.id !== row.id).length;
    if (othersActive === 0) fail('不能停用最后一个正常的管理员，否则将无法登录管理后台');
    db.prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`).run(row.id);
    endOtherSessions(row.id);
    console.log(`已停用管理员「${row.name}」。`);
  } else {
    db.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(row.id);
    console.log(`已启用管理员「${row.name}」。`);
  }
} else {
  fail('用法：npm run admins | npm run admins -- disable --email ... | npm run admins -- enable --email ...');
}
