// Run after npm run build: node scripts/check-3d.mjs
// Opens every product that has a 3D model and checks the 360° view is the first picture and actually draws.
import { startPreviewServer, launchBrowser } from './browser.mjs';
import { PRODUCT_MODELS } from '../src/three/models.js';
import sharp from 'sharp';
import fs from 'node:fs';
const products = JSON.parse(fs.readFileSync(new URL('../src/content/catalogue.generated.json', import.meta.url), 'utf8')).products.filter((p) => PRODUCT_MODELS[p.id]);
const { server, url } = await startPreviewServer();
const browser = await launchBrowser();
const bad = [];
let ok = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 860 });
  for (const p of products) {
    const errs = [];
    const onErr = (e) => errs.push(e.message ?? e.text?.());
    page.on('pageerror', onErr);
    await page.goto(`${url}${p.url}?force3d`, { waitUntil: 'networkidle0', timeout: 90000 });
    let first = false, std = 0, size = '';
    for (let i = 0; i < 6 && std < 6; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const r = await page.evaluate(() => {
        const slide = document.querySelector('.gallery__slide');
        const cv = document.querySelector('.gallery__slide--3d canvas');
        return { first: !!slide?.classList.contains('gallery__slide--3d'), size: cv ? `${cv.width}x${cv.height}` : '' };
      });
      first = r.first; size = r.size;
      const cv = await page.$('.gallery__slide--3d canvas');
      if (cv) std = (await sharp(await cv.screenshot()).stats()).channels[0].stdev;
    }
    page.off('pageerror', onErr);
    if (!first || std < 6 || size.startsWith('300x150') || errs.length) bad.push(`${p.id}: first=${first} canvas=${size} detail=${std.toFixed(1)} ${errs.join(' / ')}`);
    else ok++;
  }
} finally { await browser.close(); await server.close(); }
console.log(`3D product pages OK: ${ok} of ${products.length}`);
console.log(bad.length ? `Problems:\n  ${bad.join('\n  ')}` : 'No problems.');
