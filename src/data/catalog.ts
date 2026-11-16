import type { Product } from '../types';
import { CATEGORIES, PRODUCTS } from './products';

// Every photo in src/data/photos/, bundled by Vite: file name -> final URL.
const PHOTO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.slice('./photos/'.length), url]),
);

function toProduct({ photos, category, ...p }: (typeof PRODUCTS)[number]): Product {
  const images = photos.flatMap((file, i) => {
    const url = PHOTO_URLS[file];
    if (!url) console.warn(`[photos] No.${p.catalogNo}: ${file} not found in src/data/photos/`);
    return url ? [{ id: i, url }] : [];
  });
  return { ...p, id: p.catalogNo, categoryName: category || null, imageUrl: images[0]?.url ?? null, images };
}

/** All products, in the order of src/data/products.ts. */
export const ALL_PRODUCTS: Product[] = PRODUCTS.map(toProduct);

export function findProduct(id: string | undefined): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.id === id);
}

/** Position of a category in the filter list (unknown categories go last). */
export function categoryRank(name: string): number {
  const i = CATEGORIES.indexOf(name);
  return i < 0 ? CATEGORIES.length : i;
}
