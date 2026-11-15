import { Router } from 'express';
import { requireAdmin } from '../../auth';
import { adminMiscRouter } from './misc';
import { adminProductsRouter } from './products';
import { adminUsersRouter } from './users';

/** Everything under /api/admin requires an active admin session. */
export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use(adminUsersRouter);
adminRouter.use(adminProductsRouter);
adminRouter.use(adminMiscRouter);
