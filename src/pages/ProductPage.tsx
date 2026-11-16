import { Link, useParams } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import { findProduct } from '../data/catalog';

export default function ProductPage() {
  const { id } = useParams();
  const p = findProduct(id);

  if (!p)
    return (
      <div className="container empty page-pad">
        <p>该产品不存在。</p>
        <Link to="/" className="btn btn-ghost">
          返回产品目录
        </Link>
      </div>
    );

  const style = [
    { label: '风格', value: [p.styleLabel, p.styleDescription].filter(Boolean).join(' — ') },
    { label: '饮用温度', value: p.servingTemp },
    { label: '建议配食', value: p.pairing },
  ].filter((r) => r.value);

  return (
    <article className="container product-detail page-pad">
      <nav className="breadcrumb" aria-label="面包屑">
        <Link to="/">全部产品</Link>
        {p.categoryName && (
          <>
            <span aria-hidden="true">›</span>
            <Link to={`/?cat=${encodeURIComponent(p.categoryName)}`}>{p.categoryName}</Link>
          </>
        )}
      </nav>

      <div className="detail-grid">
        <div className="detail-media-wrap">
          <ProductGallery product={p} />
        </div>

        <div className="detail-info">
          <p className="winery">
            {p.winery}
            {p.catalogNo && <span className="catalog-inline">No.{p.catalogNo}</span>}
          </p>
          <h1 className="detail-title">{p.nameZh}</h1>
          <p className="name-en">{p.nameEn}</p>
          <p className="meta">{[p.vintage && `${p.vintage} 年份`, p.volume].filter(Boolean).join(' · ')}</p>

          {p.tastingNotes && (
            <section>
              <h2 className="sub-title">品酒笔记</h2>
              <p className="notes">{p.tastingNotes}</p>
            </section>
          )}

          {style.length > 0 && (
            <section>
              <h2 className="sub-title">风格特点</h2>
              <dl className="spec-list">
                {style.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.specs.length > 0 && (
            <section>
              <h2 className="sub-title">技术参数</h2>
              <dl className="spec-list">
                {p.specs.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.awards.length > 0 && (
            <section>
              <h2 className="sub-title">获得奖项</h2>
              <ul className="awards">
                {p.awards.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
