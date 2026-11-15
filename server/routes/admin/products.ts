import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { MAX_PRODUCT_IMAGES, type Money, type ProductInput, type SpecItem } from '../../../shared/types';
import { PRODUCT_IMAGE_DIR, UPLOAD_DIR } from '../../config';
import { HttpError, idParam, num, str } from '../../http';
import {
  categoryExists,
  categoryNameTaken,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  findCatalogNoConflict,
  getProduct,
  isImageInUse,
  listCategories,
  listProducts,
  addProductImage,
  countProductImages,
  deleteProductImage,
  reorderProductImages,
  updateCategory,
  updateProduct,
} from '../../repo/products';

export const adminProductsRouter = Router();

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function money(body: unknown, key: string, label: string): Money {
  const m = (body as Record<string, unknown>)?.[key];
  return {
    CAD: num(m, 'CAD', { min: 0, max: 1_000_000, label: `${label}（加币）` }),
    CNY: num(m, 'CNY', { min: 0, max: 10_000_000, label: `${label}（人民币）` }),
  };
}

function parseProduct(body: unknown): ProductInput {
  const nameZh = str(body, 'nameZh', 120);
  if (!nameZh) throw new HttpError(400, '请填写中文名称');

  const rawCat = (body as { categoryId?: unknown }).categoryId;
  const categoryId = rawCat == null || rawCat === '' ? null : Number(rawCat);
  if (categoryId != null && (!Number.isInteger(categoryId) || !categoryExists(categoryId)))
    throw new HttpError(400, '分类不存在');

  const giftRaw = (body as { giftBox?: unknown }).giftBox;
  const giftBox = giftRaw == null ? null : money(body, 'giftBox', '礼盒价格');

  const specsRaw = (body as { specs?: unknown }).specs ?? [];
  if (!Array.isArray(specsRaw) || specsRaw.length > 40) throw new HttpError(400, '技术参数格式不正确');
  const specs: SpecItem[] = specsRaw
    .map((s) => ({ label: str(s, 'label', 40), value: str(s, 'value', 200) }))
    .filter((s) => s.label || s.value);

  const awardsRaw = (body as { awards?: unknown }).awards ?? [];
  if (!Array.isArray(awardsRaw) || awardsRaw.length > 40) throw new HttpError(400, '获奖信息格式不正确');
  const awards = awardsRaw
    .map((a) => {
      if (typeof a !== 'string') throw new HttpError(400, '获奖信息格式不正确');
      return a.trim().slice(0, 200);
    })
    .filter(Boolean);

  const status = str(body, 'status', 10);
  if (status !== 'active' && status !== 'hidden') throw new HttpError(400, '状态不正确');

  return {
    catalogNo: str(body, 'catalogNo', 20),
    nameZh,
    nameEn: str(body, 'nameEn', 160),
    winery: str(body, 'winery', 120),
    vintage: str(body, 'vintage', 20),
    volume: str(body, 'volume', 20),
    categoryId,
    price: money(body, 'price', '价格'),
    giftBox,
    tastingNotes: str(body, 'tastingNotes', 3000),
    styleLabel: str(body, 'styleLabel', 60),
    styleDescription: str(body, 'styleDescription', 300),
    servingTemp: str(body, 'servingTemp', 60),
    pairing: str(body, 'pairing', 200),
    specs,
    awards,
    status,
  };
}

/** Remove an uploaded photo file if no product uses it any more. */
function removeImageFile(imagePath: string | null): void {
  if (!imagePath || isImageInUse(imagePath)) return;
  const full = path.resolve(UPLOAD_DIR, imagePath);
  if (!full.startsWith(path.resolve(PRODUCT_IMAGE_DIR) + path.sep)) return; // stay inside the photo folder
  try {
    // Synchronous so the file is gone before we reply (photos are small; this is quick).
    fs.rmSync(full, { force: true });
  } catch (err) {
    console.error('[images] could not delete file', full, err); // the database row is already gone
  }
}

/** Detect the real image type from its first bytes (don't trust the browser's Content-Type). */
function sniffImage(buf: Buffer): '.jpg' | '.png' | '.webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

// ---------- Products ----------

adminProductsRouter.get('/products', (_req, res) => {
  res.json(listProducts({ includeHidden: true }));
});

adminProductsRouter.get('/products/:id', (req, res) => {
  const p = getProduct(idParam(req.params.id), { includeHidden: true });
  if (!p) throw new HttpError(404, '产品不存在');
  res.json(p);
});

