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

// Size versions: one model made in more than one size, found as products in the same category with the same name,
// each a different size (a new size joins its family by itself). Different names (Ultima 1401 / 1402, wattage
// versions) are never merged. The catalogue shows a family as one card; every size keeps its own page, data and
// MRP. Each member gets `family`: all its sizes, smallest first (id, url, size, MRP), whether it is the one the
// card shows (lead: the smallest), and the card's size-neutral description.
function sizeFamilies(products) {
  const groups = new Map();
  for (const p of products) {
    if (!p.sizeInch) continue;
    const key = `${p.categorySlug}|${p.name.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const families = [...groups.values()].filter((list) => list.length > 1 && new Set(list.map((p) => p.sizeInch)).size === list.length);
  for (const list of families) {
    list.sort((a, b) => a.sizeInch - b.sizeInch);
    const sizes = list.map((p) => ({ id: p.id, url: p.url, sizeInch: p.sizeInch, sizeMm: p.sizeMm, mrp: p.mrp?.value ?? null, mrpVaries: Boolean(p.mrp?.varies) }));
    const lead = list[0];
    const series = lead.series.replace(/\s*\(.*\)\s*$/, '');
    const type = /^[A-Z]{2}/.test(lead.type) ? lead.type : lead.type.charAt(0).toLowerCase() + lead.type.slice(1);
    const range = /series|range/i.test(series) ? series : `${series} range`;
    const inches = sizes.map((s) => `${s.sizeInch}"`);
    const sizeWords = `${inches.slice(0, -1).join(', ')} and ${inches.at(-1)}`;
    const description = `The ${lead.name} is ${/^[aeiou]/i.test(type) ? 'an' : 'a'} ${type} in Aparna's ${range}, in ${sizeWords} sizes.`;
    for (const [i, p] of list.entries()) p.family = { sizes, lead: i === 0, description };
  }
  return families;
}

function sortKey(p, index) {
  const featured = FEATURED_GROUPS.findIndex((re) => re.test(p.group));
  const isNew = p.status === 'launch' ? 0 : 1;
  return [featured === -1 ? 9 : featured, isNew, index].join('.');
}

// ---------------------------------------------------------------- images

