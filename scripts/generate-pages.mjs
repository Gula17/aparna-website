// Writes one small HTML "shell" per catalogue page, so Vite builds a real, separate page for each URL:
//   /products/                     all products, with search, filters and sorting
//   /products/<category>/          one category
//   /products/<category>/<model>/  one product
//   /my-list/                      the visitor's saved list
// Each shell only holds a marker; vite.config.js renders the page into it from the catalogue data.
// The folders are generated (git-ignored): run `npm run content` after the product data changes.

import fs from 'node:fs/promises';
import path from 'node:path';

const shell = (marker) => `<!doctype html>
<html lang="%LANG%">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>%TITLE%</title>
    <meta name="description" content="%DESCRIPTION%">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#EC3237">
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta property="og:title" content="%TITLE%">
    <meta property="og:description" content="%DESCRIPTION%">
    <meta property="og:image" content="%OG_IMAGE%">
    <script>document.documentElement.classList.add('js');</script>
    <script type="module" src="/src/catalogue-main.js"></script>
  </head>
  <body class="page-catalogue">
    <!--page:${marker}-->
  </body>
</html>
`;

export async function writePageShells(root, catalogue) {
  const pages = [['products/index.html', 'catalogue'], ['my-list/index.html', 'list']];
  for (const c of catalogue.categories) pages.push([`products/${c.slug}/index.html`, `category:${c.slug}`]);
  for (const p of catalogue.products) pages.push([`products/${p.categorySlug}/${p.slug}/index.html`, `product:${p.id}`]);

  await fs.rm(path.join(root, 'products'), { recursive: true, force: true }); // drop pages for removed products
  for (const [file, marker] of pages) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), shell(marker));
  }
  return pages.map(([file]) => file);
}
