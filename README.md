# 加拿大冰酒 · 葡萄酒 网站

A static showcase of Canadian icewines and wines: a product catalogue and a page for each product, with photos, tasting notes, style, specs and awards. There are no prices, accounts, contact details or back office. It is a plain static website, so it can be hosted for free on Vercel.

## Run it locally

Requires **Node.js 18 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Change the products

Everything the website shows is in two files:

- [src/data/products.ts](src/data/products.ts) lists the products, in display order. Edit the text, add or delete a product block, or change the category order (`CATEGORIES`).
  - `catalogNo` is also the page address: `'06'` → `/products/06`. Keep it unique.
  - To hide a product, delete its block or comment it out.
- [src/data/site.ts](src/data/site.ts) holds the site title, subtitle and homepage highlights.

## Product photos

Put photos in [src/data/photos/](src/data/photos/) (JPG, PNG or WebP), then list their file names in the product's `photos`, main photo first:

```ts
photos: ['06.jpg', '06-2.jpg', '06-3.jpg'],
```

- Naming files after the catalogue number (`06.jpg`, `06-2.jpg`, …) keeps them easy to find.
- Keep each photo under about 500 KB, so pages load quickly on phones.
- Products with `photos: []` show a bottle drawing.
- If a listed file is missing, the browser console shows a `[photos]` warning and that photo is skipped.

Before pushing, run `npm run build` to check that everything compiles.

## Deploy to Vercel (free)

1. Push this branch to GitHub.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import the GitHub repository.
3. Vercel detects **Vite** automatically: the build command is `npm run build` and the output folder is `dist`. Pick this branch as the production branch, or merge it into `main`.
4. Click **Deploy**.

After that, every push to the production branch rebuilds the site within about a minute. [vercel.json](vercel.json) makes product links such as `/products/06` work when they're opened directly.

## Project layout

```
src/data/       products.ts, site.ts and photos/: the content
src/pages/      Catalogue page, product page, 404 page
src/components/ Layout, product card, photo gallery, bottle drawing
```
