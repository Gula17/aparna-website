// Cuts each product out of its own picture, so the catalogue can show the product itself on a clean stage
// instead of a rectangular poster or catalogue-page crop.
//
//   npm run cutouts            makes cutouts that don't exist yet (fast after the first run)
//   npm run cutouts -- --force remakes every cutout
//
// Source: the product's first image (its own photo, poster or catalogue crop). Event photos of whole rows of
// products are skipped: a cutout of them would not be one product. Output:
//   public/media/cutouts/<key>-480.webp, -960.webp   transparent WebP
//   src/content/cutouts.generated.json                product id -> cutout (never edit by hand)
// Products listed in src/content/cutouts.json "reject" keep their normal image (checked by eye).
//
// This only removes the background: the product pixels are the original photo, never generated.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC, 'media', 'cutouts');
const CONTENT = path.join(ROOT, 'src', 'content');
const force = process.argv.includes('--force');

const catalogue = JSON.parse(await fs.readFile(path.join(CONTENT, 'catalogue.generated.json'), 'utf8'));
const settings = JSON.parse(await fs.readFile(path.join(CONTENT, 'cutouts.json'), 'utf8').catch(() => '{}'));
const reject = new Set(settings.reject ?? []);
await fs.mkdir(OUT_DIR, { recursive: true });

// Keeps the product and drops stray pieces the model left behind (printed sizes, model names, logos).
// Pieces are kept when they are at least `keep` of the largest piece, so a poster with three fans keeps all three.
function keepMainPieces(rgba, width, height, keep = 0.12) {
  const n = width * height;
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) solid[i] = rgba[i * 4 + 3] > 40 ? 1 : 0;
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (!solid[start] || label[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const i = stack[--top];
      size++;
      const x = i % width;
      const y = (i - x) / width;
      // 8-connected, and also 2 px away, so thin fan grilles and blade gaps stay one piece
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height) {
          const j = ny * width + nx;
          if (solid[j] && label[j] === -1) { label[j] = id; stack[top++] = j; }
        }
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) return { coverage: 0 };
  const largest = Math.max(...sizes);
  let kept = 0;
  for (let i = 0; i < n; i++) {
    // Faint pixels (haze, leftover glow) and the small pieces go; the product's pixels are untouched.
    if (label[i] === -1 || sizes[label[i]] < largest * keep) rgba[i * 4 + 3] = 0;
    else kept++;
  }
  return { coverage: kept / n };
}

// Clears printed extras the model kept (a logo tile, an energy-label badge, a caption) from the finished cutout.
// Rectangles are [left, top, width, height] as fractions of the trimmed cutout (src/content/cutouts.json "erase").
async function eraseAreas(png, rects) {
  if (!rects?.length) return png;
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [l, t, w, h] of rects) {
    const x0 = Math.floor(l * info.width), y0 = Math.floor(t * info.height);
    const x1 = Math.ceil((l + w) * info.width), y1 = Math.ceil((t + h) * info.height);
    for (let y = Math.max(0, y0); y < Math.min(info.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(info.width, x1); x++) data[(y * info.width + x) * 4 + 3] = 0;
    }
  }
  return sharp(await sharp(data, { raw: info }).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer();
}

async function cutout(src, erase) {
  const input = await sharp(src).png().toBuffer();
  const blob = await removeBackground(new Blob([input], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
  const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { coverage } = keepMainPieces(data, info.width, info.height);
  const cleaned = await sharp(data, { raw: info }).png().toBuffer();
  const trimmed = await sharp(cleaned).trim({ threshold: 1 }).png().toBuffer();
  return { image: await eraseAreas(trimmed, erase), coverage };
}

const result = {};
const previous = JSON.parse(await fs.readFile(path.join(CONTENT, 'cutouts.generated.json'), 'utf8').catch(() => '{"products":{}}')).products;
const erase = settings.erase ?? {};
const keyOf = (file) => path.basename(file).replace(/-\d+\.webp$/, '');
const todo = catalogue.products.filter((p) => p.images[0] && p.images[0].kind !== 'photo' && !reject.has(p.id));
let made = 0;
let reused = 0;
const t0 = Date.now();

for (const [i, p] of todo.entries()) {
  const source = p.images[0].variants.at(-1).file;
  const key = keyOf(source);
  const files = [480, 960].map((w) => ({ w, file: `media/cutouts/${key}-${w}.webp` }));
  const exists = (await Promise.all(files.map((f) => fs.stat(path.join(PUBLIC, f.file)).catch(() => null)))).every(Boolean);
  const erased = JSON.stringify(erase[p.id] ?? []);
  const eraseChanged = erased !== (previous[p.id]?.erased ?? '[]');

  if (!exists || force || eraseChanged) {
    const { image, coverage } = await cutout(path.join(PUBLIC, source), erase[p.id]);
    if (coverage < 0.02) { console.warn(`  skipped ${p.id}: almost nothing left after cutting out`); continue; }
    for (const { w, file } of files) {
      await sharp(image).resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(PUBLIC, file));
    }
    made++;
    console.log(`  ${i + 1}/${todo.length} ${p.id} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else reused++;

  const variants = [];
  for (const { file } of files) {
    const meta = await sharp(path.join(PUBLIC, file)).metadata();
    variants.push({ file: `/${file}`, width: meta.width, height: meta.height });
  }
  result[p.id] = { alt: `The Aparna ${p.name}`, variants, ...(erase[p.id] ? { erased } : {}) };
}

await fs.writeFile(path.join(CONTENT, 'cutouts.generated.json'), JSON.stringify({
  _generated: 'Made by scripts/make-cutouts.mjs from each product\'s own first image. Do not edit by hand.',
  products: result,
}, null, 2));
console.log(`Cutouts: ${Object.keys(result).length} products (${made} made, ${reused} reused, ${reject.size} rejected by eye)`);
