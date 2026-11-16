import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { ALL_PRODUCTS, categoryRank } from '../data/catalog';
import { SITE } from '../data/site';
import type { Product } from '../types';

// Categories and wineries come from the products themselves, so new ones appear automatically.
const CATEGORY_COUNTS = countBy(ALL_PRODUCTS, (p) => p.categoryName).sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]));
const WINERY_COUNTS = countBy(ALL_PRODUCTS, (p) => p.winery);

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();

  const cat = params.get('cat') ?? '';
  const winery = params.get('winery') ?? '';
  const q = params.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL_PRODUCTS.filter(
      (p) =>
        (!cat || p.categoryName === cat) &&
        (!winery || p.winery === winery) &&
        (!needle ||
          [p.nameZh, p.nameEn, p.winery, p.catalogNo, p.tastingNotes, p.styleLabel]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    );
  }, [cat, winery, q]);

  const filtered = Boolean(cat || winery || q);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{SITE.title}</h1>
          <p className="hero-subtitle">{SITE.subtitle}</p>
          <ul className="highlights">
            {SITE.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container catalog" aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="section-title">
          产品目录
        </h2>

        <div className="filters">
          <div className="chips" role="group" aria-label="按类别筛选">
            <button className={`chip${!cat ? ' active' : ''}`} onClick={() => setParam('cat', '')}>
              全部 <span>{ALL_PRODUCTS.length}</span>
            </button>
            {CATEGORY_COUNTS.map(([name, n]) => (
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
              {WINERY_COUNTS.map(([name, n]) => (
                <option key={name} value={name}>
                  {name}（{n}）
                </option>
              ))}
            </select>
          </div>
        </div>

        {visible.length === 0 && (
          <div className="empty">
            <p>{filtered ? '没有找到符合条件的产品。' : '产品即将上架，敬请期待。'}</p>
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
