// Builds the full product catalogue for the website from the pack's aparna-products.json.
// Used by prepare-content.mjs. Output: src/content/catalogue.generated.json (never edit it by hand).
//
// Rules (brief §3, §7 and the data's own _read_me):
//   - show status current / new / launch; hide confirm; never show discontinued products
//   - publish only verified specs (never anything under specs.unverified_from_sheet), and also hold back
//     specs that a product's notes say must be confirmed first (SPEC_HOLDS below)
//   - no price, ever (the data has none)
//   - images: Aparna's studio photos (src/content/studio-photos.json), the product's own photos and posters,
//     then its crop from the catalogue page (src/content/product-images.json). A studio photo is shared by two
//     models only where Aparna's own catalogue prints one picture for both (listed in studio-photos.json).
//   - products in the studio photos but not in the data are shown as "details coming soon" (status 'soon')

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { aiUpscale } from './ai-upscale.mjs';

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

  async write(key, src, { crop, alt, kind, colour = null }) {
    const extra = { alt, kind, ...(colour ? { colour } : {}) };
    if (this.done.has(key)) return { ...this.done.get(key), ...extra };
    const input = path.isAbsolute(src) ? src : path.join(this.pack, src);
    const studio = kind === 'studio'; // Aparna's studio photos: already on a transparent background
    // The master picture: the crop, turned upright where needed. The event standees were photographed lying
    // on their side (turned after cropping, so crop boxes stay in the original photo's coordinates).
    let img = sharp(input).rotate();
    if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    let master = await img.png().toBuffer();
    if (SIDEWAYS.test(src)) master = await sharp(master).rotate(270).png().toBuffer();
    let opaque = false;
    if (studio) {
      // every studio photo has a thin dark frame line round its edge: cut it off, then drop the empty margin
      const m = await sharp(master).metadata();
      master = await sharp(master).extract({ left: 3, top: 3, width: m.width - 6, height: m.height - 6 }).png().toBuffer();
      const { data } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      opaque = data[3] > 200; // a few came on a white background instead of a transparent one
      master = await sharp(master).trim({ threshold: 10 }).png().toBuffer();
    }
    const { width: mw, height: mh } = await sharp(master).metadata();
    // Small catalogue crops are upscaled 4x with AI (scripts/ai-upscale.mjs: the product's own photo, sharpened,
    // nothing new drawn), so they stay crisp up to full-HD size. Without the upscaler: Lanczos, at most 2x.
    // Studio photos are sharp already and are never enlarged.
    let upscaled = !studio && Math.max(mw, mh) < 1100 ? await aiUpscale(master) : null;
    if (upscaled) {
      // the smallest catalogue crops (under ~360 px) are still short of full-HD after one pass: a second pass
      const once = await sharp(upscaled).metadata();
      if (Math.max(once.width, once.height) < 1440) upscaled = (await aiUpscale(upscaled)) ?? upscaled;
      master = upscaled;
    }
    const limit = upscaled ? Infinity : studio ? 1 : 2; // how far a picture may be enlarged
    const variants = [];
    // sizes: 480, 960 and (when there are the pixels for it) a 1440 version for full-HD and high-DPI screens
    for (const [width, maxH] of [[480, 720], [960, 1440], [1440, 2160]]) {
      const meta = await sharp(master).metadata();
      const scale = Math.min(width / meta.width, maxH / meta.height, upscaled ? 1 : limit);
      const tw = Math.round(meta.width * scale);
      if (width === 1440 && tw <= (variants.at(-1)?.width ?? 0) * 1.15) break; // no real gain over the 960 one
      let out = sharp(master).resize({ width: tw, kernel: 'lanczos3' });
      if (scale > 1) out = out.sharpen({ sigma: 0.8, m1: 0.6, m2: 1.6 });
      const file = `media/products/${key}-${width}.webp`;
      const info = await out.webp({ quality: width === 1440 ? 78 : 76 }).toFile(path.join(this.publicDir, file));
      variants.push({ file: `/${file}`, width: info.width, height: info.height });
    }
    const entry = { variants, ...(opaque ? { opaque: true } : {}) };
    this.done.set(key, entry);
    return { ...entry, ...extra };
  }
}

