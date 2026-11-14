// The home page (milestone M1: Scenes 0-3, plus a simple closing band and footer).
// Rendered to static HTML at build time by vite.config.js, from:
//   t     = src/content/en.json            (all copy)
//   range = src/content/range.generated.json (product counts, BLDC models, images; from the pack's product data)

import { esc, fmt, picture, pad, rupees, linkEvents } from './helpers.js';
import { renderMoment } from './moments.js';
import { PRODUCT_MODELS } from '../three/models.js';
import { siteHeader, siteFooter } from './layout.js';


// ---------------------------------------------------------------- Scene 0: loader

// The real emblem file, with hooks added so the ring can draw itself and the flame can flicker.
function emblemForLoader(svg) {
  return svg
    .replace('<svg ', '<svg class="loader__emblem" aria-hidden="true" focusable="false" ')
    // Crop the shared 835.4 x 600 box to the emblem alone (brief §4.1 allows a tight viewBox).
    .replace('viewBox="0 0 835.4 600"', 'viewBox="259 -2 318 318"')
    .replace(
      /(<circle cx="624\.78"[^>]*\/>\s*<circle cx="624\.78"[^>]*\/>)/,
      `<mask id="ring-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="800"><circle class="loader__ring-path" cx="624.78" cy="358.66" r="86" fill="none" stroke="#fff" stroke-width="176" pathLength="1" transform="rotate(-90 624.78 358.66)"/></mask><g mask="url(#ring-reveal)">$1</g>`,
    )
    .replace('<circle cx="602.68"', '<circle class="loader__disc" cx="602.68"')
    // Wrap the flame in its own group: a CSS transform on the original group would replace its SVG transform.
    .replace('<g transform="translate(472,249) scale(0.25)">', '<g class="loader__flame"><g transform="translate(472,249) scale(0.25)">')
    .replace('</g></g></svg>', '</g></g></g></svg>');
}

// The loader sits over the hero's 3D stage. Once three.js arrives, the emblem becomes the hub of a real,
// spinning 3D fan behind it; the wordmark and the percentage stay until loading is truly done.
const loader = (t, emblemSvg) => `
  <div class="loader" id="loader">
    <div class="loader__mark">${emblemForLoader(emblemSvg)}</div>
    <div class="loader__foot">
      <span class="loader__wordmark"><img src="/brand/aparna-wordmark-red.svg" width="835" height="600" alt="Aparna"></span>
      <span class="loader__pct" aria-hidden="true">0%</span>
      <span class="loader__bar" role="progressbar" aria-label="${esc(t.loader.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="loader__fill"></span></span>
    </div>
    <button class="loader__skip" type="button">${esc(t.loader.skip)}</button>
  </div>`;

// ---------------------------------------------------------------- Scene 1: hero + Scene 2: BLDC story

// The motor parts each step names, in the order its labels appear (src/scenes/fan-journey.js opens the motor for
// these steps only): "01 BLDC" the motor and its electronics, "05" the two bearings and the sealed bottom cover.
const MOTOR_STEPS = {
  motor: { parts: ['motor', 'board'], still: '/stills/motor-open.webp', alt: 'stillAlt' },
  bearing: { parts: ['bearing', 'housing'], still: '/stills/motor-bearings.webp', alt: 'stillAltBearing' },
};
const MOTOR_PARTS = ['motor', 'board', 'bearing', 'housing'];
// The opened motor as a still, captioned with that step's parts: shown instead of the scroll animation when there
// is no 3D (reduced motion, no WebGL, lost WebGL, no JavaScript). Rendered by scripts/render-motor-still.mjs.
const motorStill = (t, m) => `
  <figure class="motor-still">
    <img src="${m.still}" width="900" height="900" alt="${esc(t.bldc.parts[m.alt])}" loading="lazy" decoding="async">
    <figcaption><ul class="motor-still__labels">${m.parts.map((k) => `<li>${esc(t.bldc.parts[k])}</li>`).join('')}</ul></figcaption>
  </figure>`;
// A step title that never breaks badly: a hyphenated word stays whole ("Anti-dust", never "Anti- / dust"), and a
// title of phrases joined by " · " breaks between the phrases, the dot staying with the first one.
const stepTitle = (title) => esc(title)
  .split(' · ')
  .map((phrase) => phrase.replace(/(\S+-\S+)/g, '<span class="nowrap">$1</span>'))
  .map((phrase, i, all) => (all.length > 1 ? `<span class="bldc-step__phrase">${phrase}${i < all.length - 1 ? '&nbsp;·' : ''}</span>` : phrase))
  .join(' ');

