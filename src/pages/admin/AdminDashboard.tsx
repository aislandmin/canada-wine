import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatRate } from '../../../shared/discount';
import { CURRENCIES, type AdminStats, type Currency } from '../../../shared/types';
import { useApi } from '../../api';
import BarChart from '../../components/BarChart';
import PeriodPicker, { periodLabel } from '../../components/PeriodPicker';
import { presetRange, type RangePreset } from '../../datePresets';
import { CURRENCY_LABEL, money } from '../../format';

export default function AdminDashboard() {
  const [preset, setPreset] = useState<RangePreset>('month');
  const [custom, setCustom] = useState(() => presetRange('month'));
  // 全部时间 has no dates; the server then counts every order up to today.
  const range = preset === 'all' ? { from: '', to: '' } : preset === 'custom' ? custom : presetRange(preset);
  const validRange = preset === 'all' || range.from <= range.to;
  const query = preset === 'all' ? 'all=1' : `from=${range.from}&to=${range.to}`;

  const choosePreset = (key: RangePreset) => {
    // 自定义 starts from the dates that were showing, so the boxes are never blank.
    if (key === 'custom' && preset !== 'custom') setCustom(preset === 'all' ? presetRange('month') : range);
    setPreset(key);
  };
  const { data: s, error, loading } = useApi<AdminStats>(validRange ? `/admin/stats?${query}` : null);

  return (
    <>
      <h1 className="section-title">概览</h1>

      {s && (
        <div className="stat-grid stat-grid-snapshot">
          <Stat
            label="客户总数"
            value={String(s.customers)}
            to="/admin/customers"
            sub={
              <>
                本月新增 {s.newCustomersThisMonth} ·{' '}
                {/* Opens the customer list showing only disabled accounts. */}
                <Link to="/admin/customers?status=disabled" className="stat-link">
                  已停用 {s.disabledCustomers}
                </Link>
              </>
            }
          />
          <Stat
            label="在售产品"
            value={String(s.productsActive)}
            to="/admin/products?status=active"
            sub={
              <Link to="/admin/products?status=hidden" className="stat-link">
                已下架 {s.productsHidden}
              </Link>
            }
          />
        </div>
      )}

      <PeriodPicker
        preset={preset}
        from={range.from}
        to={range.to}
        onPreset={choosePreset}
        onCustomChange={(from, to) => setCustom({ from, to })}
      />

      {error && <p className="error">加载失败：{error.message}</p>}
      {!s && loading && <p className="muted">加载中…</p>}

      {s && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <div className="summary-grid">
            {CURRENCIES.map((c) => (
              <SummaryCard key={c} currency={c} stats={s} />
            ))}
          </div>

          <section className="card admin-section">
            <h2 className="sub-title first">月度销售趋势（最近 12 个月）</h2>
            <div className="chart-grid">
              {CURRENCIES.map((c) => (
                <BarChart
                  key={c}
                  title={`${CURRENCY_LABEL[c]}销售额`}
                  format={(v) => money(v, c)}
                  bars={s.monthly.map((m) => ({
                    key: m.month,
                    label: `${Number(m.month.slice(5))}月`,
                    fullLabel: `${m.month.slice(0, 4)}年${Number(m.month.slice(5))}月`,
                    value: m.sales[c],
                    detail: `${m.orders[c]} 笔订单`,
                  }))}
                />
              ))}
            </div>
          </section>

          <section className="card admin-section">
            <h2 className="sub-title first">产品排行（前 10 名）</h2>
            <p className="muted small">
              排名规则：按本期间的<strong>销售数量（瓶）从多到少</strong>排列，加币和人民币订单的数量合并计算；数量相同时按产品名称排序。
              销售额已按每笔订单的折扣分摊（即实收金额），仅供参考，不影响排名。只显示前 10 名，完整排行可在页面底部「导出本期销售统计」中查看。
              {s.ordersWithoutItems > 0 && ` 另有 ${s.ordersWithoutItems} 笔订单未填写商品明细，未计入本表。`}
            </p>
            {s.products.length === 0 ? (
              <p className="muted">该期间没有销售。</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>产品</th>
                      <th className="num">数量</th>
                      <th className="num">销售额（加币）</th>
                      <th className="num">销售额（人民币）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts(s.products).map((p, i) => (
                      <tr key={p.key} className={p.kind !== 'product' ? 'row-secondary' : undefined}>
                        <td className="muted">{p.kind === 'product' ? i + 1 : ''}</td>
                        <td>
                          {p.kind === 'product' && p.productId ? <Link to={`/admin/products/${p.productId}`}>{p.name}</Link> : p.name}
                        </td>
                        <td className="num">{p.qty}</td>
                        <td className="num">{p.sales.CAD ? money(p.sales.CAD, 'CAD') : '—'}</td>
                        <td className="num">{p.sales.CNY ? money(p.sales.CNY, 'CNY') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card admin-section">
            <h2 className="sub-title first">客户排行（前 10 名）</h2>
            <p className="muted small">
              排名规则：按本期间的<strong>实付金额从高到低</strong>排列，加币订单和人民币订单分开排名（不换算）；金额相同时按订单数从多到少，再按客户姓名排序。只显示前 10 名，完整排行可在页面底部「导出本期销售统计」中查看。
            </p>
            <div className="chart-grid">
              {CURRENCIES.map((c) => (
                <div key={c}>
                  <h3 className="rank-title">
                    {CURRENCY_LABEL[c]}订单（{c === 'CAD' ? '$' : '¥'}）
                  </h3>
                  {s.topCustomers[c].length === 0 ? (
                    <p className="muted small">该期间没有{CURRENCY_LABEL[c]}订单。</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="rank-no">排名</th>
                            <th>客户</th>
                            <th className="num">订单数</th>
                            <th className="num">销售额</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.topCustomers[c].map((u, i) => (
                            <tr key={u.id}>
                              <td className="rank-no">{i + 1}</td>
                              <td>
                                <Link to={`/admin/customers/${u.id}`}>{u.name}</Link>
                              </td>
                              <td className="num">{u.orders} 笔</td>
                              <td className="num">
                                <strong>{money(u.sales, c)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card admin-section">
            <h2 className="sub-title first">即将升档的客户</h2>
            <p className="muted small">按今天往前两年的累计，距离下一折扣档不到 25% 的客户，适合主动联系。</p>
            {s.nearNextTier.length === 0 ? (
              <p className="muted">暂无。</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>客户</th>
                      <th>币种</th>
                      <th className="num">两年累计</th>
                      <th className="num">还差</th>
                      <th>可升至</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.nearNextTier.map((n) => (
                      <tr key={`${n.id}-${n.currency}`}>
                        <td>
                          <Link to={`/admin/customers/${n.id}`}>{n.name}</Link>
                        </td>
                        <td>{CURRENCY_LABEL[n.currency]}</td>
                        <td className="num">{money(n.total, n.currency)}</td>
                        <td className="num">{money(n.toNext, n.currency)}</td>
                        <td>{formatRate(n.nextRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <section className="card admin-section">
        <h2 className="sub-title first">导出数据（Excel 可打开）</h2>
        <ul className="export-list">
          <li>
            {validRange ? (
              <a className="btn" href={`/api/admin/export/stats.csv?${query}`}>
                导出本期销售统计
              </a>
            ) : (
              <button className="btn" disabled>
                导出本期销售统计
              </button>
            )}
            <span className="muted small">
              按上方所选统计期间：{validRange ? periodLabel(preset, range.from, range.to) : '请先选择有效的期间'}
              （汇总、完整产品排行、完整客户排行、最近 12 个月趋势）
            </span>
          </li>
          <li>
            <a className="btn" href="/api/admin/export/customers.csv">
              导出全部客户名单
            </a>
            <span className="muted small">所有客户及其两年累计、可享折扣</span>
          </li>
          <li>
            <a className="btn" href="/api/admin/export/transactions.csv">
              导出全部交易记录
            </a>
            <span className="muted small">全部时间内的交易记录</span>
          </li>
        </ul>
      </section>
    </>
  );
}

/**
 * The 10 best-selling wines, followed by the unranked rows (礼盒礼袋 / 其他), which don't
 * take a place in the top 10. The CSV export still contains every product.
 */
function topProducts(rows: AdminStats['products']): AdminStats['products'] {
  const ranked = rows.filter((p) => p.kind === 'product').slice(0, 10);
  return [...ranked, ...rows.filter((p) => p.kind !== 'product')];
}

function SummaryCard({ currency: c, stats }: { currency: Currency; stats: AdminStats }) {
  const s = stats.summary[c];
  return (
    <section className="card summary-card">
      <p className="stat-label">{CURRENCY_LABEL[c]}销售额</p>
      <p className="stat-value">{money(s.sales, c)}</p>
      <dl className="summary-list">
        <div>
          <dt>订单数</dt>
          <dd>{s.orders}</dd>
        </div>
        <div>
          <dt>下单客户</dt>
          <dd>{s.buyers}</dd>
        </div>
        <div>
          <dt>平均每单</dt>
          <dd>{s.orders ? money(s.avgOrder, c) : '—'}</dd>
        </div>
        <div>
          <dt>折扣让利</dt>
          <dd>{money(s.discountGiven, c)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** A headline number; with `to`, the number is a link to the matching list. */
function Stat({ label, value, sub, to }: { label: string; value: string; sub: ReactNode; to?: string }) {
  return (
    <div className="card stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">
        {to ? (
          <Link to={to} className="stat-value-link" title={`查看${label}`}>
            {value}
          </Link>
        ) : (
          value
        )}
      </p>
      <p className="stat-sub muted">{sub}</p>
    </div>
  );
}
