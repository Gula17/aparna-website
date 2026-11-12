// Runs after every build and fails it if any hard rule from the brief (§3, §12) is broken:
//   - no money words anywhere in the built HTML/JS/CSS
//   - no hidden ("confirm") or discontinued product on any page, no unverified specs
//   - preview stays noindex
//   - every /media/ file a page refers to is in the build
// It also prints the gzipped size of each JS file against the §9 budget.

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACK = path.join(ROOT, 'Aparna Website Build Pack (Nov 2026)', 'Aparna Website Build Pack (Nov 2026)');

// The MRP is shown (since 2026-11-12, at Gul's request, only from src/content/mrp.json), so ₹ and "MRP" are
// allowed; offer and dealer prices and every other selling word are not. Each ₹ figure on a product page is
// checked against that product's MRPs below.
const MONEY = [/\bRs\.?\s?\d/, /\boffer price/i, /\bdealer price/i, /\bDLP\b/, /\boffers?\b/i, /\bEMI\b/, /\bdiscount/i, /\bbuy now\b/i, /add to cart/i];

async function files(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else out.push(full);
  }
  return out;
}

const problems = [];
const all = await files(DIST);
const text = all.filter((f) => /\.(html|js|css|json|txt|svg)$/.test(f));
const htmlFiles = text.filter((f) => f.endsWith('.html'));

for (const file of text) {
  const body = await fs.readFile(file, 'utf8');
  for (const re of MONEY) {
    const m = body.match(re);
    if (m) problems.push(`${path.relative(DIST, file)}: money/selling word "${m[0]}"`);
  }
}

const data = JSON.parse(await fs.readFile(path.join(PACK, '03_Product_Data', 'aparna-products.json'), 'utf8'));
const shown = new Set(data.products.filter((p) => p.status !== 'confirm').map((p) => p.name.toLowerCase()));
// Only flag names that belong solely to hidden products (some hidden items share a name with a shown one).
const hiddenNames = data.products.filter((p) => p.status === 'confirm' && !shown.has(p.name.toLowerCase())).map((p) => p.name);
const banned = [...hiddenNames, 'Bliss', 'Alpha 1', 'Alpha 3', 'unverified'];

for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  // Visible text plus alt/aria text; class names like "hero" are not content.
  // (Image file names, e.g. in og:image, are not content.)
  const labels = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"|name="description" content="([^"]*)"/g)].map((m) => m[1] ?? m[2]).join(' ');
  const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
  const page = `${visible} ${labels}`;
  for (const name of banned) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(page)) problems.push(`${path.relative(DIST, file)}: hidden or discontinued item "${name}" is on the page`);
  }
  if (!/name="robots" content="noindex/.test(html)) problems.push(`${path.relative(DIST, file)}: missing noindex`);
}

// Every picture a page asks for must be in the build (OneDrive has deleted freshly written files before).
const present = new Set(all.map((f) => `/${path.relative(DIST, f).replace(/\\/g, '/')}`));
const missingMedia = new Set();
for (const file of text) {
  const body = await fs.readFile(file, 'utf8');
  for (const m of body.matchAll(/\/media\/[\w\-./]+?\.(?:webp|png|jpe?g|svg|pdf|mp4)/g)) if (!present.has(m[0])) missingMedia.add(m[0]);
}
for (const m of missingMedia) problems.push(`missing file ${m} (run npm run content / cutouts again)`);

// Every ₹ figure in a product page's own details is one of that product's MRPs from the price lists.
const mrpData = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/mrp.json'), 'utf8').catch(() => '{"prices":{},"variants":{}}'));
const catalogueData = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/catalogue.generated.json'), 'utf8'));
for (const p of catalogueData.products) {
  const body = await fs.readFile(path.join(DIST, p.url, 'index.html'), 'utf8').catch(() => null);
  if (!body) continue;
  const start = body.indexOf('product__info');
  const own = start < 0 ? '' : body.slice(start, body.indexOf('</section>', start));
  const allowed = new Set([mrpData.prices[p.id]?.mrp, ...(mrpData.variants[p.id] ?? []).map((v) => v.mrp)].filter(Boolean));
  for (const m of own.matchAll(/₹([\d,]+)/g)) {
    if (!allowed.has(Number(m[1].replace(/,/g, '')))) problems.push(`${p.url}: ₹${m[1]} is not an MRP of ${p.id}`);
  }
}

console.log('\nJS (gzipped)   budget: initial < 200 KB, 3D chunk < 600 KB');
for (const file of all.filter((f) => f.endsWith('.js'))) {
  const gz = zlib.gzipSync(await fs.readFile(file)).length;
  console.log(`  ${(gz / 1024).toFixed(1).padStart(7)} KB  ${path.relative(DIST, file)}`);
}

if (problems.length) {
  console.error(`\nBuild check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nBuild check passed: MRP only (no offer or dealer prices), no hidden products, noindex on every page, no missing pictures.');
