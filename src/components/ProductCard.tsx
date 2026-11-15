import { Link } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { money } from '../format';
import BottleImage from './BottleImage';

export default function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link to={`/products/${p.id}`} className="product-card">
      <div className="product-card-media">
        <BottleImage product={p} />
        {p.catalogNo && <span className="catalog-no">No.{p.catalogNo}</span>}
        {p.categoryName && <span className="tag">{p.categoryName}</span>}
      </div>
      <div className="product-card-body">
        <p className="winery">{p.winery}</p>
        <h3 className="name-zh">{p.nameZh}</h3>
        <p className="name-en">{p.nameEn}</p>
        <p className="meta">{[p.vintage && `${p.vintage} 年份`, p.volume].filter(Boolean).join(' · ')}</p>
        {/* Pinned to the bottom of the card so prices line up across a row. */}
        <div className="card-foot">
          {p.awards.length > 0 && <p className="awards-count">荣获 {p.awards.length} 项国际奖项</p>}
          <div className="price-row">
            <span className="price">{money(p.price.CAD, 'CAD')}</span>
            <span className="price-sep">/</span>
            <span className="price">{money(p.price.CNY, 'CNY')}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
