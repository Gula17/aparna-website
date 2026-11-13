// Small square thumbnails for the header's Products menu: one per category, made from a verified product
// cutout (src/content/cutouts.generated.json). The product is the category's signature pick
// (src/content/signature-products.json, the "Ek naam, poori range" picks), else its first product with a cutout.
// Run after npm run cutouts (npm run build does). Output: public/media/menu/<category>-96.webp and -192.webp
// and src/content/menu.generated.json (never edit it by hand).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
const root = path.resolve(import.meta.dirname, '..');
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));

const catalogue = await read('src/content/catalogue.generated.json');
const cutouts = (await read('src/content/cutouts.generated.json')).products;
const signature = (await read('src/content/signature-products.json')).categories;
const outDir = path.join(root, 'public/media/menu');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const menu = {};
for (const c of catalogue.categories) {
  const ids = catalogue.products.filter((p) => p.categorySlug === c.slug)
    .sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true })).map((p) => p.id);
  const id = [signature[c.name], ...ids].find((x) => x && ids.includes(x) && cutouts[x]);
  if (!id) { console.warn(`Menu: no cutout for ${c.name}, its tile has no picture`); continue; }
  if (signature[c.name] && id !== signature[c.name]) console.warn(`Menu: ${signature[c.name]} is not shown or has no cutout, ${c.name} uses ${id}`);
  const source = path.join(root, 'public', cutouts[id].variants.at(-1).file);
  // trim the empty space round the product, then fit it in a transparent square
  const trimmed = await sharp(source).trim({ threshold: 1 }).toBuffer();
  const variants = [];
  for (const size of [96, 192]) {
    const file = `/media/menu/${c.slug}-${size}.webp`;
    await sharp(trimmed).resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(root, 'public', file));
    variants.push({ file, width: size, height: size });
  }
  menu[c.slug] = { id, variants };
}
await fs.writeFile(path.join(root, 'src/content/menu.generated.json'), `${JSON.stringify({ categories: menu }, null, 2)}\n`);
console.log(`Menu thumbnails: ${Object.keys(menu).length} of ${catalogue.categories.length} categories`);