export async function buildCatalogue({ pack, publicDir, contentDir }) {
  const data = JSON.parse(await fs.readFile(path.join(pack, '03_Product_Data', 'aparna-products.json'), 'utf8'));
  const crops = JSON.parse(await fs.readFile(path.join(contentDir, 'product-images.json'), 'utf8').catch(() => '{}'));
  const overrides = JSON.parse(await fs.readFile(path.join(contentDir, 'product-overrides.json'), 'utf8').catch(() => '{}'));
  const discontinued = (data.discontinued_do_not_show ?? []).map((d) => (d.name ?? d).toString().toLowerCase());
  // Aparna's studio photos (src/content/studio-photos.json): each product's main picture where there is one
  const studio = JSON.parse(await fs.readFile(path.join(contentDir, 'studio-photos.json'), 'utf8').catch(() => '{"photos":{},"comingSoon":[]}'));
  const studioDir = path.resolve(contentDir, '..', '..', studio.source ?? '');
  await fs.mkdir(path.join(publicDir, 'media', 'products'), { recursive: true });
  const images = new ImageWriter(pack, publicDir);
  const studioImage = (file, name, colour, role) => images.write(`studio-${idSlug(path.basename(file, '.png'))}`, path.join(studioDir, file), {
    alt: role === 'range' ? `The Aparna ${name} in its colours` : `The Aparna ${name}${colour ? ` in ${colour}` : ''}`, kind: 'studio', colour,
  });

  const shown = data.products.filter((p) => SHOWABLE.has(p.status) && !discontinued.some((d) => d.startsWith(p.name.toLowerCase())));
  const products = [];

  for (const [index, p] of shown.entries()) {
    const categorySlug = slugify(p.category);
    const prefix = `${idSlug(p.category)}-`;
    const slug = p.id.startsWith(prefix) ? p.id.slice(prefix.length) : p.id;
    const extra = overrides[p.id] ?? {};

    // Gallery: Aparna's studio photos (one per colour), this model cut out of a shared poster or photo (if
    // listed), its poster, the model cropped from its catalogue page, then event photos.
    const gallery = [];
    // colour: the listed colour it shows; for models with no colour list in the data, the colour seen in the photo
    for (const s of studio.photos?.[p.id] ?? []) gallery.push(await studioImage(s.file, p.name, s.colour ?? s.shows ?? null, s.role));
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

  // Products in Aparna's studio photos that are not in the product data yet: shown with their photo and
  // "details coming soon" (no specs, no made-up name: a plain description of what the photo shows).
  for (const [i, s] of (studio.comingSoon ?? []).entries()) {
    const categorySlug = slugify(s.category);
    const slug = s.id.startsWith(`${idSlug(s.category)}-`) ? s.id.slice(idSlug(s.category).length + 1) : s.id;
    const gallery = [];
    for (const file of s.files) gallery.push(await studioImage(file, s.name, null));
    products.push({
      id: s.id, slug, url: `/products/${categorySlug}/${slug}/`, name: s.name, modelNumber: null,
      category: s.category, categorySlug, series: s.series ?? 'Coming soon', type: s.type,
      sizeInch: null, sizeMm: null, colours: [], specs: [], features: [], badges: [],
      status: 'soon', // details coming soon
      description: `Aparna ${s.type.toLowerCase()}. Its name and full details are coming soon.`,
      catalogue: null, images: gallery, sort: `9.9.${String(i).padStart(3, '0')}`,
    });
  }

  const known = new Set(data.categories.map((c) => c.name));
  const extraCategories = [...new Set(products.map((p) => p.category).filter((c) => !known.has(c)))];
  const categories = [...data.categories.map((c) => c.name), ...extraCategories]
    .map((name) => ({ name, slug: slugify(name), count: products.filter((p) => p.category === name).length }))
    .filter((c) => c.count > 0);

  // Every product id in the data's showable list must be in the catalogue.
  const missing = data.products.filter((p) => SHOWABLE.has(p.status) && !products.some((x) => x.id === p.id));
  return { products, categories, missing: missing.map((p) => p.id) };
}