class ImageWriter {
  constructor(pack, publicDir, boxes = {}) {
    this.pack = pack;
    this.publicDir = publicDir;
    this.boxes = boxes; // src/content/product-boxes.json: the product's own area inside a catalogue or price-list crop
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
    // catalogue-page and price-list crops: just the product, without the printed text round it (the page shows
    // the name, sweep and colours as real text); boxes only ever trim (scripts/find-product-boxes.mjs)
    const box = this.boxes[key];
    if (box) {
      const m = await sharp(master).metadata();
      const left = Math.floor(box[0] * m.width), top = Math.floor(box[1] * m.height);
      const width = Math.min(m.width - left, Math.ceil(box[2] * m.width)), height = Math.min(m.height - top, Math.ceil(box[3] * m.height));
      if (width > 8 && height > 8) master = await sharp(master).extract({ left, top, width, height }).png().toBuffer();
    }
    let opaque = false;
    if (studio) {
      // every studio photo has a thin dark frame line round its edge: cut it off, then drop the empty margin
      const m = await sharp(master).metadata();
      master = await sharp(master).extract({ left: 3, top: 3, width: m.width - 6, height: m.height - 6 }).png().toBuffer();
      const { data } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      opaque = data[3] > 200; // a few came on a white background instead of a transparent one
      master = await sharp(master).trim({ threshold: 10 }).png().toBuffer();
    }
    // AI upscaling (Real-ESRGAN, scripts/ai-upscale.mjs) is OFF unless APARNA_AI_UPSCALE=1. Tested on 20 Nov 2026:
    // even one 4x pass invents letter shapes in the small Aparna logos every product carries (New Josh's canopy,
    // a hot plate's badge, a pedestal fan's hub), which breaks the rule of no invented detail. Small crops are shown
    // at their real size instead (at most 1.5x, smaller in their frame). Studio photos are never enlarged.
    const { width: mw, height: mh } = await sharp(master).metadata();
    const upscaled = process.env.APARNA_AI_UPSCALE === '1' && !studio && Math.max(mw, mh) < 1100 ? await aiUpscale(master) : null;
    if (upscaled) master = upscaled;
    // never shown bigger than about 1.5x its real (or upscaled) size; a small source is shown smaller in its frame
    const limit = studio || upscaled ? 1 : 1.5;
    const variants = [];
    // sizes: 480, 960 and (when there are the pixels for it) a 1440 version for full-HD and high-DPI screens
    for (const [width, maxH] of [[480, 720], [960, 1440], [1440, 2160]]) {
      const meta = await sharp(master).metadata();
      const scale = Math.min(width / meta.width, maxH / meta.height, limit);
      const tw = Math.round(meta.width * scale);
      if (width === 1440 && tw <= (variants.at(-1)?.width ?? 0) * 1.15) break; // no real gain over the 960 one
      let out = sharp(master).resize({ width: tw, kernel: 'lanczos3' });
      if (scale > 1) out = out.sharpen({ sigma: 0.8, m1: 0.6, m2: 1.6 });
      const file = `media/products/${key}-${width}.webp`;
      const info = await out.webp({ quality: width === 480 ? 82 : 84 }).toFile(path.join(this.publicDir, file));
      variants.push({ file: `/${file}`, width: info.width, height: info.height });
    }
    const entry = { variants, ...(opaque ? { opaque: true } : {}), ...(upscaled ? { upscaled: true } : {}) };
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
  // MRP only, from Aparna's price lists (src/content/mrp.json). Shown since 2026-11-12 at Gul's request; offer
  // and dealer prices are never kept or shown.
  const listPhotos = JSON.parse(await fs.readFile(path.join(contentDir, 'price-list-photos.json'), 'utf8').catch(() => '{"photos":{}}'));
  const mrpData = JSON.parse(await fs.readFile(path.join(contentDir, 'mrp.json'), 'utf8').catch(() => '{"prices":{},"variants":{}}'));
  const mrpOf = (id) => {
    const p = mrpData.prices?.[id];
    if (!p) return null;
    const variants = (mrpData.variants?.[id] ?? []).map((v) => ({ label: v.variant, mrp: v.mrp }));
    return { value: variants.length ? Math.min(...variants.map((v) => v.mrp)) : p.mrp, variants, varies: new Set(variants.map((v) => v.mrp)).size > 1 };
  };
  const studioDir = path.resolve(contentDir, '..', '..', studio.source ?? '');
  await fs.mkdir(path.join(publicDir, 'media', 'products'), { recursive: true });
  const boxes = JSON.parse(await fs.readFile(path.join(contentDir, 'product-boxes.json'), 'utf8').catch(() => '{}'));
  const images = new ImageWriter(pack, publicDir, boxes);
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
    // Event, exhibition and standee photos are not used as product pictures (they stay on the Events pages).
    if (p.poster && !crops[p.id]?.noPoster && !NEVER_AS_PRODUCT_IMAGE.some((re) => re.test(p.poster))) {
      gallery.push(await images.write(`poster-${idSlug(path.basename(p.poster, path.extname(p.poster)))}`, p.poster, { alt: `Aparna poster for the ${p.name}`, kind: 'poster' }));
    }
    const crop = crops[p.id];
    if (crop?.page && crop?.crop) {
      gallery.push(await images.write(`crop-${p.id}`, `02_Catalogue_2026/pages/${crop.page}`, { crop: crop.crop, alt: `The ${p.name} in Aparna Catalogue 2026`, kind: 'catalogue' }));
    }
    // no picture anywhere else: the photo printed beside it in Aparna's price list (src/content/price-list-photos.json)
    const listPhoto = listPhotos.photos?.[p.id];
    // still nothing, but it has a 3D model: a still of its own 3D model (scripts/render-model-stills.mjs)
    const render = path.join(contentDir, 'model-renders', `${p.id}.png`);
    if (!gallery.length && !listPhoto && (await fs.access(render).then(() => true, () => false))) {
      gallery.push(await images.write(`render-${p.id}`, render, { alt: `The ${p.name}, as its 3D model`, kind: 'render' }));
    }
    if (!gallery.length && listPhoto) gallery.push(await images.write(`pricelist-${p.id}`, path.resolve(contentDir, '..', '..', listPhoto.image), { alt: `The ${p.name}, as pictured in Aparna's price list`, kind: 'catalogue' }));

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

  // Products in Aparna's price lists that are not in the product data yet (src/content/price-list-products.json):
  // their names, sizes and specs exactly as printed, and their photo cropped from the list.
  const priceList = JSON.parse(await fs.readFile(path.join(contentDir, 'price-list-products.json'), 'utf8').catch(() => '{"products":[]}'));
  for (const [i, s] of priceList.products.entries()) {
    if (products.some((x) => x.id === s.id)) continue;
    const categorySlug = slugify(s.category);
    const slug = s.id.startsWith(`${idSlug(s.category)}-`) ? s.id.slice(idSlug(s.category).length + 1) : s.id;
    const size = s.sizeInch ? `${s.sizeInch}" ` : '';
    const gallery = [];
    for (const [k, file] of (s.images ?? (s.image ? [s.image] : [])).entries()) {
      gallery.push(await images.write(`pricelist-${s.id}${k ? `-${k + 1}` : ''}`, path.resolve(contentDir, '..', '..', file), { alt: `The ${s.name}${s.sizeInch ? ` ${s.sizeInch}"` : ''}, as pictured in Aparna's price list`, kind: 'catalogue' }));
    }
    products.push({
      id: s.id, slug, url: `/products/${categorySlug}/${slug}/`, name: s.name, modelNumber: null,
      category: s.category, categorySlug, series: s.category, type: s.type,
      sizeInch: s.sizeInch ?? null, sizeMm: null, colours: [], badges: [], features: [],
      specs: (s.specs ?? []).map((x) => ({ key: x.label, label: x.label, value: x.value })),
      status: 'current',
      description: `The ${s.name} is a ${size}${s.type.toLowerCase()} in Aparna's ${s.category.toLowerCase()} range.`,
      catalogue: null, images: gallery, sort: `8.9.${String(i).padStart(3, '0')}`,
    });
  }

  for (const p of products) p.mrp = mrpOf(p.id);
  const families = sizeFamilies(products);

  // Counts: a model made in several sizes is one card in the catalogue, so it counts once (each size still has
  // its own page)
  const known = new Set(data.categories.map((c) => c.name));
  const extraCategories = [...new Set(products.map((p) => p.category).filter((c) => !known.has(c)))];
  const onCard = (p) => !p.family || p.family.lead;
  const categories = [...data.categories.map((c) => c.name), ...extraCategories]
    .map((name) => ({ name, slug: slugify(name), count: products.filter((p) => p.category === name && onCard(p)).length }))
    .filter((c) => c.count > 0);

  // Every product id in the data's showable list must be in the catalogue.
  const missing = data.products.filter((p) => SHOWABLE.has(p.status) && !products.some((x) => x.id === p.id));
  console.log(`Size families: ${families.map((f) => `${f[0].name} (${f.map((p) => `${p.sizeInch}"`).join(', ')})`).join('; ') || 'none'}`);
  return { products, categories, cardCount: products.filter(onCard).length, missing: missing.map((p) => p.id) };
}
