import path from 'node:path';

const ROOT = process.cwd();

/** All runtime data (database, uploaded images) lives here. Back this folder up. */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(ROOT, 'data'));
export const DB_FILE = path.join(DATA_DIR, 'app.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

/**
 * The one place all product photos live, whether dropped in by hand
 * (named by catalog number: 01.jpg, 03.jpg, ...) or uploaded from the admin page.
 */
export const PRODUCT_IMAGE_DIR = path.join(UPLOAD_DIR, 'products');

/** Built frontend (npm run build). Served by Express in production. */
export const DIST_DIR = path.join(ROOT, 'dist');

export const PORT = Number(process.env.PORT ?? 3001);

/** Set HOST=127.0.0.1 on the server so only the local reverse proxy (Caddy) can reach Node. Unset = all interfaces. */
export const HOST = process.env.HOST || undefined;

/** Set TRUST_PROXY=1 when running behind Nginx/Caddy so client IPs and HTTPS are detected. */
export const TRUST_PROXY = process.env.TRUST_PROXY === '1';

export const SESSION_COOKIE = 'cw_session';
export const SESSION_DAYS = 30;
