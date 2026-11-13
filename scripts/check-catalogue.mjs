// Checks the built catalogue against the pack's product data, then clicks through it in a real browser.
// Run after `npm run build`:  node scripts/check-catalogue.mjs
//
//  1. every showable product in aparna-products.json has its own page, at its own URL, with its own name
//  2. every image on a product page belongs to that product (no borrowed pictures)
//  3. in the browser, on every product page: images load, the colour picker updates, Share on WhatsApp
//     is there, and there is no Save button or My list link (removed 13 Nov 2026)
//  4. catalogue page: search, category filter and sorting work; every card links to its own page
//  5. the header Products menu, the footer's social links, /my-list/ is a 404, /privacy-policy/ has noindex

import fs from 'node:fs/promises';
import path from 'node:path';
import { startPreviewServer, launchBrowser } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACK = path.join(ROOT, 'Aparna Website Build Pack (Nov 2026)', 'Aparna Website Build Pack (Nov 2026)');
const problems = [];
const fail = (msg) => problems.push(msg);

// ---------------------------------------------------------------- 1-2: static checks

const data = JSON.parse(await fs.readFile(path.join(PACK, '03_Product_Data', 'aparna-products.json'), 'utf8'));
const catalogue = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/catalogue.generated.json'), 'utf8'));
const cutouts = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/cutouts.generated.json'), 'utf8').catch(() => '{"products":{}}')).products;
const rotors = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/rotors.generated.json'), 'utf8').catch(() => '{"products":{}}')).products;
const showable = data.products.filter((p) => ['current', 'new', 'launch'].includes(p.status));
const byId = new Map(catalogue.products.map((p) => [p.id, p]));

