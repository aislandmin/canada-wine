import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_FILE, PRODUCT_IMAGE_DIR } from './config';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

/**
 * Schema migrations, applied in order. Never edit a migration that has shipped —
 * append a new one instead. Progress is tracked in PRAGMA user_version.
 */
const MIGRATIONS: string[] = [
  // 1: catalog + settings
  `
  CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_no          TEXT    NOT NULL DEFAULT '',
    name_zh             TEXT    NOT NULL,
    name_en             TEXT    NOT NULL DEFAULT '',
    winery              TEXT    NOT NULL DEFAULT '',
    vintage             TEXT    NOT NULL DEFAULT '',
    volume              TEXT    NOT NULL DEFAULT '',
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price_cad_cents     INTEGER NOT NULL CHECK (price_cad_cents >= 0),
    price_cny_cents     INTEGER NOT NULL CHECK (price_cny_cents >= 0),
    gift_box_cad_cents  INTEGER CHECK (gift_box_cad_cents >= 0),
    gift_box_cny_cents  INTEGER CHECK (gift_box_cny_cents >= 0),
    tasting_notes       TEXT    NOT NULL DEFAULT '',
    style_label         TEXT    NOT NULL DEFAULT '',
    style_description   TEXT    NOT NULL DEFAULT '',
    serving_temp        TEXT    NOT NULL DEFAULT '',
    pairing             TEXT    NOT NULL DEFAULT '',
    specs_json          TEXT    NOT NULL DEFAULT '[]',
    awards_json         TEXT    NOT NULL DEFAULT '[]',
    image_path          TEXT,
    status              TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_products_status ON products(status, sort_order);

  CREATE TABLE settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
  `,

  // 2: accounts + transactions
  `
  CREATE TABLE users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    phone          TEXT UNIQUE,                    -- normalized, e.g. +8613812345678
    email          TEXT UNIQUE COLLATE NOCASE,     -- stored lower-case
    password_hash  TEXT NOT NULL,
    name           TEXT NOT NULL,
    wechat         TEXT NOT NULL DEFAULT '',
    company        TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    admin_note     TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at  TEXT,
    CHECK (phone IS NOT NULL OR email IS NOT NULL)
  );

  CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  -- Users are never deleted (only disabled), so transactions keep a plain FK: no cascade.
  CREATE TABLE transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    order_date      TEXT    NOT NULL,              -- YYYY-MM-DD
    currency        TEXT    NOT NULL CHECK (currency IN ('CAD', 'CNY')),
    amount_cents    INTEGER NOT NULL CHECK (amount_cents >= 0),   -- total actually paid
    subtotal_cents  INTEGER CHECK (subtotal_cents >= 0),          -- before discount, optional
    discount_rate   REAL    NOT NULL DEFAULT 0,
    items_json      TEXT    NOT NULL DEFAULT '[]',
    note            TEXT    NOT NULL DEFAULT '',
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_transactions_user_date ON transactions(user_id, order_date);
  `,

  // 3: several photos per product. Existing single photos become each product's main photo.
  `
  CREATE TABLE product_images (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    path        TEXT    NOT NULL UNIQUE,           -- relative to the uploads folder, e.g. products/06.jpg
    sort_order  INTEGER NOT NULL DEFAULT 0,        -- lowest = main photo
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);

  INSERT INTO product_images (product_id, path, sort_order)
    SELECT id, image_path, 0 FROM products WHERE image_path IS NOT NULL;

  ALTER TABLE products DROP COLUMN image_path;
  `,
];

export function migrate(): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
      console.log(`[db] applied migration ${v + 1}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Run `fn` inside a transaction. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