/** Catalog numbers must be unique (they set the display order); blank is allowed. */
function assertCatalogNoFree(catalogNo: string, exceptId = 0) {
  const clash = findCatalogNoConflict(catalogNo, exceptId);
  if (clash) throw new HttpError(409, `编号 ${catalogNo.trim()} 已被「${clash.name}」使用，请换一个编号`);
}

adminProductsRouter.post('/products', (req, res) => {
  const input = parseProduct(req.body);
  assertCatalogNoFree(input.catalogNo);
  const id = createProduct(input);
  res.status(201).json(getProduct(id, { includeHidden: true }));
});

adminProductsRouter.put('/products/:id', (req, res) => {
  const id = idParam(req.params.id);
  if (!getProduct(id, { includeHidden: true })) throw new HttpError(404, '产品不存在');
  const input = parseProduct(req.body);
  assertCatalogNoFree(input.catalogNo, id);
  updateProduct(id, input);
  res.json(getProduct(id, { includeHidden: true }));
});

adminProductsRouter.delete('/products/:id', (req, res) => {
  const paths = deleteProduct(idParam(req.params.id));
  if (paths === null) throw new HttpError(404, '产品不存在');
  paths.forEach(removeImageFile);
  res.json({ ok: true });
});

// ---------- Photos ----------

function productOr404(id: number) {
  if (!getProduct(id, { includeHidden: true })) throw new HttpError(404, '产品不存在');
}

/** Add a photo (appended after existing ones). The request body is the raw image (Content-Type: image/*). */
adminProductsRouter.post(
  '/products/:id/images',
  express.raw({ type: 'image/*', limit: MAX_IMAGE_BYTES }),
  (req, res) => {
    const id = idParam(req.params.id);
    productOr404(id);
    if (countProductImages(id) >= MAX_PRODUCT_IMAGES) throw new HttpError(400, `每个产品最多 ${MAX_PRODUCT_IMAGES} 张图片`);
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, '请选择图片');
    const ext = sniffImage(buf);
    if (!ext) throw new HttpError(400, '只支持 JPG、PNG、WebP 格式的图片');

    const name = `p${id}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(PRODUCT_IMAGE_DIR, name), buf);
    addProductImage(id, `products/${name}`);
    res.json(getProduct(id, { includeHidden: true }));
  },
);

adminProductsRouter.delete('/products/:id/images/:imageId', (req, res) => {
  const id = idParam(req.params.id);
  productOr404(id);
  const removed = deleteProductImage(id, idParam(req.params.imageId));
  if (removed === null) throw new HttpError(404, '图片不存在');
  removeImageFile(removed);
  res.json(getProduct(id, { includeHidden: true }));
});

/** Body: { ids: [...] } — all of this product's photo ids in the new order; the first is the main photo. */
adminProductsRouter.put('/products/:id/images/order', (req, res) => {
  const id = idParam(req.params.id);
  productOr404(id);
  const ids = (req.body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) throw new HttpError(400, '图片顺序格式不正确');
  if (!reorderProductImages(id, ids as number[])) throw new HttpError(409, '图片列表已变化，请刷新页面后再试');
  res.json(getProduct(id, { includeHidden: true }));
});

// ---------- Categories ----------

adminProductsRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

adminProductsRouter.post('/categories', (req, res) => {
  const name = str(req.body, 'name', 30);
  if (!name) throw new HttpError(400, '请填写分类名称');
  if (categoryNameTaken(name)) throw new HttpError(409, '该分类已存在');
  const id = createCategory(name, num(req.body, 'sortOrder', { int: true, min: -1000, max: 1000, label: '排序' }));
  res.status(201).json({ id });
});

adminProductsRouter.put('/categories/:id', (req, res) => {
  const id = idParam(req.params.id);
  const name = str(req.body, 'name', 30);
  if (!name) throw new HttpError(400, '请填写分类名称');
  if (categoryNameTaken(name, id)) throw new HttpError(409, '该分类已存在');
  if (!updateCategory(id, name, num(req.body, 'sortOrder', { int: true, min: -1000, max: 1000, label: '排序' })))
    throw new HttpError(404, '分类不存在');
  res.json({ ok: true });
});

/** Products in a deleted category become uncategorised (they are not deleted). */
adminProductsRouter.delete('/categories/:id', (req, res) => {
  if (!deleteCategory(idParam(req.params.id))) throw new HttpError(404, '分类不存在');
  res.json({ ok: true });
});
