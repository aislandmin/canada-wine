import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatRate } from '../../shared/discount';
import { CURRENCIES, type AccountSummary, type Currency, type Transaction } from '../../shared/types';
import { useApi } from '../api';
import { CURRENCY_LABEL, dateZh, money, todayLocal } from '../format';
import { useSettings } from '../settings';

interface Props {
  /** API path for a given as-of date. */
  path: (asOf: string) => string;
  /** Who is looking: changes a little wording. */
  audience: 'customer' | 'admin';
  /** Bump to re-fetch (e.g. after the admin saves a transaction). */
  refreshKey?: number;
  /** Extra buttons on each transaction (admin edit/delete). */
  txActions?: (t: Transaction) => ReactNode;
  /** Shown to the right of the transactions heading (admin "record transaction"). */
  txToolbar?: ReactNode;
  /** Rendered above the transaction list (admin transaction form). */
  beforeList?: ReactNode;
}

/** Totals, earned discount, date picker and transaction list for one customer. */
export default function SummaryView({ path, audience, refreshKey = 0, txActions, txToolbar, beforeList }: Props) {
  const today = todayLocal();
  const [asOf, setAsOf] = useState(today);
  const [onlyCounted, setOnlyCounted] = useState(audience === 'customer');
  const { data, error, loading, reload } = useApi<AccountSummary>(path(asOf));

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
  }, [refreshKey, reload]);

  const isToday = asOf === today;
  const list = data ? (onlyCounted ? data.transactions.filter((t) => t.counted) : data.transactions) : [];
  const who = audience === 'customer' ? '您' : '该客户';

  return (
    <>
      <section className="card as-of" aria-label="统计日期">
        <label className="form-field as-of-field">
          <span className="form-label">统计截止日期</span>
          <input
            className="input"
            type="date"
            value={asOf}
            max={today}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
          />
        </label>
        {!isToday && (
          <button className="btn btn-ghost" onClick={() => setAsOf(today)}>
            回到今天
          </button>
        )}
        {data && (
          <p className="as-of-range">
            统计期：{dateZh(data.windowStart)} 至 {dateZh(data.asOf)}（往前 {data.windowYears} 年）
          </p>
        )}
      </section>

      {error && <p className="error">加载失败：{error.message}</p>}
      {!data && loading && <p className="muted center">加载中…</p>}

      {data && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <section className="discount-hero" aria-live="polite">
            <p className="discount-hero-label">
              {/* An order is discounted on earlier orders (not itself), so this total applies to the next order. */}
              {isToday ? `${who}下次订货可享折扣` : `按截至 ${dateZh(asOf)} 的累计，之后订货可享折扣`}
            </p>
            <p className="discount-hero-rate">{data.discount.rate ? formatRate(data.discount.rate) : '暂无'}</p>
            <p className="discount-hero-note">加币与人民币分别累计，按较高的一档享受折扣；已产生的订单立即计入</p>
          </section>

          <div className="currency-cards">
            {CURRENCIES.map((c) => (
              <CurrencyCard key={c} currency={c} summary={data} />
            ))}
          </div>

          <section className="transactions" aria-labelledby="tx-title">
            <div className="transactions-head">
              <h2 id="tx-title" className="sub-title">
                交易记录
              </h2>
              <div className="transactions-tools">
                <div className="segmented" role="group" aria-label="显示范围">
                  <button className={onlyCounted ? 'active' : ''} onClick={() => setOnlyCounted(true)}>
                    统计期内（{data.transactions.filter((t) => t.counted).length}）
                  </button>
                  <button className={!onlyCounted ? 'active' : ''} onClick={() => setOnlyCounted(false)}>
                    全部（{data.transactions.length}）
                  </button>
                </div>
                {txToolbar}
              </div>
            </div>

            {beforeList}

            {list.length === 0 ? (
              <p className="empty">{data.transactions.length === 0 ? '暂无交易记录。' : '该统计期内没有交易记录。'}</p>
            ) : (
              <ul className="tx-list">
                {list.map((t) => (
                  <TransactionCard key={t.id} t={t} actions={txActions?.(t)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function TransactionCard({ t, actions }: { t: Transaction & { counted: boolean }; actions?: ReactNode }) {
  return (
    <li className={`tx${t.counted ? '' : ' tx-muted'}`}>
      <div className="tx-top">
        <span className="tx-date">{dateZh(t.orderDate)}</span>
        <span className={`badge badge-${t.currency}`}>{CURRENCY_LABEL[t.currency]}</span>
        <span className={`status ${t.counted ? 'status-in' : 'status-out'}`}>{t.counted ? '计入累计' : '不在统计期内'}</span>
        <span className="tx-amount">{money(t.amount, t.currency)}</span>
      </div>
      {t.items.length > 0 && (
        <ul className="tx-items">
          {t.items.map((it, i) => (
            <li key={i}>
              <span>{it.name}</span>
              <span className="muted">
                {money(it.unitPrice, t.currency)} × {it.qty}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(t.discountRate > 0 || t.note) && (
        <p className="tx-foot muted">
          {t.discountRate > 0 && t.subtotal != null && (
            <span>
              原价 {money(t.subtotal, t.currency)}，享 {formatRate(t.discountRate)} 折扣
            </span>
          )}
          {t.note && <span>备注：{t.note}</span>}
        </p>
      )}
      {actions && <div className="tx-actions">{actions}</div>}
    </li>
  );
}

function CurrencyCard({ currency, summary }: { currency: Currency; summary: AccountSummary }) {
  const { tiers } = useSettings();
  const r = summary.discount.byCurrency[currency];
  const prevMin = Math.max(0, ...tiers[currency].filter((t) => t.min <= r.total).map((t) => t.min));
  const pct = r.next ? Math.min(100, ((r.total - prevMin) / (r.next.min - prevMin)) * 100) : 100;

  return (
    <section className="card currency-card">
      <p className="currency-card-label">{CURRENCY_LABEL[currency]}累计</p>
      <p className="currency-card-total">{money(r.total, currency)}</p>
      <p className="currency-card-rate">
        对应折扣：<strong>{r.rate ? formatRate(r.rate) : '未达门槛'}</strong>
      </p>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="currency-card-next muted">
        {r.next ? (
          <>
            再累计 <strong>{money(r.toNext, currency)}</strong> 可升至 {formatRate(r.next.rate)}
          </>
        ) : (
          '已达最高折扣档'
        )}
      </p>
    </section>
  );
}