const fanJourney = (t, range) => {
  const steps = t.bldc.steps.map((s) => ({ ...s, title: fmt(s.title, { power: range.bldcSharedPower ?? '' }) }))
    .filter((s) => s.title.trim() !== ''); // the power step disappears if the three models ever disagree
  return `
  <section class="fan-journey" id="top" aria-labelledby="hero-title">
    <div class="fan-stage" aria-hidden="true">
      <div class="fan-stage__room"></div>
      <div class="fan-stage__dark"></div>
      <img class="fan-stage__still" src="/media/fan-still.png" width="1200" height="900" alt="" fetchpriority="high" decoding="async">
      <canvas class="fan-stage__canvas" id="fan-canvas"></canvas>
      <div class="motor-labels" data-motor-labels>
        ${MOTOR_PARTS.map((k) => `<span class="motor-label" data-part="${k}"><i class="motor-label__dot"></i><i class="motor-label__line"></i><span class="motor-label__text">${esc(t.bldc.parts[k])}</span></span>`).join('')}
        <i class="motor-label__dot motor-label__twin" data-twin="bearing"></i>
      </div>
    </div>

    <div class="hero">
      <div class="hero__copy">
        <p class="eyebrow">${esc(t.hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">${esc(t.hero.title)}</h1>
        <p class="hero__sub">${esc(t.hero.subtitle)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#range">${esc(t.hero.ctaRange)}</a>
        </div>
        <p class="hero__hint" data-needs-3d>
          <span class="hero__hint-mouse">${esc(t.hero.hint)}</span>
          <span class="hero__hint-touch">${esc(t.hero.hintTouch)}</span>
        </p>
      </div>
    </div>

    <div class="bldc" id="bldc" aria-labelledby="bldc-title">
      <header class="bldc__intro">
        <p class="eyebrow eyebrow--gold" data-reveal>${esc(t.bldc.eyebrow)}</p>
        <h2 class="bldc__title" id="bldc-title" data-reveal="words">${esc(t.bldc.title)}</h2>
        <p class="bldc__hindi" lang="hi" data-reveal>${esc(t.bldc.hindi)}</p>
      </header>
      <ol class="bldc__steps">
        ${steps.map((s, i) => `
          <li class="bldc-step" data-step="${i}" data-key="${esc(s.key)}">
            <div class="bldc-step__card">
              <span class="bldc-step__num">${pad(i + 1)}</span>
              <h3 class="bldc-step__title">${stepTitle(s.title)}</h3>
              <p class="bldc-step__body">${esc(s.body)}</p>
              ${MOTOR_STEPS[s.key] ? `<p class="sr-only">${esc(fmt(t.bldc.partsShown, { a: t.bldc.parts[MOTOR_STEPS[s.key].parts[0]], b: t.bldc.parts[MOTOR_STEPS[s.key].parts[1]] }))}</p>` : ''}
            </div>
            ${MOTOR_STEPS[s.key] ? motorStill(t, MOTOR_STEPS[s.key]) : ''}
          </li>`).join('')}
      </ol>
    </div>
  </section>`;
};

// Verified specs only (brief §7.4). Shared by the card and its quick view.
const modelSpecs = (t, m) => `
  <dl class="model-card__specs">
    <div><dt>${esc(t.bldc.sweep)}</dt><dd>${m.sizeMm} mm (${m.sizeInch}")</dd></div>
    ${m.power ? `<div><dt>${esc(t.bldc.power)}</dt><dd>${esc(m.power)}</dd></div>` : ''}
    ${m.warranty ? `<div><dt>${esc(t.bldc.warranty)}</dt><dd>${esc(m.warranty)}</dd></div>` : ''}
    ${m.colours.length ? `<div><dt>${esc(t.bldc.colours)}</dt><dd>${m.colours.map(esc).join(', ')}</dd></div>` : ''}
    ${m.mrp ? `<div class="model-card__mrp"><dt data-mrp-label data-single="${esc(t.product.mrp)}">${esc(m.mrp.varies ? t.product.mrpFrom : t.product.mrp)}</dt><dd data-mrp-value>${esc(rupees(m.mrp.value))}</dd></div>` : ''}
  </dl>
  ${m.mrp ? `<p class="model-card__tax">${esc(t.product.mrpTax)}</p>` : ''}`;

// A finish's own MRP, where the price list prices the model by colour (the Aeroflow).
const finishMrp = (m, colour) => m.mrp?.variants.find((v) => v.label.toLowerCase() === colour.toLowerCase())?.mrp ?? null;

