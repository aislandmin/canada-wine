import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../types';
import BottleImage from './BottleImage';

/** Horizontal swipe detection for touch screens (WeChat on phones). */
function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)();
    },
  };
}

/**
 * Product photos: a large photo, thumbnails underneath, swipe/arrows to change,
 * tap to view full-screen. Falls back to the bottle drawing when there are no photos.
 */
export default function ProductGallery({ product }: { product: Product }) {
  const images = product.images;
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;

  // Reset when navigating to another product.
  useEffect(() => {
    setIndex(0);
    setZoomed(false);
  }, [product.id]);

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);
  const swipe = useSwipe(
    () => go(1),
    () => go(-1),
  );

  if (count === 0) {
    return (
      <div className="gallery-main gallery-empty">
        <BottleImage product={product} />
      </div>
    );
  }

  const current = images[Math.min(index, count - 1)];

  return (
    <div className="gallery">
      <div className="gallery-main" {...swipe}>
        <button type="button" className="gallery-zoom" onClick={() => setZoomed(true)} aria-label="查看大图">
          <img src={current.url} alt={`${product.nameZh}（${index + 1}/${count}）`} />
        </button>
        {count > 1 && (
          <>
            <button type="button" className="gallery-arrow prev" onClick={() => go(-1)} aria-label="上一张">
              ‹
            </button>
            <button type="button" className="gallery-arrow next" onClick={() => go(1)} aria-label="下一张">
              ›
            </button>
            <span className="gallery-counter">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="产品图片">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={`gallery-thumb${i === index ? ' active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`第 ${i + 1} 张`}
              aria-current={i === index}
            >
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <Lightbox
          urls={images.map((i) => i.url)}
          index={index}
          title={product.nameZh}
          onIndex={setIndex}
          onClose={() => setZoomed(false)}
        />
      )}
    </div>
  );
}

/** Full-screen photo viewer: arrows, swipe, Esc / ← / → keys, tap outside to close. */
function Lightbox(props: { urls: string[]; index: number; title: string; onIndex: (i: number) => void; onClose: () => void }) {
  const { urls, index, onIndex, onClose } = props;
  const count = urls.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);
  const swipe = useSwipe(
    () => go(1),
    () => go(-1),
  );

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && count > 1) go(1);
      else if (e.key === 'ArrowLeft' && count > 1) go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, count]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${props.title} 大图`} onClick={onClose} {...swipe}>
      <img src={urls[index]} alt={`${props.title}（${index + 1}/${count}）`} onClick={(e) => e.stopPropagation()} />
      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      {count > 1 && (
        <>
          <button
            type="button"
            className="lightbox-arrow prev"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox-arrow next"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="下一张"
          >
            ›
          </button>
          <span className="lightbox-counter">
            {index + 1} / {count}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}
