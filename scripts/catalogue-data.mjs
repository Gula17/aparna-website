// Builds the full product catalogue for the website from the pack's aparna-products.json.
// Used by prepare-content.mjs. Output: src/content/catalogue.generated.json (never edit it by hand).
//
// Rules (brief §3, §7 and the data's own _read_me):
//   - show status current / new / launch; hide confirm; never show discontinued products
//   - publish only verified specs (never anything under specs.unverified_from_sheet), and also hold back
//     specs that a product's notes say must be confirmed first (SPEC_HOLDS below)
//   - no price, ever (the data has none)
//   - images: the product's own photos and posters, then its crop from the catalogue page
//     (src/content/product-images.json). No image is ever borrowed from another product.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SHOWABLE = new Set(['current', 'new', 'launch']);

// Notes that hold back a spec until Aparna confirms it.
const SPEC_HOLDS = [
  { match: /confirm before publishing an rpm/i, hide: ['rpm'] },
  { match: /wattage and rpm as printed.*confirm before publishing/i, hide: ['rpm', 'power'] },
  { match: /do not publish rpm, air delivery or wattage/i, hide: ['rpm', 'air_delivery_cmm', 'power'] },
];

// Images that must never be shown as a product photo.
const SIDEWAYS = /standee/i; // photo files that need turning upright
const NEVER_AS_PRODUCT_IMAGE = [/^04_Product_Posters\/12 /]; // poster 12 is AI-made (brief §14)

const SPEC_LABELS = {
  rpm: { label: 'Speed', unit: ' RPM' },
  air_delivery_cmm: { label: 'Air delivery', unit: ' CMM' },
  power: { label: 'Power' },
  tank: { label: 'Tank' },
  top: { label: 'Top' },
  frame: { label: 'Frame' },
  versions: { label: 'Versions' },
  weight_class: { label: 'Weight' },
  warranty: { label: 'Warranty' },
};

// Featured first (brief §7.2): BLDC, then new launches, then the series in catalogue order.
const FEATURED_GROUPS = [/^BLDC/, /^Signature/, /^New premium/];

export const slugify = (text) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const idSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function verifiedSpecs(p) {
  const held = new Set(SPEC_HOLDS.filter((h) => h.match.test(p.notes ?? '')).flatMap((h) => h.hide));
  return Object.entries(p.specs ?? {})
    .filter(([key, value]) => key !== 'unverified_from_sheet' && !held.has(key) && value !== null && value !== '')
    .sort(([a], [b]) => Object.keys(SPEC_LABELS).indexOf(a) - Object.keys(SPEC_LABELS).indexOf(b))
    .map(([key, value]) => ({ key, label: SPEC_LABELS[key]?.label ?? key, value: `${value}${typeof value === 'number' ? SPEC_LABELS[key]?.unit ?? '' : ''}` }));
}

// One plain sentence built only from the data (no claims). Overridable per product.
function describe(p) {
  const size = p.size_inch ? `${p.size_inch}" (${p.size_mm} mm) ` : '';
  const series = p.group.replace(/\s*\(.*\)\s*$/, '');
  const type = /^[A-Z]{2}/.test(p.type) ? p.type : p.type.charAt(0).toLowerCase() + p.type.slice(1); // keep BLDC, AC-DC
  const article = !size && /^[aeiou]/i.test(type) ? 'an' : 'a'; // a 48" fan, an air cooler
  const range = /series|range/i.test(series) ? series : `${series} range`;
  return `The ${p.name} is ${article} ${size}${type} in Aparna's ${range}.`;
}

function sortKey(p, index) {
  const featured = FEATURED_GROUPS.findIndex((re) => re.test(p.group));
  const isNew = p.status === 'launch' ? 0 : 1;
  return [featured === -1 ? 9 : featured, isNew, index].join('.');
}

// ---------------------------------------------------------------- images

class ImageWriter {
  constructor(pack, publicDir) {
    this.pack = pack;
    this.publicDir = publicDir;
    this.done = new Map(); // key -> media entry
  }

  async write(key, src, { crop, alt, kind }) {
    if (this.done.has(key)) return { ...this.done.get(key), alt, kind };
    const input = path.join(this.pack, src);
    const meta = await sharp(input).metadata();
    const variants = [];
    for (const width of [480, 960]) {
      let img = sharp(input).rotate();
      if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
      let sourceWidth = crop ? crop[2] : meta.width;
      // The event standees were photographed lying on their side: turn them upright (after cropping, so
      // crop boxes stay in the original photo's coordinates).
      if (SIDEWAYS.test(src)) {
        img = sharp(await img.toBuffer()).rotate(270);
        sourceWidth = crop ? crop[3] : meta.height;
      }
      // Small catalogue crops are enlarged (at most 2x, high-quality Lanczos filter) and lightly sharpened, so
      // they don't look soft on large screens. Standard resampling only: no detail is invented.
      const target = Math.min(width, Math.round(sourceWidth * 2));
      img = img.resize({ width: target, kernel: 'lanczos3' });
      if (target > sourceWidth) img = img.sharpen({ sigma: 0.8, m1: 0.6, m2: 1.6 });
      const file = `media/products/${key}-${width}.webp`;
      const info = await img.webp({ quality: 74 }).toFile(path.join(this.publicDir, file));
      variants.push({ file: `/${file}`, width: info.width, height: info.height });
    }
    const entry = { variants };
    this.done.set(key, entry);
    return { ...entry, alt, kind };
  }
}

