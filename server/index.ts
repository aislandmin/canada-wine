import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { loadUser, purgeExpiredSessions } from './auth';
import { DIST_DIR, HOST, PORT, TRUST_PROXY, UPLOAD_DIR } from './config';
import { migrate } from './db';
import { HttpError, requireJson } from './http';
import { accountRouter } from './routes/account';
import { adminRouter } from './routes/admin/index';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { linkProductImages, seedIfEmpty } from './seed';

migrate();
seedIfEmpty();
linkProductImages();
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60_000).unref();

const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use('/api', express.json({ limit: '1mb' }), requireJson, loadUser, (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, '接口不存在')));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', fallthrough: false }));

// Production: serve the built React app, with client-side routing fallback.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
  if (status === 404) {
    res.status(404).end();
    return;
  }
  if (status === 400 && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: '请求格式不正确' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: '服务器错误，请稍后再试' });
};
app.use(onError);

app.listen(PORT, HOST as string, () => {
  console.log(`[server] http://${HOST ?? 'localhost'}:${PORT}`);
});
