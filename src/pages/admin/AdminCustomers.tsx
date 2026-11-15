import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatRate } from '../../../shared/discount';
import { formatPhone } from '../../../shared/phone';
import type { AdminUser, AdminUserListItem } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { FormMessage } from '../../components/FormBits';
import { dateZh, money } from '../../format';
import CustomerFields, { EMPTY_CUSTOMER, type CustomerForm } from './CustomerFields';

export default function AdminCustomers() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set('q', search.trim());
      else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [search, params, setParams]);

  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  const { data, error, loading, reload } = useApi<AdminUserListItem[]>(`/admin/users?${query}`);

  // Sorting lives in the URL (?sort=&dir=) so a refresh or the back button keeps it.
  const sortKey: SortKey = SORT_KEYS.includes(params.get('sort') as SortKey) ? (params.get('sort') as SortKey) : 'lastOrder';
  const dir: SortDir = params.get('dir') === 'asc' || params.get('dir') === 'desc' ? (params.get('dir') as SortDir) : DEFAULT_DIR[sortKey];
  const sorted = useMemo(() => (data ? sortCustomers(data, sortKey, dir) : []), [data, sortKey, dir]);

  const setSort = (key: SortKey) => {
    const next = new URLSearchParams(params);
    // Clicking the current column flips the direction; a new column starts at its natural direction.
    const nextDir = key === sortKey ? (dir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[key];
    if (key === 'lastOrder' && nextDir === DEFAULT_DIR.lastOrder) {
      next.delete('sort');
      next.delete('dir');
    } else {
      next.set('sort', key);
      next.set('dir', nextDir);
    }
    setParams(next, { replace: true });
  };
  const header = (key: SortKey, label: string, numeric = false) => (
    <SortHeader label={label} active={sortKey === key} dir={dir} numeric={numeric} onClick={() => setSort(key)} />
  );

  return (
    <>
      <div className="admin-head">
        <h1 className="section-title">客户</h1>
        <button className="btn btn-primary" onClick={() => setCreating((c) => !c)}>
          {creating ? '收起' : '+ 新增客户'}
        </button>
      </div>

      {creating && <NewCustomer onCreated={reload} />}

      <div className="filter-row admin-filters">
        <input
          className="input"
          type="search"
          placeholder="搜索姓名、手机、邮箱、微信、公司…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={status}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('status', e.target.value);
            else next.delete('status');
            setParams(next, { replace: true });
          }}
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已停用</option>
        </select>
      </div>

      {error && <p className="error">加载失败：{error.message}</p>}
      {!data && loading && <p className="muted">加载中…</p>}
      {data && data.length === 0 && <p className="empty">没有找到客户。</p>}
      {data && data.length > 0 && (
        <p className="sort-note muted small" aria-live="polite">
          共 {data.length} 位客户 · 当前排序：<strong>{sortDescription(sortKey, dir)}</strong>
          {sortKey === 'lastOrder' && '，从未下单的客户排在最后'}。点击带 ▲▼ 的表头可切换排序，再点一次反向。
        </p>
      )}
      {data && data.length > 0 && (
        <div className={`table-wrap${loading ? ' is-refreshing' : ''}`}>
          <table className="data-table">
            <thead>
              <tr>
                {header('name', '客户')}
                <th>联系方式</th>
                {header('cad', '两年累计（加币）', true)}
                {header('cny', '两年累计（人民币）', true)}
                {header('rate', '可享折扣')}
                {header('tx', '交易', true)}
                {header('lastOrder', '最近订货')}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className={u.status === 'disabled' ? 'row-muted' : undefined}>
                  <td>
                    <Link to={`/admin/customers/${u.id}`} className="strong-link">
                      {u.name}
                    </Link>
                    {u.status === 'disabled' && <span className="pill">已停用</span>}
                    {u.company && <div className="muted small">{u.company}</div>}
                  </td>
                  <td className="small">
                    {u.phone && <div>{formatPhone(u.phone)}</div>}
                    {u.email && <div>{u.email}</div>}
                    {u.wechat && <div className="muted">微信 {u.wechat}</div>}
                  </td>
                  <td className="num">{u.totals.CAD ? money(u.totals.CAD, 'CAD') : '—'}</td>
                  <td className="num">{u.totals.CNY ? money(u.totals.CNY, 'CNY') : '—'}</td>
                  <td>{u.rate ? <strong className="rate">{formatRate(u.rate)}</strong> : '—'}</td>
                  <td className="num">{u.txCount}</td>
                  <td className="small">{u.lastOrderDate ? dateZh(u.lastOrderDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------- Sorting ----------

type SortKey = 'lastOrder' | 'cny' | 'cad' | 'rate' | 'tx' | 'name';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['lastOrder', 'cny', 'cad', 'rate', 'tx', 'name'];
/** First click on a column: biggest/newest first, except names (A→Z / 拼音). */
const DEFAULT_DIR: Record<SortKey, SortDir> = { lastOrder: 'desc', cny: 'desc', cad: 'desc', rate: 'desc', tx: 'desc', name: 'asc' };

/** Plain-words description of the current sort, shown above the table. */
function sortDescription(key: SortKey, dir: SortDir): string {
  const asc = dir === 'asc';
  switch (key) {
    case 'lastOrder':
      return `最近订货（${asc ? '从旧到新' : '从新到旧'}）`;
    case 'cny':
      return `两年累计（人民币）（${asc ? '从低到高' : '从高到低'}）`;
    case 'cad':
      return `两年累计（加币）（${asc ? '从低到高' : '从高到低'}）`;
    case 'rate':
      return `可享折扣（${asc ? '从低到高' : '从高到低'}）`;
    case 'tx':
      return `交易笔数（${asc ? '从少到多' : '从多到少'}）`;
    case 'name':
      return `客户姓名（按拼音 ${asc ? 'A→Z' : 'Z→A'}）`;
  }
}

const byName = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

/**
 * Sort customers. Customers with no orders always go to the bottom when sorting by
 * 最近订货 (newest sign-ups first among them). Ties fall back to most recent order,
 * then newest sign-up, so the order is always stable.
 */
function sortCustomers(list: AdminUserListItem[], key: SortKey, dir: SortDir): AdminUserListItem[] {
  const sign = dir === 'asc' ? 1 : -1;
  const tieBreak = (a: AdminUserListItem, b: AdminUserListItem) =>
    (b.lastOrderDate ?? '').localeCompare(a.lastOrderDate ?? '') || b.id - a.id;

  return [...list].sort((a, b) => {
    let c = 0;
    switch (key) {
      case 'lastOrder':
        if (!a.lastOrderDate || !b.lastOrderDate) {
          if (a.lastOrderDate) return -1; // a has orders, b doesn't → a first (either direction)
          if (b.lastOrderDate) return 1;
          return b.id - a.id;
        }
        c = a.lastOrderDate.localeCompare(b.lastOrderDate);
        break;
      case 'cny':
        c = a.totals.CNY - b.totals.CNY;
        break;
      case 'cad':
        c = a.totals.CAD - b.totals.CAD;
        break;
      case 'rate':
        c = a.rate - b.rate;
        break;
      case 'tx':
        c = a.txCount - b.txCount;
        break;
      case 'name':
        c = byName.compare(a.name, b.name);
        break;
    }
    return c * sign || tieBreak(a, b);
  });
}

function SortHeader(props: { label: string; active: boolean; dir: SortDir; numeric: boolean; onClick: () => void }) {
  return (
    <th
      className={`${props.numeric ? 'num ' : ''}sortable${props.active ? ' sorted' : ''}`}
      aria-sort={props.active ? (props.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="sort-button" onClick={props.onClick}>
        {props.label}
        {/* Same two-triangle icon on every sortable column; the active direction is highlighted. */}
        <svg
          className={`sort-icon${props.active ? ` sort-${props.dir}` : ''}`}
          viewBox="0 0 10 14"
          aria-hidden="true"
        >
          <path className="sort-up" d="M5 1 9 5.5H1z" />
          <path className="sort-down" d="M5 13 1 8.5h8z" />
        </svg>
      </button>
    </th>
  );
}

function NewCustomer({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ user: AdminUser; tempPassword: string | null } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<{ user: AdminUser; tempPassword: string | null }>('/admin/users', { method: 'POST', body: form });
      setCreated(r);
      setForm(EMPTY_CUSTOMER);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (created)
    return (
      <div className="card admin-section notice">
        <p>
          已创建客户 <strong>{created.user.name}</strong>。
        </p>
        {created.tempPassword && <TempPassword user={created.user} password={created.tempPassword} />}
        <div className="button-row">
          <Link className="btn btn-primary" to={`/admin/customers/${created.user.id}`}>
            查看客户 / 记录交易
          </Link>
          <button className="btn" onClick={() => setCreated(null)}>
            继续新增
          </button>
        </div>
      </div>
    );

  return (
    <form className="card admin-section" onSubmit={submit} noValidate>
      <h2 className="sub-title first">新增客户</h2>
      <p className="muted small">为线下或微信老客户开通账号。系统会生成临时密码，请发给客户登录。</p>
      <CustomerFields form={form} onChange={setForm} />
      <FormMessage error={error} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? '创建中…' : '创建客户'}
      </button>
    </form>
  );
}

/** Shows a one-time password with a ready-to-send message. */
export function TempPassword({ user, password }: { user: AdminUser; password: string }) {
  const login = user.phone ? formatPhone(user.phone) : user.email;
  const message = `您好，您的账号已开通。登录账号：${login}，临时密码：${password}。登录后请在“个人资料”中修改密码。`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="temp-password">
      <p>
        临时密码：<code>{password}</code>（仅显示一次）
      </p>
      <p className="muted small">{message}</p>
      <button
        type="button"
        className="btn"
        onClick={() =>
          navigator.clipboard
            ?.writeText(message)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
      >
        {copied ? '已复制' : '复制发给客户的消息'}
      </button>
    </div>
  );
}
