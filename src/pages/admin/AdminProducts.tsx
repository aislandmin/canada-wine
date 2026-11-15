import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Product } from '../../../shared/types';
import { useApi } from '../../api';
import { useFlash } from '../../components/FormBits';
import BottleImage from '../../components/BottleImage';
import { money } from '../../format';

export default function AdminProducts() {
  const { data, error, loading } = useApi<Product[]>('/admin/products');
  // The 在售/已下架 filter lives in the URL (?status=active|hidden) so the 概览 page can link
  // straight to it, and refresh / back keep it.
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status: '' | 'active' | 'hidden' = rawStatus === 'active' || rawStatus === 'hidden' ? rawStatus : '';
  const setStatus = (s: '' | 'active' | 'hidden') => {
    const next = new URLSearchParams(params);
    if (s) next.set('status', s);
    else next.delete('status');
    setParams(next, { replace: true, state: null });
  };
  const [q, setQ] = useState('');

  // "已保存「…」" / "已删除「…」" handed over by the edit page. Shown once, then cleared from
  // the history entry so a page refresh doesn't show it again.
  const location = useLocation();
  const navigate = useNavigate();
  const [flash] = useFlash((location.state as { flash?: string } | null)?.flash ?? '');
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate]);

  // Listed in catalog-number order, the same order as the home page.
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!status || p.status === status) &&
        (!needle || [p.nameZh, p.nameEn, p.winery, p.catalogNo].join(' ').toLowerCase().includes(needle)),
    );
  }, [data, status, q]);

  const total = data?.length ?? 0;
  const active = data?.filter((p) => p.status === 'active').length ?? 0;
  const filtered = Boolean(status || q.trim());

  return (
    <>
      <div className="admin-head">
        <h1 className="section-title">产品</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          + 新增产品
        </Link>
      </div>
      {flash && (
        <p className="form-success flash" role="status">
          {flash}
        </p>
      )}
      <ul className="page-tips muted small">
        <li>
          点击<strong>产品名称</strong>或右侧的<strong>「编辑」</strong>进入修改页面：修改信息和价格、上传图片、上架 / 下架。
        </li>
        <li>每月更新产品时：新品点“新增产品”；不再销售的产品改为“下架”即可，以后可以重新上架（历史交易不受影响）。</li>
      </ul>

      <div className="filter-row admin-filters">
        <input className="input" type="search" placeholder="搜索名称、酒庄、编号…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">全部</option>
          <option value="active">在售</option>
          <option value="hidden">已下架</option>
        </select>
      </div>

      {data && (
        <p className="table-count muted small">
          共 {total} 个产品 · 在售 {active} · 已下架 {total - active}
          {filtered && <strong>　当前显示 {list.length} 个</strong>}
        </p>
      )}

      {error && <p className="error">加载失败：{error.message}</p>}
      {!data && loading && <p className="muted">加载中…</p>}
      {data && list.length === 0 && <p className="empty">没有产品。</p>}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>图片</th>
                <th>编号</th>
                <th>产品</th>
                <th>分类</th>
                <th className="num">价格</th>
                <th>礼盒</th>
                <th>状态</th>
                <th className="num">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.status === 'hidden' ? 'row-muted' : undefined}>
                  <td>
                    <Link to={`/admin/products/${p.id}`} className="thumb" aria-label={`编辑 ${p.nameZh}`}>
                      <BottleImage product={p} />
                    </Link>
                  </td>
                  <td>{p.catalogNo || '—'}</td>
                  <td>
                    <Link to={`/admin/products/${p.id}`} className="strong-link">
                      {p.nameZh}
                    </Link>
                    <div className="muted small">{[p.winery, p.vintage, p.volume].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td>{p.categoryName ?? <span className="muted">未分类</span>}</td>
                  <td className="num small">
                    {money(p.price.CAD, 'CAD')}
                    <br />
                    {money(p.price.CNY, 'CNY')}
                  </td>
                  <td className="small">{p.giftBox ? `${money(p.giftBox.CAD, 'CAD')} / ${money(p.giftBox.CNY, 'CNY')}` : '—'}</td>
                  <td>
                    <span className={`pill ${p.status === 'active' ? 'pill-green' : ''}`}>{p.status === 'active' ? '在售' : '已下架'}</span>
                  </td>
                  <td className="num">
                    <Link to={`/admin/products/${p.id}`} className="btn btn-small">
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
