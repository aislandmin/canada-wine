# 加拿大冰酒 · 葡萄酒 网站

A product catalog for Canadian icewines and wines, with prices in CAD and RMB. It is aimed at customers in China and Canada.

## Run it locally

Requires **Node.js 22.13 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API server runs on port 3001, and Vite forwards `/api` and `/uploads` requests to it.

On first start, the database (`data/app.db`) is created and filled with the 9 products from the October 2026 catalog.

## Admin account

Create your administrator account once (run from the project root):

```bash
npm run create-admin -- --email you@example.com --name 店主 --password "your-strong-password"
# or with a phone number (China by default; add --cc +1 for Canada)
npm run create-admin -- --phone 13812345678 --name 店主 --password "your-strong-password"
```

Running it again with an existing phone or email promotes that account to admin. Adding `--password` also resets its password.

Admin accounts are the **seller**: they never appear in the customer list, statistics or exports, and can't be edited from the web pages. Manage them from the command line:

```bash
npm run admins                                      # list admins
npm run admins -- disable --email you@example.com   # disable an admin (the last active admin can't be disabled)
npm run admins -- enable  --email you@example.com
```

After logging in, an admin goes straight to **管理后台**. The top menu is: 全部产品 / 折扣政策 / 管理后台 / 个人资料 (profile and password) / 退出. The back office has these sections:

- **概览:**
  - customer and product counts
  - sales statistics for a chosen period (本月 / 上月 / 本季度 / 本年 / 去年 / 自定义), with CAD and RMB kept separate (no conversion)
  - a 12-month trend chart, product ranking (gift boxes listed separately) and top customers
  - customers close to the next discount tier
  - Excel/CSV export
- **客户:**
  - search and sort customers, create accounts for offline customers (with a temporary password), edit, disable or re-enable accounts, reset passwords
  - each customer's page: their totals and discount, plus record, edit or delete their transactions (the discount for the order date is suggested automatically)
- **交易记录:**
  - every customer's transactions in one list, newest first, filtered by customer, currency and date, 50 per page, with paid totals
  - add a transaction (choose the customer first), edit or delete
- **产品:**
  - add, edit, take down (下架) or delete products
  - up to 10 photos per product: upload several at once, reorder, set the main photo; large photos are shrunk automatically
- **分类:** rename categories (products in them follow automatically), change their order with ↑ ↓, add or delete
- **网站设置:** homepage text, contact text, policy text and discount tiers

## Demo customer (for testing only)

```bash
npm run demo:add      # creates 示例客户 with 6 sample transactions
npm run demo:remove   # deletes them. Run this before going live.
```

Log in with phone **+86 138 0013 8000** or email **demo@example.com**, password **demo12345**.

## Product photos

All product photos are kept in one folder: `data/uploads/products/`.

- **By hand:** name photos after the product's catalog number. JPG, PNG and WebP all work. On the next server start, any new matching files are added after the product's existing photos.
  - `06.jpg` is the main photo
  - `06-2.jpg`, `06-3.jpg`, … are extra photos, in that order
- **From the admin page:** uploaded photos are saved to the same folder. Deleting a photo there also deletes its file.

Products without photos show a bottle drawing. Each product can have up to 10 photos. On the product page, visitors can click thumbnails, swipe on phones, and tap to view full-screen.

## Production

```bash
npm run build      # builds the website into dist/
npm start          # serves the website and API on PORT (default 3001)
```

| Env var    | Default  | Purpose                                  |
|------------|----------|------------------------------------------|
| `PORT`     | `3001`   | HTTP port                                |
| `DATA_DIR` | `./data` | Database and uploaded images. **Back up this folder.** |
| `TRUST_PROXY` | (off) | Set to `1` behind Nginx/Caddy with HTTPS, so login cookies are marked Secure and rate limiting sees real client IPs |
| `HOST`     | (all interfaces) | Set to `127.0.0.1` on the server so only the local reverse proxy can reach the app |

Step-by-step server setup (Vultr Tokyo, Caddy, backups, updates): [DEPLOY.md](DEPLOY.md) (中文) · [DEPLOY.en.md](DEPLOY.en.md) (English). Config files are in [deploy/](deploy/).

## Project layout

```
shared/   Types and discount logic, used by both the server and the browser
server/   Express API and the SQLite database (node:sqlite), with numbered migrations in db.ts
src/      React website (pages/, components/)
```

## Tests

```bash
npm test
```

## Roadmap

1. ✅ Catalog, product pages, discount policy
2. ✅ Customer sign up, log in, and an account page (totals, earned discount, transactions)
3. ✅ Admin pages: customers, transactions, products and photos, categories, settings, dashboard, CSV export
3b. ✅ Sales statistics merged into 概览; admins separated from customers; several photos per product
4. Deployment guide (server, HTTPS, domain) and automatic backups
