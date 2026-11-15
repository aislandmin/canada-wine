import { useState } from 'react';
import type { Product } from '../../shared/types';

interface Palette {
  glass: string;
  label: string;
  capsule: string;
}

function paletteFor(p: Product): Palette {
  const text = `${p.categoryName ?? ''}${p.nameZh}`;
  if (text.includes('晚收') && text.includes('红')) return { glass: '#b0503a', label: '#fbf3e6', capsule: '#7a2d22' };
  if (text.includes('冰') || text.includes('晚收') || text.includes('白'))
    return { glass: '#c99436', label: '#fdf7e8', capsule: '#3b2a17' };
  return { glass: '#2f0c15', label: '#efe3d0', capsule: '#4a4a4a' };
}

/** Bottle silhouette used until a real photo is uploaded. Width follows bottle size. */
function BottlePlaceholder({ product }: { product: Product }) {
  const { glass, label, capsule } = paletteFor(product);
  const v = product.volume.toLowerCase();
  const isLarge = /\d\s*l\b/.test(v) && !v.includes('ml');
  const isSmall = v.includes('375') || v.includes('500');
  const w = isLarge ? 78 : isSmall ? 40 : 54;
  const cx = 60;
  const l = cx - w / 2;
  const r = cx + w / 2;
  const neck = isLarge ? 11 : 8;
  const shoulderY = isSmall ? 130 : 110;

  return (
    <svg viewBox="0 0 120 320" className="bottle-svg" role="img" aria-label={product.nameZh}>
      <rect x={cx - neck - 1} y={18} width={(neck + 1) * 2} height={34} rx={3} fill={capsule} />
      <path
        d={`M${cx - neck} 50 L${cx - neck} ${shoulderY - 30}
            C${cx - neck} ${shoulderY - 8} ${l} ${shoulderY - 10} ${l} ${shoulderY + 20}
            L${l} 300 Q${l} 308 ${l + 8} 308 L${r - 8} 308 Q${r} 308 ${r} 300
            L${r} ${shoulderY + 20}
            C${r} ${shoulderY - 10} ${cx + neck} ${shoulderY - 8} ${cx + neck} ${shoulderY - 30} Z`}
        fill={glass}
      />
      <path d={`M${l + 6} ${shoulderY + 30} L${l + 6} 290`} stroke="#fff" strokeOpacity={0.18} strokeWidth={4} strokeLinecap="round" />
      <rect x={l + 5} y={shoulderY + 70} width={w - 10} height={78} rx={3} fill={label} />
      <text x={cx} y={shoulderY + 104} textAnchor="middle" fontSize={isSmall ? 11 : 13} fill={capsule} fontWeight={700}>
        {product.catalogNo}
      </text>
      <text x={cx} y={shoulderY + 124} textAnchor="middle" fontSize={8} fill={capsule}>
        {product.vintage}
      </text>
    </svg>
  );
}

export default function BottleImage({ product, className = '' }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`bottle-image ${className}`}>
      {product.imageUrl && !failed ? (
        <img src={product.imageUrl} alt={product.nameZh} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <BottlePlaceholder product={product} />
      )}
    </div>
  );
}
