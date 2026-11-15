import type { Category, Product, ProductImage, ProductInput, ProductStatus, SpecItem } from '../../shared/types';
import { db } from '../db';

interface ProductRow {
  id: number;
  catalog_no: string;
  name_zh: string;
  name_en: string;
  winery: string;
  vintage: string;
  volume: string;
  category_id: number | null;
  category_name: string | null;
  price_cad_cents: number;
  price_cny_cents: number;
  gift_box_cad_cents: number | null;
  gift_box_cny_cents: number | null;
  tasting_notes: string;
  style_label: string;
  style_description: string;
  serving_temp: string;
  pairing: string;
  specs_json: string;
  awards_json: string;
  status: ProductStatus;
  updated_at: string;
}

const fromCents = (c: number) => c / 100;

function toProduct(r: ProductRow, images: ProductImage[]): Product {
  const hasGiftBox = r.gift_box_cad_cents != null && r.gift_box_cny_cents != null;
  return {
    id: r.id,
    catalogNo: r.catalog_no,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    winery: r.winery,
    vintage: r.vintage,
    volume: r.volume,
    categoryId: r.category_id,
    categoryName: r.category_name,
    price: { CAD: fromCents(r.price_cad_cents), CNY: fromCents(r.price_cny_cents) },
    giftBox: hasGiftBox
      ? { CAD: fromCents(r.gift_box_cad_cents!), CNY: fromCents(r.gift_box_cny_cents!) }
      : null,
    tastingNotes: r.tasting_notes,
    styleLabel: r.style_label,
    styleDescription: r.style_description,
    servingTemp: r.serving_temp,
    pairing: r.pairing,
    specs: JSON.parse(r.specs_json) as SpecItem[],
    awards: JSON.parse(r.awards_json) as string[],
    imageUrl: images[0]?.url ?? null,
    images,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

const SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

/** Photos per product, in display order (one query for all products). */
function imagesByProduct(productId?: number): Map<number, ProductImage[]> {
  const rows = (
    productId == null
      ? db.prepare('SELECT id, product_id, path FROM product_images ORDER BY product_id, sort_order, id').all()
      : db.prepare('SELECT id, product_id, path FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(productId)
  ) as { id: number; product_id: number; path: string }[];
  const map = new Map<number, ProductImage[]>();
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push({ id: r.id, url: `/uploads/${r.path}` });
    map.set(r.product_id, list);
  }
  return map;
}

/**
 * Products are shown in catalog-number order: all-digit numbers by value (01, 03, 6, 14, 100),
 * then other codes alphabetically (A12…), then products without a number.
 * (The old products.sort_order column is no longer used.)
 */
const BY_CATALOG_NO = `
  ORDER BY
    (p.catalog_no = '') ASC,
    (p.catalog_no GLOB '*[^0-9]*') ASC,
    CAST(p.catalog_no AS INTEGER) ASC,
    p.catalog_no ASC,
    p.id ASC`;

export function listProducts(opts: { includeHidden?: boolean } = {}): Product[] {
  const where = opts.includeHidden ? '' : `WHERE p.status = 'active'`;
  const rows = db.prepare(`${SELECT} ${where} ${BY_CATALOG_NO}`).all() as unknown as ProductRow[];
  const images = imagesByProduct();
  return rows.map((r) => toProduct(r, images.get(r.id) ?? []));
}

export function getProduct(id: number, opts: { includeHidden?: boolean } = {}): Product | null {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as unknown as ProductRow | undefined;
  if (!row) return null;
  if (row.status !== 'active' && !opts.includeHidden) return null;
  return toProduct(row, imagesByProduct(id).get(id) ?? []);
}

export function listCategories(): Category[] {
  const rows = db.prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order, id').all() as {
    id: number;
    name: string;
    sort_order: number;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
}

/** "06" and "6" are the same number; "A12" and "a12" the same code. */
function normalizeCatalogNo(no: string): string {
  const t = no.trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t.toLowerCase();
}

/**
 * The product (active or hidden) already using this catalog number, if any.
 * A blank number never conflicts.
 */
export function findCatalogNoConflict(catalogNo: string, exceptId = 0): { id: number; name: string } | null {
  if (!catalogNo.trim()) return null;
  const want = normalizeCatalogNo(catalogNo);
  const rows = db.prepare(`SELECT id, name_zh, catalog_no FROM products WHERE catalog_no <> '' AND id <> ?`).all(exceptId) as {
    id: number;
    name_zh: string;
    catalog_no: string;
  }[];
  const hit = rows.find((r) => normalizeCatalogNo(r.catalog_no) === want);
  return hit ? { id: hit.id, name: hit.name_zh } : null;
}

// ---------- Admin writes ----------

const cents = (n: number) => Math.round(n * 100);

function productParams(p: ProductInput) {
  return [
    p.catalogNo, p.nameZh, p.nameEn, p.winery, p.vintage, p.volume, p.categoryId,
    cents(p.price.CAD), cents(p.price.CNY),
    p.giftBox ? cents(p.giftBox.CAD) : null, p.giftBox ? cents(p.giftBox.CNY) : null,
    p.tastingNotes, p.styleLabel, p.styleDescription, p.servingTemp, p.pairing,
    JSON.stringify(p.specs), JSON.stringify(p.awards), p.status,
  ];
}

export function createProduct(p: ProductInput): number {
  const r = db
    .prepare(
      `INSERT INTO products (
         catalog_no, name_zh, name_en, winery, vintage, volume, category_id,
         price_cad_cents, price_cny_cents, gift_box_cad_cents, gift_box_cny_cents,
         tasting_notes, style_label, style_description, serving_temp, pairing,
         specs_json, awards_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(...productParams(p));
  return Number(r.lastInsertRowid);
}

export function updateProduct(id: number, p: ProductInput): boolean {
  const r = db
    .prepare(
      `UPDATE products SET
         catalog_no = ?, name_zh = ?, name_en = ?, winery = ?, vintage = ?, volume = ?, category_id = ?,
         price_cad_cents = ?, price_cny_cents = ?, gift_box_cad_cents = ?, gift_box_cny_cents = ?,
         tasting_notes = ?, style_label = ?, style_description = ?, serving_temp = ?, pairing = ?,
         specs_json = ?, awards_json = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(...productParams(p), id);
  return Number(r.changes) > 0;
}

/** Delete a product (its photo rows cascade). Returns its photo paths so the files can be removed, or null if not found. */
export function deleteProduct(id: number): string[] | null {
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) return null;
  const paths = productImagePaths(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return paths;
}

// ---------- Photos ----------

export function productImagePaths(productId: number): string[] {
  return (db.prepare('SELECT path FROM product_images WHERE product_id = ?').all(productId) as { path: string }[]).map((r) => r.path);
}

export function countProductImages(productId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(productId) as { n: number }).n;
}

const touchProduct = (id: number) => db.prepare(`UPDATE products SET updated_at = datetime('now') WHERE id = ?`).run(id);

/** Append a photo after the existing ones. Returns false if that file is already linked somewhere. */
export function addProductImage(productId: number, path: string): boolean {
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM product_images WHERE product_id = ?')
    .get(productId) as { next: number };
  const r = db.prepare('INSERT OR IGNORE INTO product_images (product_id, path, sort_order) VALUES (?, ?, ?)').run(productId, path, next);
  touchProduct(productId);
  return Number(r.changes) > 0;
}

/** Remove one photo of a product. Returns its path (to delete the file), or null if not found. */
export function deleteProductImage(productId: number, imageId: number): string | null {
  const row = db.prepare('SELECT path FROM product_images WHERE id = ? AND product_id = ?').get(imageId, productId) as
    | { path: string }
    | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);
  touchProduct(productId);
  return row.path;
}

/** Set the display order. `ids` must be exactly this product's photo ids; the first becomes the main photo. */
export function reorderProductImages(productId: number, ids: number[]): boolean {
  const current = (db.prepare('SELECT id FROM product_images WHERE product_id = ?').all(productId) as { id: number }[]).map((r) => r.id);
  const same = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
  if (!same) return false;
  const update = db.prepare('UPDATE product_images SET sort_order = ? WHERE id = ?');
  ids.forEach((id, i) => update.run(i, id));
  touchProduct(productId);
  return true;
}

export function isImageInUse(imagePath: string): boolean {
  return !!db.prepare('SELECT 1 FROM product_images WHERE path = ?').get(imagePath);
}

export function createCategory(name: string, sortOrder: number): number {
  return Number(db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder).lastInsertRowid);
}

export function updateCategory(id: number, name: string, sortOrder: number): boolean {
  return Number(db.prepare('UPDATE categories SET name = ?, sort_order = ? WHERE id = ?').run(name, sortOrder, id).changes) > 0;
}

export function deleteCategory(id: number): boolean {
  return Number(db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes) > 0;
}

export function categoryExists(id: number): boolean {
  return !!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id);
}

export function categoryNameTaken(name: string, exceptId = 0): boolean {
  return !!db.prepare('SELECT 1 FROM categories WHERE name = ? AND id <> ?').get(name, exceptId);
}