// Finish names in the data that the 3D model can show.
const DATA_COLOUR_TO_FINISH = { White: 'white', Grey: 'grey', Golden: 'golden', 'Wood Craft': 'wood' };

// The quick view: a larger look at one model. Models with a 3D model get a 360° viewer;
// the others get their poster with a close-up lens. No prices and no buying (brief §3).
const modelPreview = (t, range, m) => {
  const has3d = Boolean(PRODUCT_MODELS[m.id]);
  const finishes = m.colours.map((c) => [c, DATA_COLOUR_TO_FINISH[c]]).filter(([, key]) => key);
  return `
  <dialog class="preview" id="preview-${esc(m.id)}" aria-labelledby="preview-${esc(m.id)}-title">
    <div class="preview__panel">
      <button class="preview__close" type="button" data-close aria-label="${esc(t.preview.close)}">×</button>
      <div class="preview__media ${has3d ? 'preview__media--3d' : ''}">
        ${has3d ? `
          <div class="viewer" data-viewer="${esc(PRODUCT_MODELS[m.id])}" tabindex="0" role="img"
               aria-label="${esc(fmt(t.preview.viewerLabel, { name: m.name }))}">
            <canvas class="viewer__canvas"></canvas>
            <span class="viewer__badge" aria-hidden="true">${esc(t.preview.view360)}</span>
            <p class="viewer__hint" aria-hidden="true">${esc(t.preview.dragHint)}</p>
          </div>
          <div class="viewer__fallback">
            ${bldcPicture(range, m, '', '(min-width: 900px) 50vw, 92vw')}
            <p class="viewer__hint">${esc(t.preview.noViewer)}</p>
          </div>
          ${finishes.length ? `
          <fieldset class="finishes finishes--viewer">
            <legend>${esc(t.hero.finish)}</legend>
            <div class="finishes__list">
              ${finishes.map(([name, key]) => `
                <label class="finish">
                  <input type="radio" name="viewer-finish-${esc(m.id)}" value="${key}" ${key === 'wood' ? 'checked' : ''}${finishMrp(m, name) ? ` data-mrp="${esc(rupees(finishMrp(m, name)))}"` : ''}>
                  <span class="finish__swatch finish__swatch--${key}" aria-hidden="true"></span>
                  <span class="finish__name">${esc(name)}</span>
                </label>`).join('')}
            </div>
          </fieldset>` : ''}` : `
          <div class="lens" data-lens>
            ${bldcPicture(range, m, 'lens__img', '(min-width: 900px) 50vw, 92vw')}
          </div>
          <p class="viewer__hint viewer__hint--below" data-needs-hover>${esc(t.preview.photoHint)}</p>`}
      </div>
      <div class="preview__body">
        <ul class="badges">${m.badges.map((b) => `<li class="badge">${esc(b)}</li>`).join('')}</ul>
        <h3 class="preview__name" id="preview-${esc(m.id)}-title">${esc(m.name)}</h3>
        ${modelSpecs(t, m)}
        ${m.features.length ? `
          <h4 class="preview__subhead">${esc(t.preview.features)}</h4>
          <ul class="preview__features">${m.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        <p class="preview__where">${esc(t.whereToBuy.body)}</p>
        <div class="preview__actions">
          <a class="btn btn--whatsapp" data-share href="https://wa.me/?text=${encodeURIComponent(fmt(t.preview.shareText, { name: m.name }))}"
             target="_blank" rel="noopener" data-share-text="${esc(fmt(t.preview.shareText, { name: m.name }))}">${esc(t.preview.share)}</a>
          <a class="btn btn--light" href="/products/ceiling-fans/${esc(m.id.replace(/^ceiling-fans-/, ''))}/">${esc(t.preview.fullDetails)}</a>
        </div>
        <p class="fine-print">${esc(t.footer.tolerance)}</p>
      </div>
    </div>
  </dialog>`;
};

// A BLDC model's picture: its clean studio cutout (cutouts.generated.json), else its poster.
const bldcPicture = (range, m, className, sizes) => (m.cutout
  ? `<img class="${className} is-cutout" src="${esc(m.cutout.variants[0].file)}" srcset="${m.cutout.variants.map((v) => `${esc(v.file)} ${v.width}w`).join(', ')}" sizes="${sizes}" width="${m.cutout.variants[0].width}" height="${m.cutout.variants[0].height}" alt="${esc(m.cutout.alt ?? `The Aparna ${m.name}`)}" loading="lazy" decoding="async">`
  : picture(range.media, m.image, { className, sizes }));

const bldcModels = (t, range) => `
  <section class="bldc-models" aria-labelledby="bldc-models-title">
    <header class="bldc-models__head">
      <p class="eyebrow eyebrow--gold" data-reveal>${esc(t.bldc.eyebrow)}</p>
      <h2 class="section-title section-title--light" id="bldc-models-title" data-reveal="words">${esc(t.bldc.modelsTitle)}</h2>
    </header>
    <ul class="bldc-models__list">
      ${range.bldc.map((m, i) => `
        <li class="model-card ${PRODUCT_MODELS[m.id] ? 'model-card--3d' : ''}" style="--i:${i}" data-tilt>
          <div class="model-card__inner">
            <div class="model-card__media">
              ${m.cutout || m.image ? bldcPicture(range, m, 'model-card__img', '(min-width: 900px) 30vw, 90vw') : ''}
              ${PRODUCT_MODELS[m.id] ? `<span class="model-card__360" aria-hidden="true">${esc(t.preview.view360)}</span>` : ''}
              <span class="model-card__glare" aria-hidden="true"></span>
            </div>
            <div class="model-card__body">
              <ul class="badges">${m.badges.map((b) => `<li class="badge">${esc(b)}</li>`).join('')}</ul>
              <h3 class="model-card__name">${esc(m.name)}</h3>
              ${modelSpecs(t, m)}
              <button class="model-card__open link-arrow link-arrow--light" type="button" data-preview="preview-${esc(m.id)}"
                      aria-haspopup="dialog" aria-label="${esc(fmt(t.preview.quickViewLabel, { name: m.name }))}">
                ${esc(PRODUCT_MODELS[m.id] ? t.preview.view360 : t.preview.quickView)}
              </button>
            </div>
          </div>
        </li>`).join('')}
    </ul>
    <p class="fine-print">${esc(t.footer.tolerance)}</p>
    ${range.bldc.map((m) => modelPreview(t, range, m)).join('')}
  </section>`;

// ---------------------------------------------------------------- Scene 3: "Ek naam, poori range"

function stationCount(t, category) {
  if (!category) return '';
  if (category.onlyLaunch) return `<span class="badge badge--new">${esc(t.range.newLaunch)}</span> ${esc(t.range.modelsToCome)}`;
  return esc(fmt(t.range.models, { count: category.count }));
}

// A station's collage: real product cutouts on a studio backdrop (src/content/station-collages.json; the first
// is the hero, in front). Lazy-loaded; phones show the first three. No labels on the pictures.
function stationCollage(items, id) {
  return `<div class="station__img collage collage--n${items.length} collage--${esc(id)}">
                ${items.map((it, i) => `<span class="collage__item collage__item--${i + 1}"><img src="${esc(it.variants[0].file)}" srcset="${it.variants.map((v) => `${esc(v.file)} ${v.width}w`).join(', ')}" sizes="(min-width: 900px) 24vw, 40vw" width="${it.variants[0].width}" height="${it.variants[0].height}" alt="${esc(it.alt)}" loading="lazy" decoding="async"></span>`).join('')}
              </div>`;
}
// drawn overlays that would sit on top of the products in a collage
const OVER_PRODUCTS = new Set(['drum', 'coil']);

const rangeParade = (t, range) => {
  const bySlugName = Object.fromEntries(range.categories.map((c) => [c.name, c]));
  const total = t.stations.length;
  return `
  <section class="range" id="range" aria-labelledby="range-title">
    <header class="range__intro">
      <p class="eyebrow" data-reveal>${esc(t.range.eyebrow)}</p>
      <h2 class="section-title" id="range-title" data-reveal="words">${esc(t.range.title)}</h2>
      <p class="range__lead" data-reveal>${esc(t.range.intro)}</p>
    </header>
    <div class="parade">
      <div class="parade__viewport">
      <div class="parade__track">
        ${t.stations.map((s, i) => {
          const cat = bySlugName[s.category];
          const collage = range.stationCollages?.[s.id] ?? [];
          return `
          <article class="station station--${esc(s.id)}" data-moment="${esc(s.moment)}" aria-labelledby="station-${esc(s.id)}-title">
            <div class="station__media">
              ${collage.length ? stationCollage(collage, s.id) : picture(range.media, s.image, { className: 'station__img', sizes: '(min-width: 900px) 55vw, 92vw' })}
              ${collage.length && OVER_PRODUCTS.has(s.moment) ? '' : renderMoment(s.moment)}
              ${cat?.onlyLaunch ? `<span class="station__launch">${esc(t.range.newLaunch)}</span>` : ''}
            </div>
            <div class="station__text">
              <p class="station__num" aria-label="${esc(fmt(t.range.progress, { n: i + 1, total }))}">${pad(i + 1)} <span>/ ${pad(total)}</span></p>
              <h3 class="station__name" id="station-${esc(s.id)}-title" data-reveal="words">${esc(s.name)}</h3>
              <p class="station__line" data-reveal>${linkEvents(esc(s.line))}</p>
              <p class="station__count">${stationCount(t, cat)}</p>
              ${collage.length ? `<p class="station__models">${collage.slice(0, 3).map((it) => esc(it.name)).join(' · ')}${collage.slice(3).map((it) => `<span class="station__models-more"> · ${esc(it.name)}</span>`).join('')}</p>` : ''}
              ${cat ? `<a class="link-arrow" href="/products/${esc(cat.slug)}/" aria-label="${esc(fmt(t.range.seeAllLabel, { name: s.name }))}">${esc(t.range.seeAll)}</a>` : ''}
            </div>
          </article>`;
        }).join('')}
        <article class="station station--end" aria-labelledby="range-end-title">
          <div class="station__end">
            <h3 class="station__end-title" id="range-end-title">${esc(t.range.endTitle)}</h3>
            <p class="station__end-sub">${esc(t.range.endSub)}</p>
            <ul class="category-grid">
              ${range.categories.map((c) => `
                <li><a href="/products/${esc(c.slug)}/">
                  <span class="category-grid__name">${esc(c.name)}</span>
                  <span class="category-grid__count">${c.onlyLaunch ? esc(t.range.newLaunch) : c.count}</span>
                </a></li>`).join('')}
            </ul>
          </div>
        </article>
      </div>
      </div>
    </div>
  </section>`;
};

// ---------------------------------------------------------------- Utsav '26, a glimpse (brief scene 6)

const srcsetOf = (img) => img.variants.map((v) => `${esc(v.file)} ${v.width}w`).join(', ');
function eventGlimpse(t, events) {
  const e = events?.events?.[0];
  if (!e) return '';
  const shots = [e.cover, ...e.photos.filter((p) => p.variants[0].file !== e.cover?.variants[0].file)].filter(Boolean).slice(0, 4);
  return `
  <section class="glimpse" aria-labelledby="glimpse-title">
    <div class="glimpse__text" data-reveal>
      <p class="eyebrow glimpse__eyebrow">${esc(e.when)}</p>
      <h2 class="glimpse__title" id="glimpse-title">${esc(e.name)}</h2>
      ${e.kicker ? `<p class="glimpse__kicker">${esc(e.kicker)}</p>` : ''}
      <p class="glimpse__summary">${esc(e.summary)}</p>
      <a class="btn btn--primary" href="${esc(e.url)}">${esc(fmt(t.events.seePhotos, { count: e.count }))}</a>
      <a class="glimpse__all" href="/events/">${esc(t.events.all)} →</a>
    </div>
    <ul class="glimpse__shots" aria-hidden="true">
      ${shots.map((s) => `<li><img src="${esc(s.variants[0].file)}" srcset="${srcsetOf(s)}" sizes="(min-width: 900px) 24vw, 46vw" width="${s.variants[0].width}" height="${s.variants[0].height}" alt="" loading="lazy" decoding="async"></li>`).join('')}
    </ul>
  </section>`;
}

// ---------------------------------------------------------------- closing band + footer

const closing = (t, range) => `
  <section class="closing" aria-label="${esc(t.whereToBuy.title)}">
    <div class="closing__card" data-reveal>
      <h2 class="closing__title">${esc(t.whereToBuy.title)}</h2>
      <p>${esc(t.whereToBuy.body)}</p>
      <a class="btn btn--primary closing__btn" href="/products/">${esc(t.hero.ctaRange)} <span aria-hidden="true">→</span></a>
    </div>
  </section>`;

// ---------------------------------------------------------------- page

export function renderHome({ t, range, emblemSvg, events = null }) {
  const tt = t;
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${loader(tt, emblemSvg)}
  ${siteHeader(tt, range.media, range.categories, { home: true })}
  <main id="main">
    ${fanJourney(tt, range)}
    ${bldcModels(tt, range)}
    ${rangeParade(tt, range)}
    ${eventGlimpse(tt, events)}
    ${closing(tt, range)}
  </main>
  ${siteFooter(tt, range.media, range.categories)}
  <noscript><p class="noscript">${esc(t.noscript)}</p></noscript>`;
}
