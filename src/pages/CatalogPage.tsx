import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { useApi } from '../api';
import ProductCard from '../components/ProductCard';
import { useSettings } from '../settings';

type SortKey = 'default' | 'price-asc' | 'price-desc';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '默认排序' },
  { key: 'price-asc', label: '价格从低到高' },
  { key: 'price-desc', label: '价格从高到低' },
];

export default function CatalogPage() {
  const settings = useSettings();
  const { data: products, error, loading } = useApi<Product[]>('/products');
  const [params, setParams] = useSearchParams();

  const cat = params.get('cat') ?? '';
  const winery = params.get('winery') ?? '';
  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey) ?? 'default';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Categories and wineries come from the products themselves, so new ones appear automatically.
  const categories = useMemo(() => countBy(products ?? [], (p) => p.categoryName), [products]);
  const wineries = useMemo(() => countBy(products ?? [], (p) => p.winery), [products]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (products ?? []).filter(
      (p) =>
        (!cat || p.categoryName === cat) &&
        (!winery || p.winery === winery) &&
        (!needle ||
          [p.nameZh, p.nameEn, p.winery, p.catalogNo, p.tastingNotes, p.styleLabel]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    );
    if (sort === 'price-asc') list.sort((a, b) => a.price.CAD - b.price.CAD);
    if (sort === 'price-desc') list.sort((a, b) => b.price.CAD - a.price.CAD);
    return list;
  }, [products, cat, winery, q, sort]);

  const filtered = Boolean(cat || winery || q);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{settings.siteTitle}</h1>
          <p className="hero-subtitle">{settings.siteSubtitle}</p>
          <ul className="highlights">
            {settings.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <Link to="/discount" className="btn btn-gold">
            查看累计折扣政策
          </Link>
        </div>
      </section>

      <section className="container catalog" aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="section-title">
          产品目录
        </h2>

        <div className="filters">
          <div className="chips" role="group" aria-label="按类别筛选">
            <button className={`chip${!cat ? ' active' : ''}`} onClick={() => setParam('cat', '')}>
              全部 <span>{products?.length ?? 0}</span>
            </button>
            {categories.map(([name, n]) => (
              <button key={name} className={`chip${cat === name ? ' active' : ''}`} onClick={() => setParam('cat', name)}>
                {name} <span>{n}</span>
              </button>
            ))}
          </div>

          <div className="filter-row">
            <input
              type="search"
              className="input"
              placeholder="搜索酒名、酒庄、风味…"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
              aria-label="搜索"
            />
            <select className="input" value={winery} onChange={(e) => setParam('winery', e.target.value)} aria-label="酒庄">
              <option value="">全部酒庄</option>
              {wineries.map(([name, n]) => (
                <option key={name} value={name}>
                  {name}（{n}）
                </option>
              ))}
            </select>
            <select
              className="input"
              value={sort}
              onChange={(e) => setParam('sort', e.target.value === 'default' ? '' : e.target.value)}
              aria-label="排序"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="muted center">加载中…</p>}
        {error && <p className="error center">产品加载失败：{error.message}</p>}
        {products && visible.length === 0 && (
          <div className="empty">
            <p>{filtered ? '没有找到符合条件的产品。' : '本月产品即将上架，敬请期待。'}</p>
            {filtered && (
              <button className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
                清除筛选
              </button>
            )}
          </div>
        )}

        <div className="product-grid">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}

function countBy(list: Product[], key: (p: Product) => string | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of list) {
    const k = key(p);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts];
}
