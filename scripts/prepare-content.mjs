// Reads the Aparna build pack and prepares everything the site needs:
//   1. src/content/range.generated.json  - category counts and BLDC models, straight from aparna-products.json
//   2. public/media/*                    - optimised WebP/PNG copies of the images listed in src/content/images.json
//   3. public/brand/*, public/downloads/* - logo files, favicons and the catalogue PDF
//
// Run with `npm run content`. Products are never typed by hand: when Aparna sends a new JSON, drop it into the pack
// and run this again.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildCatalogue } from './catalogue-data.mjs';
import { writePageShells } from './generate-pages.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, 'Aparna Website Build Pack (Nov 2026)', 'Aparna Website Build Pack (Nov 2026)');
const PUBLIC = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'src', 'content');

const SHOWABLE = new Set(['current', 'new', 'launch']); // "confirm" stays hidden (brief §3.5)
const MEDIA_WIDTHS = [800, 1600];

const slugify = (text) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function buildRangeData() {
  const data = JSON.parse(await fs.readFile(path.join(PACK, '03_Product_Data', 'aparna-products.json'), 'utf8'));
  const discontinued = new Set((data.discontinued_do_not_show ?? []).map((p) => (p.name ?? p).toString().toLowerCase()));
  const products = data.products.filter((p) => SHOWABLE.has(p.status) && !discontinued.has(p.name.toLowerCase()));

  const categories = data.categories
    .map(({ name }) => {
      const items = products.filter((p) => p.category === name);
      return {
        name,
        slug: slugify(name),
        count: items.length,
        onlyLaunch: items.length > 0 && items.every((p) => p.status === 'launch'),
      };
    })
    .filter((c) => c.count > 0);

  // BLDC models for the end of Scene 2. Only verified, agreed specs are copied across.
  // RPM is left out on purpose: the catalogue and the May sheet disagree for two of the three models.
  const bldc = products
    .filter((p) => p.category === 'Ceiling Fans' && p.group.startsWith('BLDC'))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sizeMm: p.size_mm,
      sizeInch: p.size_inch,
      power: p.specs?.power ?? null,
      warranty: p.specs?.warranty ?? null,
      colours: p.colours ?? [],
      badges: (p.badges ?? []).filter((b) => b !== 'New launch'),
      // Feature lines as printed; the internal "(catalogue claim)" note is for us, not for visitors.
      features: (p.features ?? []).map((f) => f.replace(/\s*\(catalogue claim\)/i, '')),
      poster: p.poster,
    }));

  const powers = [...new Set(bldc.map((m) => m.power).filter(Boolean))];

  return {
    _generated: `From aparna-products.json by scripts/prepare-content.mjs. Do not edit by hand.`,
    categories,
    bldc,
    bldcSharedPower: powers.length === 1 ? powers[0] : null,
  };
}

async function writeImage(srcPath, outBase, { crop, widths = MEDIA_WIDTHS, format = 'webp' }) {
  const meta = await sharp(srcPath).metadata();
  const results = [];
  for (const width of widths) {
    let img = sharp(srcPath).rotate();
    if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    const sourceWidth = crop ? crop[2] : meta.width;
    img = img.resize({ width: Math.min(width, sourceWidth), withoutEnlargement: true });
    const file = `${outBase}-${width}.${format}`;
    const info = format === 'png'
      ? await img.png({ compressionLevel: 9, palette: true }).toFile(path.join(PUBLIC, file))
      : await img.webp({ quality: 72 }).toFile(path.join(PUBLIC, file));
    results.push({ file: `/${file.replace(/\\/g, '/')}`, width: info.width, height: info.height });
  }
  return results;
}

