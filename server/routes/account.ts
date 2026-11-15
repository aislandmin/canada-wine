import { Router } from 'express';
import { requireUser } from '../auth';
import { HttpError } from '../http';
import { accountSummary, isValidDate, today } from '../repo/transactions';

export const accountRouter = Router();
accountRouter.use(requireUser);

/** GET /api/account/summary?asOf=YYYY-MM-DD — totals, earned discount and transactions. */
accountRouter.get('/summary', (req, res) => {
  const asOf = typeof req.query.asOf === 'string' && req.query.asOf ? req.query.asOf : today();
  if (!isValidDate(asOf)) throw new HttpError(400, '日期格式不正确');
  res.json(accountSummary(req.user!.id, asOf));
});
