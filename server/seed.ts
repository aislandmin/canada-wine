import fs from 'node:fs';
import { PRODUCT_IMAGE_DIR } from './config';
import { db, tx } from './db';
import { addProductImage, countProductImages, isImageInUse } from './repo/products';
import { MAX_PRODUCT_IMAGES } from '../shared/types';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seedData';

const toCents = (n: number) => Math.round(n * 100);
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Populate an empty database with the initial catalog. Safe to call on every start. */
export function seedIfEmpty(): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number };
  if (n > 0) return;

  tx(() => {
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)');
    SEED_CATEGORIES.forEach((name, i) => insCat.run(name, i));
    const catId = new Map(
      (db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]).map((r) => [r.name, r.id]),
    );

    const ins = db.prepare(`
      INSERT INTO products (
        catalog_no, name_zh, name_en, winery, vintage, volume, category_id,
        price_cad_cents, price_cny_cents, gift_box_cad_cents, gift_box_cny_cents,
        tasting_notes, style_label, style_description, serving_temp, pairing,
        specs_json, awards_json, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    SEED_PRODUCTS.forEach((p, i) => {
      ins.run(
        p.catalogNo, p.nameZh, p.nameEn, p.winery, p.vintage, p.volume, catId.get(p.category) ?? null,
        toCents(p.price.CAD), toCents(p.price.CNY),
        p.giftBox ? toCents(p.giftBox.CAD) : null, p.giftBox ? toCents(p.giftBox.CNY) : null,
        p.tastingNotes, p.styleLabel, p.styleDescription, p.servingTemp, p.pairing,
        JSON.stringify(p.specs), JSON.stringify(p.awards), i,
      );
    });
  });
  console.log(`[seed] inserted ${SEED_PRODUCTS.length} products`);
}

/**
 * Link photos placed by hand in the product photo folder, named after the catalog number:
 *   06.jpg (main photo), 06-2.jpg, 06-3.jpg, …  ("6.jpg" also works for No.06)
 * Files are used in place, not copied. A file that is already linked is skipped, so this is
 * safe to run on every start; new files are added after a product's existing photos.
 */
export function linkProductImages(): void {
  const files = fs.readdirSync(PRODUCT_IMAGE_DIR);
  if (files.length === 0) return;

  // Parse "<number>[-<n>].<ext>" names; ignore everything else (e.g. admin uploads "p6-ab12cd.jpg").
  const named = files
    .map((file) => {
      const m = /^(\d+)(?:-(\d+))?(\.[a-z]+)$/i.exec(file);
      if (!m || !IMAGE_EXTS.includes(m[3].toLowerCase())) return null;
      return { file, catalog: Number(m[1]), seq: m[2] ? Number(m[2]) : 1 };
    })
    .filter((x): x is { file: string; catalog: number; seq: number } => x !== null)
    .sort((a, b) => a.catalog - b.catalog || a.seq - b.seq);
  if (named.length === 0) return;

  const products = db.prepare(`SELECT id, catalog_no FROM products WHERE catalog_no <> '' ORDER BY id`).all() as {
    id: number;
    catalog_no: string;
  }[];
  for (const { id, catalog_no } of products) {
    if (!/^\d+$/.test(catalog_no)) continue;
    for (const n of named.filter((x) => x.catalog === Number(catalog_no))) {
      const rel = `products/${n.file}`;
      if (isImageInUse(rel)) continue;
      if (countProductImages(id) >= MAX_PRODUCT_IMAGES) break;
      if (addProductImage(id, rel)) console.log(`[images] linked ${n.file} -> product No.${catalog_no}`);
    }
  }
}
