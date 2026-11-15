import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatRate } from '../../../shared/discount';
import { formatPhone } from '../../../shared/phone';
import { CURRENCIES, type AdminUserListItem, type TransactionListItem, type TransactionListResponse } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { useFlash } from '../../components/FormBits';
import PeriodPicker from '../../components/PeriodPicker';
import { PERIOD_PRESETS, presetRange, type RangePreset } from '../../datePresets';
import { CURRENCY_LABEL, dateZh, money } from '../../format';
import TransactionForm from './TransactionForm';

type Mode = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; tx: TransactionListItem };

/** 管理后台 → 交易记录: every customer's transactions in one list. */
export default function AdminTransactions() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const currency = params.get('currency') ?? '';
  // Order-date filter: ?range=month|lastMonth|quarter|year|lastYear|custom (absent = 全部时间).
  // Only 自定义 uses the from/to boxes; the other buttons work out their dates themselves.
  const rawRange = params.get('range') as RangePreset | null;
  const range: RangePreset = rawRange && (PERIOD_PRESETS.some((p) => p.key === rawRange) || rawRange === 'all') ? rawRange : 'all';
  const dates =
    range === 'all'
      ? { from: '', to: '' }
      : range === 'custom'
        ? { from: params.get('from') ?? '', to: params.get('to') ?? '' }
        : presetRange(range);
  const { from, to } = dates;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(q);
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [flash, setFlash] = useFlash();
  const panelRef = useRef<HTMLDivElement>(null);

  /** Change one filter; any filter change goes back to page 1. */
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) setParam('q', search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search]); // only when the typed text changes

  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (currency) query.set('currency', currency);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (page > 1) query.set('page', String(page));
  const badRange = Boolean(from && to && from > to);
  const { data, error, loading, reload } = useApi<TransactionListResponse>(badRange ? null : `/admin/transactions?${query}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(q || currency || from || to);

  /** Pick a date button. 自定义 starts from whatever dates were showing, so it never starts blank. */
  const chooseRange = (key: RangePreset) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    next.delete('from');
    next.delete('to');
    if (key === 'all') next.delete('range');
    else next.set('range', key);
    if (key === 'custom') {
      const start = range === 'all' || range === 'custom' ? presetRange('month') : presetRange(range);
      next.set('from', from || start.from);
      next.set('to', to || start.to);
    }
    setParams(next, { replace: true });
  };


  // Bring the form into view when it opens (e.g. 修改 on a row far down the list).
  useEffect(() => {
    if (mode.kind !== 'none') panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [mode]);

  const done = (message: string) => {
    setMode({ kind: 'none' });
    setFlash(message);
    reload();
  };

  const remove = async (t: TransactionListItem) => {
    if (!confirm(`确定删除「${t.userName}」${dateZh(t.orderDate)} 的这笔交易（${money(t.amount, t.currency)}）吗？删除后无法恢复。`)) return;
    try {
      await api(`/admin/transactions/${t.id}`, { method: 'DELETE' });
      done('交易已删除');
    } catch (err) {
      alert(errorText(err));
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1 className="section-title">交易记录</h1>
        {mode.kind === 'none' && (
          <button className="btn btn-primary" onClick={() => setMode({ kind: 'new' })}>
            + 新增交易
          </button>
        )}
      </div>
      <p className="muted small">
        这里显示所有客户的交易记录，最新的在最前。也可以在「客户」中进入某位客户的页面查看和记录。
      </p>

      {flash && (
        <p className="form-success flash" role="status">
          {flash}
        </p>
      )}

      <div ref={panelRef}>
        {mode.kind === 'new' && <NewTransaction onSaved={() => done('交易已保存')} onCancel={() => setMode({ kind: 'none' })} />}
        {mode.kind === 'edit' && (
          <div className="tx-panel">
            <p className="tx-panel-customer">
              下单客户：<strong>{mode.tx.userName}</strong>
              {mode.tx.userPhone && <span className="muted"> {formatPhone(mode.tx.userPhone)}</span>}
            </p>
            <TransactionForm
              key={mode.tx.id}
              userId={mode.tx.userId}
              initial={mode.tx}
              onSaved={() => done('交易已更新')}
              onCancel={() => setMode({ kind: 'none' })}
            />
          </div>
        )}
      </div>

      <div className="tx-filters">
        <input
          className="input"
          type="search"
          placeholder="搜索客户：姓名、手机、邮箱、微信、公司…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="搜索客户"
        />
        <select className="input" value={currency} onChange={(e) => setParam('currency', e.target.value)} aria-label="币种">
          <option value="">全部币种</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_LABEL[c]}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSearch('');
              setParams({}, { replace: true });
            }}
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Same period selector as 概览 (filters by order date). */}
      <PeriodPicker
        preset={range}
        from={from}
        to={to}
        onPreset={chooseRange}
        onCustomChange={(f, t) => {
          const next = new URLSearchParams(params);
          next.set('range', 'custom');
          next.set('from', f);
          next.set('to', t);
          next.delete('page');
          setParams(next, { replace: true });
        }}
      />

      {error && <p className="error">加载失败：{error.message}</p>}
      {!data && loading && <p className="muted">加载中…</p>}

      {data && (
        <p className="sort-note muted small">
          共 {data.total} 笔交易 · 实付合计 <strong>{money(data.totals.CNY, 'CNY')}</strong> / <strong>{money(data.totals.CAD, 'CAD')}</strong>
          {filtered && '（按当前筛选）'}
          {pages > 1 && ` · 第 ${page} / ${pages} 页，每页 ${data.pageSize} 笔`}
        </p>
      )}

      {data && data.rows.length === 0 && <p className="empty">{filtered ? '没有符合条件的交易。' : '还没有交易记录。'}</p>}
      {data && data.rows.length > 0 && (
        <div className={`table-wrap${loading ? ' is-refreshing' : ''}`}>
          <table className="data-table tx-table">
            <thead>
              <tr>
                <th>订货日期</th>
                <th>客户</th>
                <th>币种</th>
                <th>商品</th>
                <th className="num">原价</th>
                <th className="num">折扣</th>
                <th className="num">实付金额</th>
                <th>备注</th>
                <th className="num">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{dateZh(t.orderDate)}</td>
                  <td>
                    <Link to={`/admin/customers/${t.userId}`} className="strong-link">
                      {t.userName}
                    </Link>
                    {t.userStatus === 'disabled' && <span className="pill">已停用</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${t.currency}`}>{CURRENCY_LABEL[t.currency]}</span>
                  </td>
                  <td className="small">{itemsSummary(t)}</td>
                  <td className="num">{t.subtotal != null ? money(t.subtotal, t.currency) : '—'}</td>
                  <td className="num">{t.discountRate ? formatRate(t.discountRate) : '—'}</td>
                  <td className="num">
                    <strong>{money(t.amount, t.currency)}</strong>
                  </td>
                  <td className="small muted">{t.note || '—'}</td>
                  <td className="num nowrap">
                    <button className="link-button" onClick={() => setMode({ kind: 'edit', tx: t })}>
                      修改
                    </button>{' '}
                    <button className="link-button danger" onClick={() => remove(t)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="pager">
          <button className="btn" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
            上一页
          </button>
          <span className="muted small">
            第 {page} / {pages} 页
          </span>
          <button className="btn" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
            下一页
          </button>
        </div>
      )}
    </>
  );
}

