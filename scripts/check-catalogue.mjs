// Checks the built catalogue against the pack's product data, then clicks through it in a real browser.
// Run after `npm run build`:  node scripts/check-catalogue.mjs
//
//  1. every showable product in aparna-products.json has its own page, at its own URL, with its own name
//  2. every image on a product page belongs to that product (no borrowed pictures)
//  3. in the browser, on every product page: images load, the colour picker updates, "Save" adds that
//     product (not another one) to My list
//  4. catalogue page: search, category filter and sorting work; every card links to its own page

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
      // Save: exactly this product goes into My list, with the chosen colour.
      document.querySelector('.product__actions [data-save]').click();
      const list = JSON.parse(localStorage.getItem('aparna-my-list') ?? '[]');
      const count = document.querySelector('[data-list-count]').textContent;
      return { broken, colourOk, list, count, chosen: colours.at(-1)?.value ?? null };
    }, p.id);
    if (result.broken.length) fail(`${p.url}: images did not load: ${result.broken.join(', ')}`);
    if (!result.colourOk) fail(`${p.url}: colour picker did not update`);
    if (result.list.length !== 1 || result.list[0].id !== p.id) fail(`${p.url}: Save stored ${JSON.stringify(result.list)}`);
    if (result.chosen && result.list[0]?.colour !== result.chosen) fail(`${p.url}: saved colour ${result.list[0]?.colour}, chose ${result.chosen}`);
    if (result.count !== '1') fail(`${p.url}: header count shows ${result.count}`);
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

  // My list page shows what was saved.
  await page.evaluate(() => localStorage.setItem('aparna-my-list', JSON.stringify([{ id: 'air-coolers-pearl-009', colour: null }])));
  await page.goto(`${url}/my-list/`, { waitUntil: 'load' });
  const listed = await page.$$eval('.list-item__name', (n) => n.map((x) => x.textContent));
  if (listed.length !== 1 || !/pearl 009/i.test(listed[0])) fail(`My list page shows ${JSON.stringify(listed)}`);
} finally {
  await browser.close();
  await server.close();
}

const noImage = catalogue.products.filter((p) => !p.images.length);
console.log(`Data: ${showable.length} showable products · website: ${catalogue.products.length} products, ${catalogue.categories.length} categories`);
console.log(`Checked in the browser: ${checkedPages} product pages, the catalogue page, ${catalogue.categories.length} category pages, My list`);
console.log(`Products with no image yet (${noImage.length}): ${noImage.map((p) => p.name).join(', ')}`);
console.log(`Images shared by several products (${shared.length}):`);
for (const [file, names] of shared) console.log(`  ${path.basename(file).replace(/-480\.webp$/, '')}: ${names.join(', ')}`);
if (problems.length) {
  console.error(`\nProblems (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll catalogue checks passed.');
