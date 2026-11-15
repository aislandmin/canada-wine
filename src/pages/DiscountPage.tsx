import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatRate, tierFor, windowStart } from '../../shared/discount';
import { CURRENCIES, type AccountSummary, type Currency } from '../../shared/types';
import { useApi } from '../api';
import { useAuth } from '../auth';
import TierTables from '../components/TierTables';
import { CURRENCY_LABEL, dateZh, money, todayLocal } from '../format';
import { useSettings } from '../settings';

export default function DiscountPage() {
  const settings = useSettings();
  // A live example of the rolling window, e.g. "2024年11月15日 至 2026年11月15日".
  const today = todayLocal();
  const exampleStart = windowStart(today, settings.windowYears);

  return (
    <div className="container page-pad narrow">
      <h1 className="section-title">累计销售折扣政策</h1>
      <p className="policy-text">{settings.policyText}</p>
      <TierTables />
      <Estimator />
      <ul className="policy-notes muted">
        <li>累计金额为往前 {settings.windowYears} 年内实际支付的全部金额（含酒款、包装及礼盒礼袋）。</li>
        <li>
          统计期按日期滚动计算，首尾两天都计入：例如今天是 {dateZh(today)}，则统计 {dateZh(exampleStart)} 至 {dateZh(today)}{' '}
          的实际支付金额。
        </li>
        <li>每笔订单的折扣，按订货当天（含当天）往前 {settings.windowYears} 年内已产生订单的实付累计计算，本单不计入；同一天先下的订单可用于后下的订单。</li>
        <li>加币与人民币分别累计，按较高的一档享受折扣。</li>
      </ul>
    </div>
  );
}

/** Quick "what tier would this total reach" calculator for visitors. */
function Estimator() {
  const { tiers, windowYears } = useSettings();
  const { user } = useAuth();
  // Logged-in customers start from their real totals; visitors and admins get a blank calculator.
  const isCustomer = user?.role === 'customer';
  const { data: summary } = useApi<AccountSummary>(isCustomer ? '/account/summary' : null);

  const [currency, setCurrency] = useState<Currency>('CNY');
  const [amount, setAmount] = useState('');
  const prefilled = useRef(false);

  // Once the customer's totals arrive: pick the currency that gives them the better tier, fill it in.
  useEffect(() => {
    if (!summary || prefilled.current) return;
    prefilled.current = true;
    const by = summary.discount.byCurrency;
    const best: Currency = by.CAD.rate > by.CNY.rate ? 'CAD' : 'CNY';
    setCurrency(best);
    setAmount(String(summary.totals[best]));
  }, [summary]);

  const changeCurrency = (c: Currency) => {
    setCurrency(c);
    if (summary) setAmount(String(summary.totals[c])); // switch to their total in that currency
  };

  const total = Number(amount) || 0;
  const r = tierFor(total, tiers[currency]);
  const edited = summary != null && total !== summary.totals[currency];

  return (
    <section className="estimator" aria-labelledby="estimator-title">
      <h2 id="estimator-title" className="sub-title">
        折扣估算
      </h2>
      {summary && (
        <p className="estimator-mine">
          {edited ? '试算金额（您目前的实际累计：' : '已填入您目前的实际累计（'}
          {edited && `${money(summary.totals[currency], currency)}，`}
          统计期 {dateZh(summary.windowStart)} 至 {dateZh(summary.asOf)}），可修改金额试算。
          <Link to="/account">查看我的账户</Link>
        </p>
      )}
      <div className="estimator-row">
        <label className="field">
          <span>币种</span>
          <select className="input" value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>往前 {windowYears} 年累计金额</span>
          {/* Currency symbol follows the selected currency. */}
          <span className="money-input">
            <span className="money-input-symbol" aria-hidden="true">
              {currency === 'CAD' ? '$' : '¥'}
            </span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={`累计金额（${CURRENCY_LABEL[currency]}）`}
            />
          </span>
        </label>
      </div>
      <p className="estimator-result" aria-live="polite">
        可享折扣：<strong>{r.rate ? formatRate(r.rate) : '暂无'}</strong>
        {r.next && (
          <span className="muted">
            {' '}
            · 再累计 {money(r.toNext, currency)} 可升至 {formatRate(r.next.rate)}
          </span>
        )}
      </p>
    </section>
  );
}