/** "大鹅威代尔白冰酒 375ml ×24；礼盒礼袋 ×24 等 3 项" */
function itemsSummary(t: TransactionListItem): string {
  if (t.items.length === 0) return '—';
  const shown = t.items.slice(0, 2).map((i) => `${i.name} ×${i.qty}`).join('；');
  return t.items.length > 2 ? `${shown} 等 ${t.items.length} 项` : shown;
}

/** Step 1: choose the customer who placed the order. Step 2: the usual transaction form. */
function NewTransaction({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [customer, setCustomer] = useState<AdminUserListItem | null>(null);
  return (
    <div className="tx-panel">
      {customer ? (
        <>
          <p className="tx-panel-customer">
            下单客户：<strong>{customer.name}</strong>
            {customer.phone && <span className="muted"> {formatPhone(customer.phone)}</span>}
            {customer.company && <span className="muted"> · {customer.company}</span>}
            <button className="link-button" onClick={() => setCustomer(null)}>
              更换客户
            </button>
          </p>
          <TransactionForm key={customer.id} userId={customer.id} onSaved={onSaved} onCancel={onCancel} />
        </>
      ) : (
        <CustomerPicker onPick={setCustomer} onCancel={onCancel} />
      )}
    </div>
  );
}

function CustomerPicker({ onPick, onCancel }: { onPick: (c: AdminUserListItem) => void; onCancel: () => void }) {
  const { data, error } = useApi<AdminUserListItem[]>('/admin/users');
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/[\s\-()+]/g, '');
    return (data ?? [])
      .filter(
        (u) =>
          !needle ||
          [u.name, u.email ?? '', u.wechat, u.company].join(' ').toLowerCase().includes(needle) ||
          (digits !== '' && /^\d+$/.test(digits) && (u.phone ?? '').includes(digits)),
      )
      .slice(0, 8);
  }, [data, q]);

  return (
    <div className="card tx-form customer-picker">
      <h3 className="sub-title first">新增交易 · 第 1 步：选择下单客户</h3>
      <input
        className="input"
        type="search"
        autoFocus
        placeholder="输入客户姓名、手机、邮箱、微信或公司搜索…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="搜索下单客户"
      />
      {error && <p className="error">加载客户失败：{error.message}</p>}
      {data && (
        <ul className="picker-list">
          {matches.map((u) => (
            <li key={u.id}>
              <button type="button" className="picker-item" onClick={() => onPick(u)}>
                <strong>{u.name}</strong>
                {u.status === 'disabled' && <span className="pill">已停用</span>}
                <span className="muted small">
                  {[u.phone ? formatPhone(u.phone) : '', u.email ?? '', u.company].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="muted small">没有找到客户。</li>}
        </ul>
      )}
      <p className="muted small">
        新客户？请先到 <Link to="/admin/customers">客户</Link> 点“+ 新增客户”。
      </p>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}

