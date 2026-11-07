// Side-by-side sheets of each product's photo and its 3D model, to check the models against the pictures.
// Run after npm run build:  node scripts/compare-3d.mjs <output folder> [product id filter]
// Writes compare-0.jpg, compare-1.jpg, ... (6 products per sheet: photo on the left, 3D on the right).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { startPreviewServer, launchBrowser } from './browser.mjs';
import { PRODUCT_MODELS } from '../src/three/models.js';

sharp.cache(false);
const [out = '.', filter = ''] = process.argv.slice(2);
const ROOT = path.resolve(import.meta.dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/catalogue.generated.json'), 'utf8'));
const products = catalogue.products.filter((p) => PRODUCT_MODELS[p.id] && p.id.includes(filter));
const T = 300;
const label = (text) => Buffer.from(`<svg width="${2 * T + 4}" height="22"><rect width="100%" height="22"/><text x="5" y="16" font-size="14" fill="#fff" font-family="Arial">${text.replace(/&/g, '&amp;')}</text></svg>`);

const { server, url } = await startPreviewServer();
const browser = await launchBrowser();
const pairs = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 860 });
  for (const p of products) {
    await page.goto(`${url}${p.url}?force3d`, { waitUntil: 'networkidle0', timeout: 90000 });
    // Wait out the drop-in entrance (1.3 s) and the first frames of the 3D view.
    await new Promise((r) => setTimeout(r, 3500));
    const el = await page.$('.gallery__slide--3d:not(.gallery__slide--parts) .viewer');
    // The test browser renders in software, so a heavy model can take several seconds to compile its first
    // frame: retry until the middle of the view has something in it (not just the plain background).
    let shot = null;
    for (let tries = 0; el && tries < 6; tries++) {
      shot = await el.screenshot();
      const { channels } = await sharp(shot).extract({ left: 120, top: 120, width: 260, height: 260 }).stats().catch(() => ({ channels: [{ stdev: 99 }] }));
      if (channels[0].stdev > 6) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    const photoFile = p.images[0] ? path.join(ROOT, 'public', p.images[0].variants.at(-1).file) : null;
    const photo = photoFile ? await sharp(fs.readFileSync(photoFile)).resize(T, T, { fit: 'contain', background: '#ffffff' }).toBuffer()
      : await sharp({ create: { width: T, height: T, channels: 3, background: '#dddddd' } }).png().toBuffer();
    const model = shot ? await sharp(shot).resize(T, T).toBuffer() : photo;
    pairs.push({ id: p.id, photo, model });
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(out, { recursive: true });
for (let s = 0; s * 6 < pairs.length; s++) {
  const comp = [];
  pairs.slice(s * 6, s * 6 + 6).forEach((pr, i) => {
    const x = (i % 3) * (2 * T + 14), y = Math.floor(i / 3) * (T + 30);
    comp.push({ input: label(`${s * 6 + i} ${pr.id}`), left: x, top: y }, { input: pr.photo, left: x, top: y + 24 }, { input: pr.model, left: x + T + 4, top: y + 24 });
  });
  await sharp({ create: { width: 3 * (2 * T + 14), height: 2 * (T + 30), channels: 3, background: '#fff' } }).composite(comp).jpeg({ quality: 80 }).toFile(path.join(out, `compare-${s}.jpg`));
}
console.log(`${pairs.length} products, ${Math.ceil(pairs.length / 6)} sheets in ${out}`);