export async function buildCatalogue({ pack, publicDir, contentDir }) {
  const data = JSON.parse(await fs.readFile(path.join(pack, '03_Product_Data', 'aparna-products.json'), 'utf8'));
  const crops = JSON.parse(await fs.readFile(path.join(contentDir, 'product-images.json'), 'utf8').catch(() => '{}'));
  const overrides = JSON.parse(await fs.readFile(path.join(contentDir, 'product-overrides.json'), 'utf8').catch(() => '{}'));
  const discontinued = (data.discontinued_do_not_show ?? []).map((d) => (d.name ?? d).toString().toLowerCase());
  await fs.mkdir(path.join(publicDir, 'media', 'products'), { recursive: true });
  const images = new ImageWriter(pack, publicDir);

  const shown = data.products.filter((p) => SHOWABLE.has(p.status) && !discontinued.some((d) => d.startsWith(p.name.toLowerCase())));
  const products = [];

  for (const [index, p] of shown.entries()) {
    const categorySlug = slugify(p.category);
    const prefix = `${idSlug(p.category)}-`;
    const slug = p.id.startsWith(prefix) ? p.id.slice(prefix.length) : p.id;
    const extra = overrides[p.id] ?? {};

    // Gallery: this model cut out of a shared poster or photo (if listed), its poster, the model cropped from
    // its catalogue page, then event photos.
    const gallery = [];
    for (const [i, extra] of (crops[p.id]?.crops ?? []).entries()) {
      gallery.push(await images.write(`own-${p.id}-${i}`, extra.src, { crop: extra.crop, alt: `The Aparna ${p.name}`, kind: extra.kind ?? 'poster' }));
    }
    const photos = [];
    for (const [i, src] of (p.photos ?? []).entries()) {
      if (NEVER_AS_PRODUCT_IMAGE.some((re) => re.test(src))) continue;
      photos.push(await images.write(`photo-${idSlug(path.basename(src, path.extname(src)))}`, src, { alt: `${p.name}: photo ${i + 1}`, kind: 'photo' }));
    }
    if (p.poster && !crops[p.id]?.noPoster && !NEVER_AS_PRODUCT_IMAGE.some((re) => re.test(p.poster))) {
      gallery.push(await images.write(`poster-${idSlug(path.basename(p.poster, path.extname(p.poster)))}`, p.poster, { alt: `Aparna poster for the ${p.name}`, kind: 'poster' }));
    }
    const crop = crops[p.id];
    if (crop?.page && crop?.crop) {
      gallery.push(await images.write(`crop-${p.id}`, `02_Catalogue_2026/pages/${crop.page}`, { crop: crop.crop, alt: `The ${p.name} in Aparna Catalogue 2026`, kind: 'catalogue' }));
    }
    gallery.push(...photos); // event photos last: posters and catalogue pictures show the model more clearly

    products.push({
      id: p.id,
      slug,
      url: `/products/${categorySlug}/${slug}/`,
      name: p.name,
      modelNumber: extra.modelNumber ?? null, // not in the data yet: shown as "to be confirmed"
      category: p.category,
      categorySlug,
      series: p.group,
      type: p.type,
      sizeInch: p.size_inch ?? null,
      sizeMm: p.size_mm ?? null,
      colours: p.colours ?? [],
      specs: verifiedSpecs(p),
      features: (p.features ?? []).map((f) => f.replace(/\s*\(catalogue claim\)/i, '')),
      badges: p.badges ?? [],
      status: p.status, // current | new | launch
      description: extra.description ?? describe(p),
      catalogue: p.catalogue_leaf ? { leaf: p.catalogue_leaf.leaf, pages: p.catalogue_leaf.printed_pages } : null,
      images: gallery,
      sort: sortKey(p, index),
    });
  }

  const categories = data.categories
    .map((c) => ({ name: c.name, slug: slugify(c.name), count: products.filter((p) => p.category === c.name).length }))
    .filter((c) => c.count > 0);

  // Every product id in the data's showable list must be in the catalogue.
  const missing = data.products.filter((p) => SHOWABLE.has(p.status) && !products.some((x) => x.id === p.id));
  return { products, categories, missing: missing.map((p) => p.id) };
}
