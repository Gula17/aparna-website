// Writes one small HTML "shell" per catalogue page, so Vite builds a real, separate page for each URL:
//   /products/                     all products, with search, filters and sorting
//   /products/<category>/          one category
//   /products/<category>/<model>/  one product
//   /events/, /events/<event>/     Aparna's events (src/content/events.json)
//   /privacy-policy/               the privacy policy
// Each shell only holds a marker; vite.config.js renders the page into it from the catalogue data.
// The folders are generated (git-ignored): run `npm run content` after the product data changes.

import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://aparnahome.com';

// The privacy policy is a draft for Aparna to review: it stays out of search. Every other page is indexed.
const shell = (marker) => `<!doctype html>
<html lang="%LANG%">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>%TITLE%</title>
    <meta name="description" content="%DESCRIPTION%">
    ${marker === 'privacy' ? '<meta name="robots" content="noindex, nofollow">\n    ' : ''}<meta name="theme-color" content="#EC3237">
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

// Product pages that moved (their old links keep working): old folder -> new address
const MOVED = [
  ['products/electric-irons/new-white-blue', '/products/electric-irons/passion/'],
  ['products/electric-irons/new-white-grey', '/products/electric-irons/verna/'],
];
const forward = (to) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Moved</title>
    <meta name="robots" content="noindex">
    <link rel="canonical" href="${SITE}${to}">
    <meta http-equiv="refresh" content="0; url=${to}">
    <script>location.replace('${to}');</script>
  </head>
  <body><p>This page has moved: <a href="${to}">${to}</a></p></body>
</html>
`;

export async function writePageShells(root, catalogue, events = { events: [] }) {
  const pages = [['products/index.html', 'catalogue']];
  for (const c of catalogue.categories) pages.push([`products/${c.slug}/index.html`, `category:${c.slug}`]);
  for (const p of catalogue.products) pages.push([`products/${p.categorySlug}/${p.slug}/index.html`, `product:${p.id}`]);
  pages.push(['events/index.html', 'events'], ['privacy-policy/index.html', 'privacy']);
  for (const e of events.events) pages.push([`events/${e.id}/index.html`, `event:${e.id}`]);

  await fs.rm(path.join(root, 'products'), { recursive: true, force: true }); // drop pages for removed products
  await fs.rm(path.join(root, 'my-list'), { recursive: true, force: true }); // the old My list page (removed 13 Nov 2026)
  await fs.rm(path.join(root, 'events'), { recursive: true, force: true });
  await fs.rm(path.join(root, 'privacy-policy'), { recursive: true, force: true });
  for (const [file, marker] of pages) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), shell(marker));
  }
  // Old addresses that moved: a small page that forwards at once (works on any web server, no server config needed)
  for (const [from, to] of MOVED) {
    await fs.mkdir(path.join(root, from), { recursive: true });
    await fs.writeFile(path.join(root, from, 'index.html'), forward(to));
  }
  // The sitemap for search engines: the home page and every page above but the privacy policy
  const urls = ['/', ...pages.filter(([, marker]) => marker !== 'privacy').map(([file]) => `/${file.replace(/index\.html$/, '')}`)];
  await fs.writeFile(path.join(root, 'public', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  return pages.map(([file]) => file);
}
