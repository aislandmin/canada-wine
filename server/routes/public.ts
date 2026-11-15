import { Router } from 'express';
import { getProduct, listCategories, listProducts } from '../repo/products';
import { getSettings } from '../repo/settings';

export const publicRouter = Router();

publicRouter.get('/settings', (_req, res) => {
  res.json(getSettings());
});

publicRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

publicRouter.get('/products', (_req, res) => {
  res.json(listProducts());
});

publicRouter.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = Number.isInteger(id) ? getProduct(id) : null;
  if (!product) {
    res.status(404).json({ error: '产品不存在或已下架' });
    return;
  }
  res.json(product);
});
