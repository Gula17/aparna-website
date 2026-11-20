// Checks that every product really shows on the built site (run after npm run build):
//   node scripts/check-site.mjs            pages, cards and pictures (fast, no browser)
//   node scripts/check-site.mjs --browser  also opens every product page: no script errors, a picture shows,
//                                          and the 3D view draws where the product has one
// Prints a list of problems and exits 1 if there are any.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const catalogue = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/catalogue.generated.json'), 'utf8'));
const { PRODUCT_MODELS } = await import('../src/three/models.js');
const problems = [];
const read = (url) => fs.readFile(path.join(DIST, url, 'index.html'), 'utf8').catch(() => null);
const exists = (file) => fs.access(path.join(DIST, file)).then(() => true, () => false);

// ---- every product: its page, its card on its category page and on /products/, its pictures
const all = await read('/products/');
const categoryPages = {};
for (const p of catalogue.products) {
  const page = await read(p.url);
  if (!page) { problems.push(`${p.id}: no page at ${p.url}`); continue; }
  if (!page.includes(`id="product-title">${p.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}<`)) problems.push(`${p.id}: page title is not "${p.name}"`);
  categoryPages[p.categorySlug] ??= await read(`/products/${p.categorySlug}/`);
  if (!categoryPages[p.categorySlug]?.includes(`data-id="${p.id}"`)) problems.push(`${p.id}: no card on /products/${p.categorySlug}/`);
  if (!all?.includes(`data-id="${p.id}"`)) problems.push(`${p.id}: no card on /products/`);
  if (!p.images.length && !PRODUCT_MODELS[p.id]) problems.push(`${p.id}: no picture and no 3D model`);
  for (const img of p.images) for (const v of img.variants) if (!(await exists(v.file))) problems.push(`${p.id}: missing picture ${v.file}`);
}
console.log(`${catalogue.products.length} products, ${catalogue.categories.length} categories checked (pages, cards, pictures)`);

// ---- in the browser: every product page opens without script errors and shows something
if (process.argv.includes('--browser')) {
  const { startPreviewServer, launchBrowser } = await import('./browser.mjs');
  const { server, url } = await startPreviewServer();
  const browser = await launchBrowser();
  try {
    // four tabs at once, each taking the next product off the list
    const queue = [...catalogue.products];
    let done = 0;
    const worker = async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 860 });
    let errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errors.push(m.text()); });
    for (let p = queue.shift(); p; p = queue.shift()) {
      errors = [];
      const has3D = Boolean(PRODUCT_MODELS[p.id]);
      await page.goto(`${url}${p.url}${has3D ? '?force3d' : ''}`, { waitUntil: 'load', timeout: 60000 }).catch((e) => errors.push(`load: ${e.message}`));
      await new Promise((r) => setTimeout(r, has3D ? 3500 : 800));
      // read the 3D canvas inside an animation frame, right after it draws (a WebGL canvas reads blank otherwise)
      // (a tab that isn't in front may never draw a frame, so don't wait for one longer than half a second)
      const state = await page.evaluate(() => new Promise((resolve) => { let sent = false; const read = () => { if (sent) return; sent = true; resolve((() => {
        const img = [...document.querySelectorAll('.gallery img')].some((i) => i.complete && i.naturalWidth > 0);
        const canvas = document.querySelector('.gallery__slide--3d canvas');
        let drawn = null;
        if (canvas) {
          // something other than the plain background is drawn (sample a grid of pixels)
          const c = document.createElement('canvas'); c.width = 64; c.height = 64;
          const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 64, 64);
          const d = x.getImageData(0, 0, 64, 64).data;
          let min = 255, max = 0;
          for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, l); max = Math.max(max, l); }
          drawn = max - min > 60;
        }
        return { img, canvas: Boolean(canvas), drawn };
      })()); }; requestAnimationFrame(read); setTimeout(read, 500); })).catch(() => ({}));
      if (errors.length) problems.push(`${p.id}: script error: ${errors[0].slice(0, 140)}`);
      if (!state.img && !state.canvas) problems.push(`${p.id}: nothing shows in the gallery`);
      if (has3D && state.canvas && state.drawn === false) {
        // reading a WebGL canvas can come back empty: judge by a screenshot of the view instead
        const box = await page.evaluate(() => { const r = document.querySelector('.gallery__slide--3d canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        await page.bringToFront();
        await new Promise((r) => setTimeout(r, 1500)); // let it draw now that it is in front
        const shot = await page.screenshot({ clip: box });
        const { channels } = await sharp(shot).stats();
        if (channels.slice(0, 3).every((c) => c.stdev < 6)) problems.push(`${p.id}: the 3D view is blank`);
      }
      if (++done % 25 === 0) console.log(`  ${done} pages opened`);
    }
    await page.close();
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally {
    await browser.close().catch(() => {}); // Windows sometimes keeps Chrome's profile lock a moment longer
    await server.close();
  }
}

if (problems.length) {
  console.error(`\nSite check: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nSite check passed: every product has its page, its cards and its pictures.');