async function buildMedia(range) {
  await fs.mkdir(path.join(PUBLIC, 'media'), { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(CONTENT, 'images.json'), 'utf8'));
  const out = {};

  for (const [key, entry] of Object.entries(manifest)) {
    if (key.startsWith('_')) continue;
    const isLogo = key.startsWith('logo');
    const variants = await writeImage(path.join(PACK, entry.src), path.join('media', key), {
      crop: entry.crop,
      widths: entry.widths,
      format: isLogo ? 'png' : 'webp',
    });
    out[key] = { alt: entry.alt, position: entry.position ?? '50% 50%', variants };
  }

  // BLDC posters come from the product data itself.
  for (const model of range.bldc) {
    if (!model.poster) continue;
    const key = `bldc-${model.id}`;
    out[key] = {
      alt: `Aparna ${model.name} BLDC ceiling fan poster`,
      position: '50% 50%',
      variants: await writeImage(path.join(PACK, model.poster), path.join('media', key), { widths: [640, 1200] }),
    };
    model.image = key;
    delete model.poster;
  }
  return out;
}

async function copyBrandFiles() {
  const logo = path.join(PACK, '01_Brand', 'logo');
  const brand = path.join(PUBLIC, 'brand');
  await fs.mkdir(brand, { recursive: true });
  await fs.copyFile(path.join(logo, 'aparna-emblem-diya.svg'), path.join(brand, 'aparna-emblem-diya.svg'));
  // Wordmark alone: only used in the loader, where the emblem is already on screen (brief §4.1).
  await fs.copyFile(path.join(logo, 'aparna-wordmark-red.svg'), path.join(brand, 'aparna-wordmark-red.svg'));
  await fs.copyFile(
    path.join(logo, 'aparna-logo-stacked-RED-wordmark (use on white or ivory).svg'),
    path.join(brand, 'aparna-logo-stacked-red.svg'),
  );
  await fs.copyFile(
    path.join(logo, 'aparna-logo-stacked-WHITE-wordmark (use on Aparna red).svg'),
    path.join(brand, 'aparna-logo-stacked-white.svg'),
  );
  const icon = path.join(logo, 'aparna-app-icon-1024.png');
  await sharp(icon).resize(48).png().toFile(path.join(PUBLIC, 'favicon.png'));
  await sharp(icon).resize(180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

  // The catalogue download. Kept under one stable name so a newer catalogue can replace it.
  const downloads = path.join(PUBLIC, 'downloads');
  await fs.mkdir(downloads, { recursive: true });
  const pdfSrc = path.join(PACK, '02_Catalogue_2026', 'Aparna-Catalogue-2026.pdf');
  const pdfOut = path.join(downloads, 'aparna-catalogue.pdf');
  const [a, b] = await Promise.all([fs.stat(pdfSrc), fs.stat(pdfOut).catch(() => null)]);
  if (!b || a.size !== b.size) await fs.copyFile(pdfSrc, pdfOut);
  return { catalogue: { file: '/downloads/aparna-catalogue.pdf', sizeMb: +(a.size / 1048576).toFixed(1) } };
}

const range = await buildRangeData();
const media = await buildMedia(range);
const downloads = await copyBrandFiles();

await fs.writeFile(
  path.join(CONTENT, 'range.generated.json'),
  JSON.stringify({ ...range, media, downloads }, null, 2),
);

console.log(`Categories: ${range.categories.map((c) => `${c.name} (${c.count})`).join(', ')}`);
console.log(`BLDC models: ${range.bldc.map((m) => m.name).join(', ')}`);
console.log(`Images: ${Object.keys(media).length}`);

// ---------------------------------------------------------------- the full catalogue (milestone M2)

const catalogue = await buildCatalogue({ pack: PACK, publicDir: PUBLIC, contentDir: CONTENT });
await fs.writeFile(path.join(CONTENT, 'catalogue.generated.json'), JSON.stringify(catalogue, null, 2));
const pages = await writePageShells(ROOT, catalogue);

const withImage = catalogue.products.filter((p) => p.images.length).length;
console.log(`Catalogue: ${catalogue.products.length} products in ${catalogue.categories.length} categories, ${withImage} with an image, ${pages.length} pages`);
if (catalogue.missing.length) {
  console.error(`Missing from the catalogue: ${catalogue.missing.join(', ')}`);
  process.exit(1);
}