for (const p of showable) if (!byId.has(p.id)) fail(`Missing from the website: ${p.name} (${p.id})`);
for (const p of catalogue.products) {
  if (!showable.some((x) => x.id === p.id)) fail(`On the website but not showable in the data: ${p.id}`);
}
const urls = new Set();
for (const p of catalogue.products) {
  if (urls.has(p.url)) fail(`Two products share the URL ${p.url}`);
  urls.add(p.url);
  const html = await fs.readFile(path.join(DIST, p.url, 'index.html'), 'utf8').catch(() => null);
  if (!html) { fail(`No page built for ${p.id} at ${p.url}`); continue; }
  const h1 = html.match(/<h1 class="product__name"[^>]*>([^<]*)<\/h1>/)?.[1];
  if (h1 !== p.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')) fail(`${p.url}: heading is "${h1}", expected "${p.name}"`);
  if (!html.includes(`data-product="${p.id}"`)) fail(`${p.url}: page is not for ${p.id}`);
  // Gallery images must be this product's own.
  const gallery = html.match(/<section class="gallery"[\s\S]*?<\/section>/)?.[0] ?? '';
  // (a product's cutout is its own first image with the background removed: scripts/make-cutouts.mjs;
  // turning-blade layers are cut from that cutout: scripts/make-rotors.mjs)
  const r = rotors[p.id];
  const layers = r ? [r.base, r.top, ...r.rotors.map((x) => x.image)].map((variants) => ({ variants })) : [];
  const own = new Set([...p.images, ...(cutouts[p.id] ? [cutouts[p.id]] : []), ...layers].flatMap((img) => img.variants.map((v) => v.file)));
  for (const [, src] of gallery.matchAll(/src="([^"]+\.webp)"/g)) if (!own.has(src)) fail(`${p.url}: shows an image that isn't its own: ${src}`);
}

// Images used by more than one product: allowed only for shared posters, and for one picture printed for
// several sizes of the same model. Listed so they can be reviewed.
const users = new Map();
for (const p of catalogue.products) for (const img of p.images) {
  const key = img.variants[0].file;
  users.set(key, [...(users.get(key) ?? []), p.name]);
}
const shared = [...users.entries()].filter(([, names]) => names.length > 1);

// ---------------------------------------------------------------- 3-4: in the browser

const { server, url } = await startPreviewServer();
const browser = await launchBrowser();
let checkedPages = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => fail(`Script error: ${e.message}`));
  await page.setViewport({ width: 1280, height: 860 });
  page.setDefaultNavigationTimeout(90000); // /products/ waits for 243 cards' pictures
  // name the page in any navigation error, so a timeout says where it happened
  const goto = page.goto.bind(page);
  page.goto = (to, opts) => goto(to, opts).catch((e) => { throw new Error(`${new URL(to).pathname}: ${e.message}`); });

  for (const p of catalogue.products) {
    await page.goto(`${url}${p.url}?no3d`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    const result = await page.evaluate(async (id) => {
      const imgs = [...document.querySelectorAll('.gallery img')];
      imgs.forEach((img) => { img.loading = 'eager'; }); // off-screen slides are lazy-loaded
      const timeout = new Promise((r) => setTimeout(r, 8000));
      await Promise.race([Promise.all(imgs.map((img) => img.decode().catch(() => null))), timeout]);
      const broken = imgs.filter((img) => !img.naturalWidth).map((img) => img.src);
      // Colour picker: choose the last colour and read the label.
      const colours = [...document.querySelectorAll('[data-colours] input')];
      let colourOk = true;
      if (colours.length > 1) {
        const last = colours.at(-1);
        last.click();
        colourOk = document.querySelector('[data-chosen]').textContent.includes(last.value);
      }
      // No Save / My list (removed 13 Nov 2026); Share on WhatsApp stays.
      const save = Boolean(document.querySelector('[data-save], [data-list-count], a[href="/my-list/"]'));
      const share = document.querySelector('.product__actions [data-share]')?.href ?? '';
      return { broken, colourOk, save, share };
    }, p.id);
    if (result.broken.length) fail(`${p.url}: images did not load: ${result.broken.join(', ')}`);
    if (!result.colourOk) fail(`${p.url}: colour picker did not update`);
    if (result.save) fail(`${p.url}: still has a Save button or My list link`);
    if (!result.share.startsWith('https://wa.me/')) fail(`${p.url}: Share on WhatsApp missing`);
    checkedPages++;
  }

  // Catalogue page: search, filter, sort, links.
  await page.goto(`${url}/products/`, { waitUntil: 'load' });
  const total = await page.$$eval('.product-card', (c) => c.length);
  if (total !== catalogue.products.length) fail(`/products/ shows ${total} cards, expected ${catalogue.products.length}`);
  const hrefs = await page.$$eval('.product-card__link', (a) => a.map((x) => new URL(x.href).pathname));
  const wrongLinks = hrefs.filter((h) => !urls.has(h));
  if (wrongLinks.length) fail(`Cards linking to unknown pages: ${wrongLinks.slice(0, 5).join(', ')}`);
  if (new Set(hrefs).size !== hrefs.length) fail('Two cards link to the same product page');

  await page.type('.toolbar input[name="q"]', 'pearl');
  await new Promise((r) => setTimeout(r, 400));
  const pearl = await page.$$eval('.product-card:not([hidden]) .product-card__name', (n) => n.map((x) => x.textContent));
  const expectedPearl = catalogue.products.filter((p) => `${p.name} ${p.series} ${p.type} ${p.category} ${p.colours.join(' ')}`.toLowerCase().includes('pearl')).length;
  if (pearl.length !== expectedPearl) fail(`Search "pearl" shows ${pearl.length}, expected ${expectedPearl}`);

  await page.goto(`${url}/products/?category=air-coolers&sort=name`, { waitUntil: 'load' });
  const coolers = await page.$$eval('.product-card:not([hidden])', (c) => c.map((x) => [x.dataset.category, x.dataset.name]));
  const expectedCoolers = catalogue.products.filter((p) => p.categorySlug === 'air-coolers').length;
  if (coolers.length !== expectedCoolers || coolers.some(([c]) => c !== 'air-coolers')) fail(`Category filter: ${coolers.length} shown, expected ${expectedCoolers} air coolers`);
  const names = coolers.map(([, n]) => n);
  if (names.join() !== [...names].sort((a, b) => a.localeCompare(b)).join()) fail('Sort by name is not alphabetical');

  // Category pages each list only their own products.
  for (const c of catalogue.categories) {
    await page.goto(`${url}/products/${c.slug}/`, { waitUntil: 'domcontentloaded' });
    const cats = await page.$$eval('.product-card', (cards) => cards.map((x) => x.dataset.category));
    if (cats.length !== c.count || cats.some((x) => x !== c.slug)) fail(`/products/${c.slug}/ shows ${cats.length} cards (expected ${c.count})`);
  }

  // The old My list page is gone.
  const gone = await page.goto(`${url}/my-list/`, { waitUntil: 'load' });
  if (gone.status() !== 404) fail(`/my-list/ returns ${gone.status()}, expected 404`);

  // Header Products menu: one tile per category with its live count, thumbnails only once opened.
  await page.goto(`${url}/products/`, { waitUntil: 'load' });
  const menu = await page.evaluate(async () => {
    const before = [...document.querySelectorAll('.nav-tile img')].filter((i) => i.getAttribute('src')).length;
    document.querySelector('.nav-menu summary').click();
    await new Promise((r) => setTimeout(r, 600));
    const imgs = [...document.querySelectorAll('.nav-tile img')];
    await Promise.all(imgs.map((i) => i.decode().catch(() => null)));
    return { before, tiles: [...document.querySelectorAll('.nav-tile')].map((a) => [new URL(a.href).pathname, a.querySelector('.nav-tile__count').textContent]), loaded: imgs.filter((i) => i.naturalWidth).length, explore: document.querySelector('.nav-menu__explore').textContent };
  });
  if (menu.before) fail(`Menu thumbnails load before the menu opens (${menu.before})`);
  if (menu.tiles.length !== catalogue.categories.length) fail(`Menu shows ${menu.tiles.length} categories, expected ${catalogue.categories.length}`);
  for (const c of catalogue.categories) if (!menu.tiles.some(([href, n]) => href === `/products/${c.slug}/` && n.startsWith(`${c.count} `))) fail(`Menu tile for ${c.name} is missing or has the wrong count`);
  if (menu.loaded !== menu.tiles.length) fail(`Menu thumbnails loaded: ${menu.loaded} of ${menu.tiles.length}`);
  if (!menu.explore.includes(`${catalogue.products.length} products`)) fail(`Menu strip says "${menu.explore.trim()}"`);

  // Footer: the four official social links, opening in a new tab; the privacy policy page.
  const t = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/en.json'), 'utf8'));
  const social = await page.$eval('.site-footer__social a', (a) => a.map((x) => [x.dataset.social, x.getAttribute('href'), x.target, x.rel]));
  const want = ['facebook', 'instagram', 'threads', 'youtube'];
  if (social.map(([k]) => k).join() !== want.join()) fail(`Footer social links: ${social.map(([k]) => k).join()}`);
  for (const [k, href, target, rel] of social) if (href !== t.social[k] || target !== '_blank' || !/noopener/.test(rel) || !/noreferrer/.test(rel)) fail(`Footer ${k} link: ${href} ${target} ${rel}`);
  const privacy = await page.goto(`${url}/privacy-policy/`, { waitUntil: 'load' });
  if (privacy.status() !== 200) fail(`/privacy-policy/ returns ${privacy.status()}`);
  const robots = await page.$eval('meta[name="robots"]', (m) => m.content).catch(() => '');
  if (!/noindex/.test(robots)) fail('/privacy-policy/ is missing noindex');
} finally {
  await browser.close();
  await server.close();
}

const noImage = catalogue.products.filter((p) => !p.images.length);
console.log(`Data: ${showable.length} showable products · website: ${catalogue.products.length} products, ${catalogue.categories.length} categories`);
console.log(`Checked in the browser: ${checkedPages} product pages, the catalogue page, ${catalogue.categories.length} category pages, the Products menu, footer links, /my-list/ 404, /privacy-policy/`);
console.log(`Products with no image yet (${noImage.length}): ${noImage.map((p) => p.name).join(', ')}`);
console.log(`Images shared by several products (${shared.length}):`);
for (const [file, names] of shared) console.log(`  ${path.basename(file).replace(/-480\.webp$/, '')}: ${names.join(', ')}`);
if (problems.length) {
  console.error(`\nProblems (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll catalogue checks passed.');
