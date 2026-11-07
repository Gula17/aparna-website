// Catalogue pages (milestone M2), rendered at build time from src/content/catalogue.generated.json:
//   renderCatalogue  /products/ and /products/<category>/   cards + search, filters, sorting
//   renderProduct    /products/<category>/<model>/           one product: gallery, colours, specs, related
//   renderList       /my-list/                               the visitor's saved list
// No prices, no cart, no buying (brief §3): the calls to action are save, share, catalogue, ask your shop.

import { esc, fmt } from './helpers.js';
import { siteHeader, siteFooter, heartIcon } from './layout.js';
import { PRODUCT_MODELS, FINISH_KEYS, PICTURED_COLOUR, POSTER_FINISHES } from '../three/models.js';

const DATA_COLOUR_TO_FINISH = FINISH_KEYS; // colour name -> 3D finish (src/three/models.js)

// ---------------------------------------------------------------- small pieces

function productImage(img, { className = '', sizes = '320px', eager = false } = {}) {
  const largest = img.variants.at(-1);
  return `<img class="${className}" src="${esc(largest.file)}" srcset="${esc(img.variants.map((v) => `${v.file} ${v.width}w`).join(', '))}"
    sizes="${esc(sizes)}" width="${largest.width}" height="${largest.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// Shown where no image exists yet. Clearly a placeholder, never a picture of another product.
const noPhoto = (t) => `<span class="no-photo"><img src="/brand/aparna-emblem-diya.svg" alt="" width="835" height="600"><span>${esc(t.products.photoSoon)}</span></span>`;

// ---------------------------------------------------------------- the product stage
// Every product stands on a lit "stage": its cutout (the original photo with the background removed,
// scripts/make-cutouts.mjs), a floor shadow, a soft glow and a small effect suited to what it does.
// Each kind of product moves in its own way (src/styles/showroom.css):
//   ceiling   hangs and sways, air rings flow down      oscillate  head turns side to side, breeze lines
//   exhaust   pulses, air is drawn in                    cooler     turns slowly, cool mist rises
//   heat/cook warm glow, heat rises                      iron       glides, steam puffs
//   washer    a short spin-cycle rumble, bubbles
// These are 2.5D effects on real photos. The only true 3D model is the Aeroflow (src/three/).

const MOTION_BY_CATEGORY = {
  'ceiling-fans': 'ceiling',
  'ventilation-and-fresh-air-fans': 'exhaust',
  'air-coolers': 'cooler',
  'washing-machines': 'washer',
  'electric-irons': 'iron',
  'kitchen-appliances': 'cook',
  'heating-and-water': 'heat',
};
export const motionOf = (p) => MOTION_BY_CATEGORY[p.categorySlug] ?? 'oscillate'; // table, wall, pedestal, high-speed, cabin

const FX_PARTS = { ceiling: 3, oscillate: 4, exhaust: 4, cooler: 6, heat: 4, cook: 4, iron: 4, washer: 6 };

function stage(t, p, cut, { sizes, eager = false, extraClass = '' } = {}) {
  const motion = motionOf(p);
  let visual;
  if (cut?.rotor) {
    // Turning blades (scripts/make-rotors.mjs): the still parts, the blade area that turns in the fan's own
    // perspective plane, then the still hub on top. All three come from the product's own photo.
    const r = cut.rotor;
    const srcset = (v) => `src="${esc(v.at(-1).file)}" srcset="${esc(v.map((x) => `${x.file} ${x.width}w`).join(', '))}" sizes="${esc(sizes)}" width="${v.at(-1).width}" height="${v.at(-1).height}"`;
    const load = eager ? 'fetchpriority="high"' : 'loading="lazy"';
    visual = `
      <span class="stage__product stage__product--cutout stage__product--rotor" style="--mask:url('${esc(cut.variants[0].file)}')">
        <span class="stage__motion">
          <span class="rotor-fit" style="--ar:${r.width} / ${r.height}">
            <img class="rotor-layer rotor-layer--base" ${srcset(r.base)} alt="${esc(cut.alt)}" ${load} decoding="async">
            ${r.rotors.map((x) => {
              const origin = `transform-origin:${x.origin[0]}% ${x.origin[1]}%`;
              return `<span class="rotor" style="${origin};transform:matrix(${x.L.join(',')},0,0)"><span class="rotor__spin" style="${origin};--turn:${x.turn}s"><span class="rotor__boost" style="${origin}"><img class="rotor-layer" ${srcset(x.image)} alt="" ${load} decoding="async" style="${origin};transform:matrix(${x.Li.join(',')},0,0)"></span></span></span>`;
            }).join('')}
            <img class="rotor-layer" ${srcset(r.top)} alt="" ${load} decoding="async">
            <span class="stage__sheen" aria-hidden="true"></span>
          </span>
        </span>
      </span>`;
  } else if (cut) {
    const largest = cut.variants.at(-1);
    visual = `
      <span class="stage__product stage__product--cutout" style="--mask:url('${esc(cut.variants[0].file)}')">
        <span class="stage__motion">
          <img class="stage__img" src="${esc(largest.file)}" srcset="${esc(cut.variants.map((v) => `${v.file} ${v.width}w`).join(', '))}"
            sizes="${esc(sizes)}" width="${largest.width}" height="${largest.height}" alt="${esc(cut.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
          <span class="stage__sheen" aria-hidden="true"></span>
        </span>
      </span>`;
  } else if (p.images[0]) {
    // No clean cutout (e.g. an event photo of a whole row of products): shown as a framed photo.
    visual = `
      <span class="stage__product stage__product--framed">
        <span class="stage__motion">${productImage(p.images[0], { className: 'stage__img', sizes, eager })}<span class="stage__sheen" aria-hidden="true"></span></span>
      </span>`;
  } else {
    visual = `<span class="stage__product stage__product--empty">${noPhoto(t)}</span>`;
  }
  return `
    <span class="stage ${extraClass}" data-motion="${motion}">
      <span class="stage__glow" aria-hidden="true"></span>
      <span class="stage__floor" aria-hidden="true"></span>
      <span class="stage__fx" aria-hidden="true">${'<i></i>'.repeat(FX_PARTS[motion])}</span>
      ${visual}
    </span>`;
}

// The product that represents a category: the first one (in featured order) with a clean cutout.
function spotlightFor(catalogue, cutouts, slug) {
  const items = catalogue.products.filter((p) => p.categorySlug === slug).sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
  return items.find((p) => cutouts[p.id]) ?? items.find((p) => p.images[0]) ?? items[0];
}

const swatch = (colours, name) => `<span class="swatch" style="--swatch:${esc(colours[name] ?? '#ccc')}" aria-hidden="true"></span>`;

const statusBadge = (t, p) => (p.status === 'launch' ? `<li class="badge badge--new">${esc(t.products.newLaunch)}</li>` : p.status === 'new' ? `<li class="badge badge--soft">${esc(t.products.newModel)}</li>` : '');

const sizeText = (p) => (p.sizeInch ? `${p.sizeInch}" · ${p.sizeMm} mm` : '');

const saveButton = (t, p, extra = '') => `
  <button class="save-btn ${extra}" type="button" data-save="${esc(p.id)}" aria-pressed="false" aria-label="${esc(fmt(t.products.saveLabel, { name: p.name }))}">
    ${heartIcon}<span class="save-btn__text">${esc(t.products.save)}</span>
  </button>`;

function productCard(t, colours, cutouts, p, { eager = false, index = 0 } = {}) {
  const shownColours = p.colours.slice(0, 5);
  return `
  <li class="product-card" data-id="${esc(p.id)}" data-category="${esc(p.categorySlug)}" data-series="${esc(p.series)}"
      data-type="${esc(p.type)}" data-size="${p.sizeInch ?? ''}" data-colours="${esc(p.colours.join('|'))}" data-new="${p.status !== 'current' ? '1' : ''}"
      data-name="${esc(p.name.toLowerCase())}" data-search="${esc(`${p.name} ${p.series} ${p.type} ${p.category} ${p.colours.join(' ')}`.toLowerCase())}" data-sort="${esc(p.sort)}"
      data-url="${esc(p.url)}" data-title="${esc(p.name)}" data-series-label="${esc(p.series.replace(/\s*\(.*\)\s*$/, ''))}"
      data-meta="${esc([p.type, sizeText(p)].filter(Boolean).join(' · '))}" data-model="${esc(PRODUCT_MODELS[p.id] ?? '')}"
      data-img="${esc(cutouts[p.id]?.variants.at(-1).file ?? p.images[0]?.variants.at(-1).file ?? '')}"
      style="--i:${index % 7}">
    <div class="product-card__inner" data-stage-card>
      <a class="product-card__link" href="${esc(p.url)}">
        ${stage(t, p, cutouts[p.id], { sizes: '(min-width: 1200px) 23vw, (min-width: 640px) 31vw, 47vw', eager, extraClass: 'product-card__stage' })}
        <span class="product-card__body">
          <span class="product-card__series">${esc(p.series.replace(/\s*\(.*\)\s*$/, ''))}</span>
          <span class="product-card__name">${esc(p.name)}</span>
          <span class="product-card__meta">${esc([p.modelNumber ? `${t.product.model} ${p.modelNumber}` : '', p.type, sizeText(p)].filter(Boolean).join(' · '))}</span>
          <span class="product-card__desc">${esc(p.description)}</span>
          <span class="product-card__foot">
            ${shownColours.length ? `<span class="product-card__colours" title="${esc(p.colours.join(', '))}">
              ${shownColours.map((c) => swatch(colours, c)).join('')}${p.colours.length > 5 ? `<span class="product-card__more">+${p.colours.length - 5}</span>` : ''}
              <span class="sr-only">${esc(p.colours.join(', '))}</span></span>` : '<span></span>'}
            <span class="product-card__cta">${esc(t.products.viewDetails)}</span>
          </span>
        </span>
      </a>
      <ul class="badges product-card__badges">${statusBadge(t, p)}${p.badges.filter((b) => b !== 'New launch').slice(0, 2).map((b) => `<li class="badge badge--soft">${esc(b)}</li>`).join('')}</ul>
      ${saveButton(t, p, 'save-btn--icon')}
      <button class="quick-btn" type="button" data-quick aria-label="${esc(fmt(t.showroom.quickLabel, { name: p.name }))}">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <span>${esc(t.showroom.quick)}</span>
      </button>
    </div>
  </li>`;
}

// ---------------------------------------------------------------- facets

function facetValues(products, key) {
  const counts = new Map();
  for (const p of products) {
    const values = key === 'colours' ? p.colours : [p[key]];
    for (const v of values) if (v !== null && v !== undefined && v !== '') counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const entries = [...counts.entries()];
  if (key === 'sizeInch') entries.sort((a, b) => a[0] - b[0]);
  return entries;
}

// One filter as a compact dropdown pill. In the phone drawer the same elements stack and open up,
// so there is only ever one set of checkboxes.
function facet(t, name, label, entries, render = (v) => esc(v)) {
  if (entries.length < 2) return '';
  return `
  <details class="filter-pop" data-facet="${name}">
    <summary class="filter-pop__pill"><span>${esc(label)}</span><span class="filter-pop__count" data-facet-count hidden></span></summary>
    <div class="filter-pop__panel">
      <fieldset class="facet">
        <legend class="sr-only">${esc(label)}</legend>
        ${entries.map(([value, count]) => `
          <label class="facet__option">
            <input type="checkbox" name="${name}" value="${esc(value)}">
            <span>${render(value)}</span><span class="facet__count">${count}</span>
          </label>`).join('')}
      </fieldset>
    </div>
  </details>`;
}

const FILTER_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

// ---------------------------------------------------------------- quick view (src/scenes/quick-view.js)
const quickViewDialog = (t) => `
  <dialog class="preview quick" data-quick-dialog aria-labelledby="quick-title"
      data-badge="${esc(t.product.view360)}" data-viewer-label="${esc(t.preview.viewerLabel)}" data-no-photo="${esc(t.products.photoSoon)}">
    <div class="preview__panel">
      <button class="preview__close" type="button" data-quick-close aria-label="${esc(t.preview.close)}">×</button>
      <div class="preview__media quick__media" data-quick-media></div>
      <div class="preview__body">
        <p class="preview__subhead" data-quick-series></p>
        <h3 class="preview__name" id="quick-title" data-quick-name></h3>
        <p class="quick__meta" data-quick-meta></p>
        <p class="fine-print" data-quick-hint>${esc(t.preview.dragHint)}</p>
        <div class="preview__actions">
          <a class="btn btn--light" href="/products/" data-quick-link>${esc(t.preview.fullDetails)}</a>
          <button class="save-btn btn btn--ghost-light" type="button" data-save="" data-quick-save data-label-template="${esc(t.products.saveLabel)}" aria-pressed="false">${heartIcon}<span class="save-btn__text">${esc(t.products.save)}</span></button>
        </div>
        <p class="preview__where">${esc(t.products.where)}</p>
      </div>
    </div>
  </dialog>`;

// ---------------------------------------------------------------- key numbers and the featured showcase

// The verified specs as big numbers ("310 RPM", "215 CMM", "35 W"), plus the size. Only data from the
// catalogue JSON; a number counts up when it scrolls into view (src/scenes/showcase.js).
function keyNumbers(t, p) {
  const out = [];
  if (p.sizeMm) out.push({ value: String(p.sizeMm), unit: 'mm', label: t.showroom.sizeLabel });
  for (const s of p.specs) {
    const m = String(s.value).match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    out.push(m ? { value: m[1], unit: m[2], label: s.label } : { value: s.value, unit: '', label: s.label });
  }
  return out;
}

const numberTiles = (numbers, className) => `
  <dl class="${className}">
    ${numbers.map((n) => `
      <div class="number-tile" data-reveal>
        <dt>${esc(n.label)}</dt>
        <dd><span class="number-tile__value" ${/^\d+(\.\d+)?$/.test(n.value) ? `data-count-to="${esc(n.value)}"` : ''}>${esc(n.value)}</span>${n.unit ? ` <span class="number-tile__unit">${esc(n.unit)}</span>` : ''}</dd>
      </div>`).join('')}
  </dl>`;

// Four favourites, one per kind of product, each a large scroll-driven showcase on /products/.
// Fans with a real-time 3D model (src/three/models.js) are shown in 3D, blades turning; the others on their stage.
const FEATURED = ['ceiling-fans-aeroflow-48', 'air-coolers-discovery-1201', 'table-wall-pedestal-fans-vistara-16', 'kitchen-appliances-prime'];
const ACCENT_RGB = { ceiling: '241 200 144', oscillate: '236 50 55', exhaust: '92 196 160', cooler: '110 186 255', heat: '255 146 52', cook: '255 104 52', iron: '236 50 55', washer: '72 196 230' };

function showcase(t, catalogue, cutouts) {
  const picks = FEATURED.map((id) => catalogue.products.find((p) => p.id === id)).filter((p) => p && cutouts[p.id]);
  if (!picks.length) return '';
  const s = t.showroom;
  return `
  <section class="showcase" aria-labelledby="showcase-title" data-showcase>
    <div class="showcase__glow" aria-hidden="true"></div>
    <header class="showcase__head">
      <p class="showroom__eyebrow" data-reveal>${esc(s.showcaseEyebrow)}</p>
      <h2 class="showcase__title" id="showcase-title" data-reveal="words">${esc(s.showcaseTitle)}</h2>
      <p class="showroom__lead" data-reveal>${esc(s.showcaseLead)}</p>
    </header>
    ${picks.map((p, i) => {
      const motion = motionOf(p);
      const modelKey = PRODUCT_MODELS[p.id];
      return `
    <article class="feature ${i % 2 ? 'feature--flip' : ''}" data-feature data-accent="${ACCENT_RGB[motion]}" aria-labelledby="feature-${i}">
      <div class="feature__visual" data-3d-visual>
        ${modelKey ? `
        <div class="feature__3d" data-feature-3d>
          <div class="viewer feature__viewer" data-viewer="${esc(modelKey)}" tabindex="0" role="img" aria-label="${esc(fmt(t.preview.viewerLabel, { name: p.name }))}">
            <canvas class="viewer__canvas"></canvas>
            <p class="viewer__hint" aria-hidden="true">${esc(s.real3d)}</p>
          </div>
        </div>` : ''}
        <div class="feature__stagewrap" data-stage-card>${stage(t, p, cutouts[p.id], { sizes: '(min-width: 900px) 48vw, 92vw', extraClass: 'feature__stage' })}</div>
      </div>
      <div class="feature__copy">
        <p class="feature__kicker">${esc(p.category)} · ${esc(p.series.replace(/\s*\(.*\)\s*$/, ''))}</p>
        <h3 class="feature__name" id="feature-${i}">${esc(p.name)}</h3>
        <p class="feature__desc">${esc(p.description)}</p>
        ${p.features.length ? `<ul class="feature__points">${p.features.slice(0, 3).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${numberTiles(keyNumbers(t, p).slice(0, 3), 'feature__numbers')}
        <div class="feature__actions">
          <a class="btn btn--light" href="${esc(p.url)}">${esc(t.products.viewDetails)}</a>
          ${saveButton(t, p, 'btn btn--ghost-light')}
        </div>
      </div>
    </article>`;
    }).join('')}
  </section>`;
}

// ---------------------------------------------------------------- catalogue / category page

// The dark showroom at the top of /products/ (one stage per category) and of each category page
// (the category's spotlight product, large).
function showroom(t, catalogue, cutouts, category, title, lead) {
  const s = t.showroom;
  if (!category) {
    return `
    <section class="showroom" aria-labelledby="page-title">
      <div class="showroom__intro">
        <p class="showroom__eyebrow" data-reveal>${esc(s.eyebrow)}</p>
        <h1 class="showroom__title" id="page-title" data-reveal="words">${esc(title)}</h1>
        <p class="showroom__lead" data-reveal>${esc(lead)}</p>
        <a class="showroom__browse" href="#browse" data-reveal>${esc(fmt(s.browseAll, { count: catalogue.products.length }))} <span aria-hidden="true">↓</span></a>
      </div>
      <h2 class="sr-only">${esc(s.byCategory)}</h2>
      <ul class="showroom__stations" data-stations>
        ${catalogue.categories.map((c, i) => {
          const hero = spotlightFor(catalogue, cutouts, c.slug);
          return `
          <li class="cat-station" style="--i:${i}">
            <a class="cat-station__link" href="/products/${esc(c.slug)}/" data-stage-card>
              ${stage(t, hero, cutouts[hero.id], { sizes: '(min-width: 1100px) 18vw, (min-width: 640px) 30vw, 60vw', eager: i < 5, extraClass: 'cat-station__stage' })}
              <span class="cat-station__text">
                <span class="cat-station__name">${esc(c.name)}</span>
                <span class="cat-station__count">${esc(fmt(s.models, { count: c.count }))}</span>
              </span>
              <span class="cat-station__go" aria-hidden="true">→</span>
            </a>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
  }
  const hero = spotlightFor(catalogue, cutouts, category.slug);
  return `
    <section class="showroom showroom--category" aria-labelledby="page-title">
      <div class="showroom__intro">
        <p class="showroom__eyebrow" data-reveal>${esc(s.eyebrow)}</p>
        <h1 class="showroom__title" id="page-title" data-reveal="words">${esc(title)}</h1>
        <p class="showroom__lead" data-reveal>${esc(lead)}</p>
        <p class="showroom__stat" data-reveal><strong>${category.count}</strong> ${esc(category.count === 1 ? s.model : s.modelsWord)}</p>
      </div>
      <a class="spotlight" href="${esc(hero.url)}" data-stage-card data-spotlight data-3d-visual>
        ${stage(t, hero, cutouts[hero.id], { sizes: '(min-width: 900px) 46vw, 92vw', eager: true, extraClass: 'spotlight__stage' })}
        ${PRODUCT_MODELS[hero.id] ? `
        <span class="spotlight__3d" data-feature-3d aria-hidden="true">
          <span class="viewer spotlight__viewer" data-viewer="${esc(PRODUCT_MODELS[hero.id])}"><canvas class="viewer__canvas"></canvas></span>
        </span>` : ''}
        <span class="spotlight__label"><span class="spotlight__kicker">${esc(s.spotlight)}</span> <span class="spotlight__name">${esc(hero.name)}</span> <span aria-hidden="true">→</span></span>
      </a>
    </section>`;
}

export function renderCatalogue({ t, range, catalogue, colours, cutouts = {}, categorySlug = null }) {
  const category = categorySlug ? catalogue.categories.find((c) => c.slug === categorySlug) : null;
  const products = [...(category ? catalogue.products.filter((p) => p.categorySlug === categorySlug) : catalogue.products)]
    .sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
  const title = category ? category.name : t.products.title;
  const lead = category ? t.categoryLines[category.name] ?? '' : fmt(t.products.lead, { count: catalogue.products.length, categories: catalogue.categories.length });
  const catalogueFile = range.downloads.catalogue.file;

  const facets = [
    category ? '' : facet(t, 'category', t.products.category, catalogue.categories.map((c) => [c.slug, c.count]), (slug) => esc(catalogue.categories.find((c) => c.slug === slug).name)),
    facet(t, 'series', t.products.series, facetValues(products, 'series'), (v) => esc(v.replace(/\s*\(.*\)\s*$/, ''))),
    facet(t, 'type', t.products.type, facetValues(products, 'type')),
    facet(t, 'size', t.products.size, facetValues(products, 'sizeInch'), (v) => `${v}"`),
    facet(t, 'colour', t.products.colour, facetValues(products, 'colours'), (v) => `${swatch(colours, v)} ${esc(v)}`),
  ].join('');
  const hasNew = products.some((p) => p.status !== 'current');

  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories, { catalogueFile })}
  <main id="main" class="catalogue">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol><li><a href="/">${esc(t.product.home)}</a></li>${category ? `<li><a href="/products/">${esc(t.product.products)}</a></li><li aria-current="page">${esc(category.name)}</li>` : `<li aria-current="page">${esc(t.product.products)}</li>`}</ol>
    </nav>

    ${showroom(t, catalogue, cutouts, category, title, lead)}

    ${category ? '' : showcase(t, catalogue, cutouts)}

    <nav class="category-chips" id="browse" aria-label="${esc(t.products.category)}">
      <a href="/products/" ${category ? '' : 'aria-current="page"'}>${esc(t.nav.allProducts)} <span>${catalogue.products.length}</span></a>
      ${catalogue.categories.map((c) => `<a href="/products/${esc(c.slug)}/" ${c.slug === categorySlug ? 'aria-current="page"' : ''}>${esc(c.name)} <span>${c.count}</span></a>`).join('')}
    </nav>

    <div class="filter-bar" data-filter-bar>
      <div class="toolbar">
        <label class="search">
          <span class="sr-only">${esc(t.products.search)}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="search" name="q" placeholder="${esc(t.products.searchPlaceholder)}" autocomplete="off">
        </label>
        <button class="filter-pop__pill toolbar__filters" type="button" data-filters-open aria-controls="filters" aria-expanded="false">
          ${FILTER_ICON}<span>${esc(t.products.showFilters)}</span><span class="filter-pop__count" data-active-count hidden></span>
        </button>
        <div class="filters" id="filters" role="group" aria-label="${esc(t.products.filters)}">
          <div class="filters__head">
            <h2 class="filters__title">${esc(t.products.filters)}</h2>
            <button class="filters__close" type="button" data-filters-close aria-label="${esc(t.showroom.closeFilters)}">×</button>
          </div>
          ${hasNew ? `<label class="filter-pop__pill filter-toggle"><input type="checkbox" name="new" value="1"><span>${esc(t.showroom.newOnly)}</span></label>` : ''}
          ${facets}
          <div class="filters__foot">
            <button class="filters__clear" type="button" data-clear hidden>${esc(t.products.clear)}</button>
            <button class="btn btn--primary filters__done" type="button" data-filters-done>${esc(fmt(t.products.done, { count: products.length }))}</button>
          </div>
        </div>
        <label class="sort">
          <span class="sr-only">${esc(t.products.sort)}</span>
          <select name="sort" aria-label="${esc(t.products.sort)}">
            <option value="featured">${esc(t.products.sortFeatured)}</option>
            <option value="name">${esc(t.products.sortName)}</option>
            <option value="name-desc">${esc(t.products.sortNameDesc)}</option>
            <option value="size">${esc(t.products.sortSizeAsc)}</option>
            <option value="size-desc">${esc(t.products.sortSizeDesc)}</option>
            <option value="new">${esc(t.products.sortNew)}</option>
          </select>
        </label>
      </div>
    </div>

    <section class="results" aria-label="${esc(title)}">
      <p class="results__count" aria-live="polite" data-count data-one="${esc(t.products.result1)}" data-many="${esc(t.products.results)}" data-done="${esc(t.products.done)}">${esc(fmt(t.products.results, { count: products.length }))}</p>
      <ul class="product-grid">
        ${products.map((p, i) => productCard(t, colours, cutouts, p, { eager: i < 4, index: i })).join('')}
      </ul>
      <p class="results__none" data-none hidden>${esc(t.products.none)}</p>
      <p class="results__where">${esc(t.products.where)}</p>
    </section>
  </main>
  ${quickViewDialog(t)}
  ${siteFooter(t, range.media, catalogue.categories)}`;
}

// ---------------------------------------------------------------- product page

function related(catalogue, p) {
  const sameSeries = catalogue.products.filter((x) => x.id !== p.id && x.series === p.series);
  const sameCategory = catalogue.products.filter((x) => x.id !== p.id && x.category === p.category && x.series !== p.series);
  return { list: [...sameSeries, ...sameCategory].slice(0, 4), bySeries: sameSeries.length > 0 };
}

export function renderProduct({ t, range, catalogue, colours, cutouts = {}, id }) {
  const p = catalogue.products.find((x) => x.id === id);
  const cut = cutouts[p.id];
  const catalogueFile = range.downloads.catalogue.file;
  const modelKey = PRODUCT_MODELS[p.id];
  const finishes = modelKey ? p.colours.filter((c) => DATA_COLOUR_TO_FINISH[c]) : [];
  const rel = related(catalogue, p);
  const shareText = `Aparna ${p.name}${p.sizeInch ? ` ${p.sizeInch}"` : ''} (${p.type}). Ask for Aparna at your nearest electrical shop:`;
  const numbers = keyNumbers(t, p);
  const startColour = Math.max(0, p.colours.indexOf(PICTURED_COLOUR[p.id])); // the colour in its picture, if listed

  // Gallery: the real-time 3D model (Aeroflow only), the product on its stage (its own photo with the
  // background removed), then every original picture with a close-up lens.
  const slides = [];
  const thumbs = [];
  if (modelKey) {
    slides.push(`
      <figure class="gallery__slide gallery__slide--3d" data-slide>
        <div class="viewer" data-viewer="${esc(modelKey)}" tabindex="0" role="img" aria-label="${esc(fmt(t.preview.viewerLabel, { name: p.name }))}">
          <canvas class="viewer__canvas"></canvas>
          <span class="viewer__badge" aria-hidden="true">${esc(t.product.view360)}</span>
          <p class="viewer__hint" aria-hidden="true">${esc(t.preview.dragHint)}</p>
        </div>
      </figure>`);
    thumbs.push({ cls: 'gallery__thumb--3d', html: '360°' });
    // the parts view: the same model from the side, its parts easing a little apart and back together
    slides.push(`
      <figure class="gallery__slide gallery__slide--3d gallery__slide--parts" data-slide>
        <div class="viewer" data-viewer="${esc(modelKey)}" data-exploded tabindex="0" role="img" aria-label="${esc(fmt(t.showroom.partsLabel, { name: p.name }))}">
          <canvas class="viewer__canvas"></canvas>
          <span class="viewer__badge" aria-hidden="true">${esc(t.showroom.partsBadge)}</span>
          <p class="viewer__hint" aria-hidden="true">${esc(t.showroom.partsHint)}</p>
        </div>
      </figure>`);
    thumbs.push({ cls: 'gallery__thumb--3d gallery__thumb--parts', html: esc(t.showroom.partsThumb) });
  }
  if (cut) {
    slides.push(`
      <figure class="gallery__slide gallery__slide--stage" data-slide>
        <div class="gallery__showcase" data-stage-card>${stage(t, p, cut, { sizes: '(min-width: 900px) 50vw, 94vw', eager: !modelKey, extraClass: 'gallery__stagebox' })}</div>
        <figcaption>${esc(fmt(t.showroom.cutoutCaption, { source: t.product.kind[p.images[0].kind] }))}</figcaption>
      </figure>`);
    thumbs.push({ html: `<img src="${esc(cut.variants[0].file)}" alt="" width="${cut.variants[0].width}" height="${cut.variants[0].height}" loading="lazy">` });
  }
  p.images.forEach((img, i) => {
    slides.push(`
      <figure class="gallery__slide" data-slide data-colour="">
        <div class="gallery__frame lens" data-lens>${productImage(img, { className: 'lens__img', sizes: '(min-width: 900px) 50vw, 94vw', eager: i === 0 && !modelKey && !cut })}</div>
        <figcaption>${esc(t.product.kind[img.kind])}</figcaption>
      </figure>`);
    thumbs.push({ html: productImage(img, { sizes: '80px' }) });
  });
  const total = slides.length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product', // no "offers": the site has no prices (brief §9)
        name: `Aparna ${p.name}`,
        brand: { '@type': 'Brand', name: 'Aparna' },
        category: p.category,
        description: p.description,
        ...(p.images[0] ? { image: p.images.map((img) => img.variants.at(-1).file) } : {}),
        additionalProperty: [
          ...(p.sizeMm ? [{ '@type': 'PropertyValue', name: 'Sweep / size', value: `${p.sizeMm} mm` }] : []),
          ...p.specs.map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })),
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
          { '@type': 'ListItem', position: 2, name: 'Products', item: '/products/' },
          { '@type': 'ListItem', position: 3, name: p.category, item: `/products/${p.categorySlug}/` },
          { '@type': 'ListItem', position: 4, name: p.name, item: p.url },
        ],
      },
    ],
  };

  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories, { catalogueFile })}
  <main id="main" class="product" data-product="${esc(p.id)}">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">${esc(t.product.home)}</a></li>
        <li><a href="/products/">${esc(t.product.products)}</a></li>
        <li><a href="/products/${esc(p.categorySlug)}/">${esc(p.category)}</a></li>
        <li aria-current="page">${esc(p.name)}</li>
      </ol>
    </nav>

    <div class="product-hero" data-motion="${motionOf(p)}">
      <section class="gallery" aria-label="${esc(t.product.gallery)}" data-gallery>
        <div class="gallery__viewport">
          <div class="gallery__stage" tabindex="0" aria-label="${esc(t.product.gallery)}">
            ${slides.length ? slides.join('') : `<figure class="gallery__slide gallery__slide--empty" data-slide>${noPhoto(t)}</figure>`}
          </div>
          ${total > 1 ? `
            <button class="gallery__nav gallery__nav--prev" type="button" data-prev aria-label="${esc(t.product.prev)}">‹</button>
            <button class="gallery__nav gallery__nav--next" type="button" data-next aria-label="${esc(t.product.next)}">›</button>` : ''}
        </div>
        ${total > 1 ? `
        <div class="gallery__thumbs" role="group" aria-label="${esc(t.product.gallery)}">
          ${thumbs.map((th, i) => `<button type="button" class="gallery__thumb ${th.cls ?? ''}" data-thumb="${i}" aria-label="${esc(fmt(t.product.imageN, { n: i + 1, total }))}">${th.html}</button>`).join('')}
        </div>` : ''}
        ${p.images.length < 2 ? `<p class="gallery__note">${esc(t.products.morePhotos)}</p>` : ''}
      </section>

      <section class="product__info" aria-labelledby="product-title">
        <ul class="badges">${statusBadge(t, p)}${p.badges.filter((b) => b !== 'New launch').map((b) => `<li class="badge badge--soft">${esc(b)}</li>`).join('')}</ul>
        <p class="product__series">${esc(p.series)}</p>
        <h1 class="product__name" id="product-title">${esc(p.name)}</h1>
        <p class="product__meta">${esc([p.modelNumber ? `${t.product.model} ${p.modelNumber}` : '', p.type, sizeText(p)].filter(Boolean).join(' · '))}</p>
        <p class="product__desc">${esc(p.description)}</p>
        ${p.status !== 'current' ? `<p class="product__soon">${esc(t.product.detailsSoon)}</p>` : ''}

        ${p.colours.length ? `
        <fieldset class="colour-picker" data-colours>
          <legend>${esc(t.product.colours)} <span class="colour-picker__chosen" data-chosen aria-live="polite">${esc(fmt(t.product.selectedColour, { colour: p.colours[startColour] }))}</span></legend>
          <div class="colour-picker__list">
            ${p.colours.map((c, i) => `
              <label class="colour-option">
                <input type="radio" name="colour" value="${esc(c)}" ${i === startColour ? 'checked' : ''} data-finish="${esc(finishes.includes(c) ? DATA_COLOUR_TO_FINISH[c] : '')}">
                ${swatch(colours, c)}<span class="colour-option__name">${esc(c)}</span>
              </label>`).join('')}
          </div>
          <p class="fine-print">${esc(modelKey ? t.product.colourNote.replace(/ Photos.*/, '') : t.product.colourNote)}</p>
        </fieldset>` : ''}

        ${modelKey && !p.colours.length && POSTER_FINISHES[p.id] ? `
        <fieldset class="colour-picker" data-poster-finishes>
          <legend>${esc(t.showroom.posterFinishes)}</legend>
          <div class="colour-picker__list">
            ${POSTER_FINISHES[p.id].map((f, i) => `
              <label class="colour-option">
                <input type="radio" name="poster-finish" value="${esc(f.key)}" ${i === 0 ? 'checked' : ''}>
                <span class="swatch" style="--swatch:${esc(f.swatch)}" aria-hidden="true"></span><span class="colour-option__name">${esc(f.label)}</span>
              </label>`).join('')}
          </div>
          <p class="fine-print">${esc(t.showroom.posterFinishesNote)}</p>
        </fieldset>` : ''}

        <div class="product__actions">
          ${saveButton(t, p, 'btn btn--light')}
          <a class="btn btn--whatsapp" data-share data-share-text="${esc(shareText)}" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${esc(t.preview.share)}</a>
          <a class="btn btn--ghost-light" href="${esc(catalogueFile)}" download>${esc(t.catalogue.cta)}</a>
        </div>
        <p class="product__where">${esc(t.products.where)}</p>
      </section>
    </div>

    ${numbers.length ? `
    <section class="key-numbers" aria-labelledby="numbers-title">
      <h2 class="sr-only" id="numbers-title">${esc(t.showroom.keyNumbers)}</h2>
      ${numberTiles(numbers, 'key-numbers__list')}
    </section>` : ''}

    <div class="product__details">
      <section class="product__block" aria-labelledby="specs-title">
        <h2 class="product__h2" id="specs-title" data-reveal="words">${esc(t.product.specs)}</h2>
        <dl class="spec-table">
          <div><dt>${esc(t.product.model)}</dt><dd>${esc(p.modelNumber ?? t.product.toConfirm)}</dd></div>
          <div><dt>${esc(t.product.category)}</dt><dd>${esc(p.category)}</dd></div>
          <div><dt>${esc(t.product.series)}</dt><dd>${esc(p.series)}</dd></div>
          <div><dt>${esc(t.product.type)}</dt><dd>${esc(p.type)}</dd></div>
          ${p.sizeInch ? `<div><dt>${esc(t.product.size)}</dt><dd>${p.sizeMm} mm (${p.sizeInch}")</dd></div>` : ''}
          ${p.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}
        </dl>
        ${p.specs.length ? `<p class="fine-print">${esc(t.footer.tolerance)}</p>` : `<p class="fine-print">${esc(t.product.noSpecs)}</p>`}
        ${p.catalogue ? `<p class="fine-print">${esc(fmt(t.product.catalogueRef, { pages: p.catalogue.pages }))}</p>` : ''}
      </section>

      ${p.features.length ? `
      <section class="product__block" aria-labelledby="features-title">
        <h2 class="product__h2" id="features-title" data-reveal="words">${esc(t.product.features)}</h2>
        <ul class="feature-list">${p.features.map((f) => `<li data-reveal>${esc(f)}</li>`).join('')}</ul>
      </section>` : ''}
    </div>

    ${rel.list.length ? `
    <section class="related" aria-labelledby="related-title">
      <h2 class="section-title related__title" id="related-title" data-reveal="words">${esc(rel.bySeries ? t.product.related : fmt(t.product.relatedCategory, { category: p.category }))}</h2>
      <ul class="product-grid product-grid--row">${rel.list.map((x, i) => productCard(t, colours, cutouts, x, { index: i })).join('')}</ul>
    </section>` : ''}
  </main>
  ${quickViewDialog(t)}
  ${siteFooter(t, range.media, catalogue.categories)}
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;
}

// ---------------------------------------------------------------- my list

export function renderList({ t, range, catalogue, cutouts = {} }) {
  // A small index so the page can draw the saved items without loading every product page.
  const index = Object.fromEntries(catalogue.products.map((p) => [p.id, {
    name: p.name, url: p.url, category: p.category, meta: [p.type, sizeText(p)].filter(Boolean).join(' · '),
    image: cutouts[p.id]?.variants[0].file ?? p.images[0]?.variants[0].file ?? null,
  }]));
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories, { catalogueFile: range.downloads.catalogue.file })}
  <main id="main" class="my-list">
    <header class="catalogue__head">
      <h1 class="section-title">${esc(t.list.title)}</h1>
      <p class="catalogue__lead">${esc(t.list.lead)}</p>
    </header>
    <ul class="my-list__items" data-list-items data-remove="${esc(t.list.remove)}" data-remove-label="${esc(t.list.removeLabel)}" data-colour="${esc(t.list.colour)}"></ul>
    <div class="my-list__empty" data-list-empty>
      <p>${esc(t.list.empty)}</p>
      <a class="btn btn--primary" href="/products/">${esc(t.list.browse)}</a>
    </div>
    <div class="my-list__actions" data-list-actions hidden>
      <a class="btn btn--whatsapp" data-list-share data-intro="${esc(t.list.shareIntro)}" href="https://wa.me/" target="_blank" rel="noopener">${esc(t.list.share)}</a>
      <button class="btn btn--ghost" type="button" data-list-clear>${esc(t.list.clear)}</button>
    </div>
    <p class="results__where">${esc(t.products.where)}</p>
  </main>
  ${siteFooter(t, range.media, catalogue.categories)}
  <script type="application/json" id="product-index">${JSON.stringify(index).replace(/</g, '\\u003c')}</script>`;
}

// Page titles and descriptions for the <head>.
export function pageMeta({ t, catalogue, marker }) {
  const [kind, key] = marker.split(':');
  if (kind === 'catalogue') return { title: `All products | Aparna`, description: fmt(t.products.lead, { count: catalogue.products.length, categories: catalogue.categories.length }) };
  if (kind === 'list') return { title: `My list | Aparna`, description: t.list.lead };
  if (kind === 'category') {
    const c = catalogue.categories.find((x) => x.slug === key);
    return { title: `${c.name} | Aparna`, description: `${c.count} Aparna ${c.name.toLowerCase()}. ${t.categoryLines[c.name] ?? ''}` };
  }
  const p = catalogue.products.find((x) => x.id === key);
  return { title: `${p.name}${p.sizeInch ? ` ${p.sizeInch}"` : ''} ${p.type} | Aparna`, description: p.description, image: p.images[0]?.variants.at(-1).file };
}
