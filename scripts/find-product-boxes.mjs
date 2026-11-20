// Finds where the product itself sits inside each catalogue-page crop and price-list crop, so the site can show the
// product without the printed text around it (its name, "SWEEP", "COLOUR" lines, page background): the product
// page already shows that information as real text.
//
//   npm run boxes             finds boxes for crops that don't have one yet
//   npm run boxes -- --force  finds them all again
//
// How: the same on-device background removal as the cutouts (@imgly/background-removal-node, nothing generated),
// keeping the main pieces (printed captions and logos are small separate pieces and drop out); the box is the
// product's extent plus a margin. Safe by design: a box only ever trims the crop, never adds to it, and a crop is
// left whole when the product found is suspiciously small (a white product on a white page can be half lost).
// Output: src/content/product-boxes.json  { "<image key>": [left, top, width, height] as fractions of the crop }.
// Checked by eye on a contact sheet (.cache/product-boxes-*.png); a wrong one can be removed or set to null.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

sharp.cache(false);
const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, 'Aparna Website Build Pack (Nov 2026)', 'Aparna Website Build Pack (Nov 2026)');
const CONTENT = path.join(ROOT, 'src', 'content');
const OUT = path.join(CONTENT, 'product-boxes.json');
const force = process.argv.includes('--force');

const crops = JSON.parse(await fs.readFile(path.join(CONTENT, 'product-images.json'), 'utf8'));
const listPhotos = JSON.parse(await fs.readFile(path.join(CONTENT, 'price-list-photos.json'), 'utf8')).photos ?? {};
const previous = JSON.parse(await fs.readFile(OUT, 'utf8').catch(() => '{}'));

// every crop the site shows, by the image key catalogue-data.mjs gives it
const sources = [];
for (const [id, c] of Object.entries(crops)) if (c?.page && c?.crop) sources.push({ key: `crop-${id}`, file: path.join(PACK, '02_Catalogue_2026', 'pages', c.page), crop: c.crop });
for (const [id, l] of Object.entries(listPhotos)) sources.push({ key: `pricelist-${id}`, file: path.join(ROOT, l.image) });

// the product's pieces: alpha after background removal, small stray pieces (captions, logos) dropped
function mainPieces(rgba, w, h, keep = 0.12) {
  const n = w * h, solid = new Uint8Array(n), label = new Int32Array(n).fill(-1), sizes = [], stack = new Int32Array(n);
  for (let i = 0; i < n; i++) solid[i] = rgba[i * 4 + 3] > 40 ? 1 : 0;
  for (let s = 0; s < n; s++) {
    if (!solid[s] || label[s] !== -1) continue;
    const id = sizes.length; let size = 0, top = 0; stack[top++] = s; label[s] = id;
    while (top) { const i = stack[--top]; size++; const x = i % w, y = (i - x) / w;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) { const j = ny * w + nx; if (solid[j] && label[j] === -1) { label[j] = id; stack[top++] = j; } } } }
    sizes.push(size);
  }
  if (!sizes.length) return null;
  const largest = Math.max(...sizes);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, kept = 0;
  for (let i = 0; i < n; i++) if (label[i] !== -1 && sizes[label[i]] >= largest * keep) { const x = i % w, y = (i - x) / w; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); kept++; }
  return { x0, y0, x1, y1, coverage: kept / n };
}

const out = { _read_me: 'Where the product sits inside each catalogue-page and price-list crop: [left, top, width, height] as fractions of the crop (null: show the crop whole). Made by scripts/find-product-boxes.mjs (npm run boxes), checked by eye; catalogue-data.mjs crops to it so the printed text around the product is left out.' };
let made = 0, kept = 0, whole = 0;
// Ceiling fans: the background model often loses their long blades against the page, so a box would cut them; they
// stay whole, except these 24" fans whose boxes were checked by eye. The kettle element's box cut its base.
const CHECKED_FANS = ['little-star-24', 'mini-copper-24', 'new-josh-copper-24', 'new-josh-24', 'mini-smart-24', 'mini-star-24'].map((x) => `crop-ceiling-fans-${x}`);
const alwaysWhole = (key) => (/ceiling-fans-/.test(key) && !CHECKED_FANS.includes(key)) || key === 'crop-heating-water-kettle-element';
for (const s of sources) {
  if (alwaysWhole(s.key)) { out[s.key] = null; whole++; continue; }
  if (!force && s.key in previous) { out[s.key] = previous[s.key]; kept++; continue; }
  let img = sharp(s.file).rotate();
  if (s.crop) img = img.extract({ left: s.crop[0], top: s.crop[1], width: s.crop[2], height: s.crop[3] });
  const input = await img.png().toBuffer();
  const { width: W, height: H } = await sharp(input).metadata();
  // small crops: enlarge plainly for the model only (it works best on a few hundred pixels or more)
  const k = Math.max(1, Math.ceil(480 / Math.max(W, H)));
  const big = k > 1 ? await sharp(input).resize({ width: W * k, kernel: 'lanczos3' }).png().toBuffer() : input;
  const blob = await removeBackground(new Blob([big], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
  const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = mainPieces(data, info.width, info.height);
  const area = m ? ((m.x1 - m.x0 + 1) * (m.y1 - m.y0 + 1)) / (info.width * info.height) : 0;
  if (!m || area < 0.15 || m.coverage < 0.03) { out[s.key] = null; whole++; console.log(`  whole  ${s.key} (product found too small: ${(area * 100).toFixed(0)}%)`); continue; }
  // the product's extent plus a margin of 6% of its size (at least 3 source pixels), inside the crop
  const mx = Math.max(3 * k, (m.x1 - m.x0) * 0.06), my = Math.max(3 * k, (m.y1 - m.y0) * 0.06);
  const l = Math.max(0, m.x0 - mx) / info.width, t = Math.max(0, m.y0 - my) / info.height;
  const r = Math.min(info.width, m.x1 + 1 + mx) / info.width, b = Math.min(info.height, m.y1 + 1 + my) / info.height;
  if (r - l > 0.95 && b - t > 0.95) { out[s.key] = null; whole++; continue; } // nothing worth trimming
  out[s.key] = [l, t, r - l, b - t].map((v) => +v.toFixed(4));
  made++;
  console.log(`  box    ${s.key}  keeps ${((r - l) * (b - t) * 100).toFixed(0)}% of the crop`);
}
await fs.writeFile(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(`Product boxes: ${sources.length} crops (${made} found, ${whole} left whole, ${kept} kept from before) -> src/content/product-boxes.json`);
