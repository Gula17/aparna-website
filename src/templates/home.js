// The home page (milestone M1: Scenes 0-3, plus a simple closing band and footer).
// Rendered to static HTML at build time by vite.config.js, from:
//   t     = src/content/en.json            (all copy)
//   range = src/content/range.generated.json (product counts, BLDC models, images; from the pack's product data)

import { esc, fmt, picture, pad } from './helpers.js';
import { renderMoment } from './moments.js';
import { PRODUCT_MODELS } from '../three/models.js';
import { siteHeader, siteFooter } from './layout.js';

const FINISH_SWATCHES = ['white', 'grey', 'golden', 'wood'];
const SPEED_LEVELS = [1, 2, 3, 4, 5];

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

const controls = (t) => `
  <div class="fan-controls" data-needs-3d>
    <fieldset class="regulator">
      <legend>${esc(t.hero.regulator)}</legend>
      <div class="regulator__dial" aria-hidden="true"><span class="regulator__knob"></span></div>
      <div class="regulator__steps" role="radiogroup" aria-label="${esc(t.hero.regulatorLabel)}">
        ${SPEED_LEVELS.map((n) => `
          <label class="regulator__step" style="--n:${n}">
            <input type="radio" name="speed" value="${n}" ${n === 2 ? 'checked' : ''}>
            <span>${n}</span>
          </label>`).join('')}
      </div>
    </fieldset>
    <fieldset class="finishes">
      <legend>${esc(t.hero.finish)}</legend>
      <div class="finishes__list">
        ${FINISH_SWATCHES.map((key) => `
          <label class="finish">
            <input type="radio" name="finish" value="${key}" ${key === 'wood' ? 'checked' : ''}>
            <span class="finish__swatch finish__swatch--${key}" aria-hidden="true"></span>
            <span class="finish__name">${esc(t.hero.finishes[key])}</span>
          </label>`).join('')}
      </div>
    </fieldset>
  </div>`;

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
    </div>

    <div class="hero">
      <div class="hero__copy">
        <p class="eyebrow">${esc(t.hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">${esc(t.hero.title)}</h1>
        <p class="hero__sub">${esc(t.hero.subtitle)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#range">${esc(t.hero.ctaRange)}</a>
          <a class="btn btn--ghost" href="${esc(t._catalogueFile)}" download>${esc(t.hero.ctaCatalogue)}</a>
        </div>
        <p class="hero__hint" data-needs-3d>
          <span class="hero__hint-mouse">${esc(t.hero.hint)}</span>
          <span class="hero__hint-touch">${esc(t.hero.hintTouch)}</span>
        </p>
      </div>
      ${controls(t)}
    </div>

    <div class="bldc" id="bldc" aria-labelledby="bldc-title">
      <header class="bldc__intro">
        <p class="eyebrow eyebrow--gold" data-reveal>${esc(t.bldc.eyebrow)}</p>
        <h2 class="bldc__title" id="bldc-title" data-reveal="words">${esc(t.bldc.title)}</h2>
        <p class="bldc__hindi" lang="hi" data-reveal>${esc(t.bldc.hindi)}</p>
      </header>
      <ol class="bldc__steps">
        ${steps.map((s, i) => `
          <li class="bldc-step" data-step="${i}">
            <div class="bldc-step__card">
              <span class="bldc-step__num">${pad(i + 1)}</span>
              <h3 class="bldc-step__title">${esc(s.title)}</h3>
              <p class="bldc-step__body">${esc(s.body)}</p>
            </div>
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
  </dl>`;

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
            ${picture(range.media, m.image, { sizes: '(min-width: 900px) 50vw, 92vw' })}
            <p class="viewer__hint">${esc(t.preview.noViewer)}</p>
          </div>
          ${finishes.length ? `
          <fieldset class="finishes finishes--viewer">
            <legend>${esc(t.hero.finish)}</legend>
            <div class="finishes__list">
              ${finishes.map(([name, key]) => `
                <label class="finish">
                  <input type="radio" name="viewer-finish-${esc(m.id)}" value="${key}" ${key === 'wood' ? 'checked' : ''}>
                  <span class="finish__swatch finish__swatch--${key}" aria-hidden="true"></span>
                  <span class="finish__name">${esc(name)}</span>
                </label>`).join('')}
            </div>
          </fieldset>` : ''}` : `
          <div class="lens" data-lens>
            ${picture(range.media, m.image, { className: 'lens__img', sizes: '(min-width: 900px) 50vw, 92vw' })}
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
          <a class="btn btn--ghost-light" href="${esc(range.downloads.catalogue.file)}" download>${esc(t.catalogue.cta)}</a>
        </div>
        <p class="fine-print">${esc(t.footer.tolerance)}</p>
      </div>
    </div>
  </dialog>`;
};

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
              ${m.image ? picture(range.media, m.image, { className: 'model-card__img', sizes: '(min-width: 900px) 30vw, 90vw' }) : ''}
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
          return `
          <article class="station station--${esc(s.id)}" data-moment="${esc(s.moment)}" aria-labelledby="station-${esc(s.id)}-title">
            <div class="station__media">
              ${picture(range.media, s.image, { className: 'station__img', sizes: '(min-width: 900px) 55vw, 92vw' })}
              ${renderMoment(s.moment)}
              ${cat?.onlyLaunch ? `<span class="station__launch">${esc(t.range.newLaunch)}</span>` : ''}
            </div>
            <div class="station__text">
              <p class="station__num" aria-label="${esc(fmt(t.range.progress, { n: i + 1, total }))}">${pad(i + 1)} <span>/ ${pad(total)}</span></p>
              <h3 class="station__name" id="station-${esc(s.id)}-title" data-reveal="words">${esc(s.name)}</h3>
              <p class="station__line" data-reveal>${esc(s.line)}</p>
              <p class="station__count">${stationCount(t, cat)}</p>
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

// ---------------------------------------------------------------- closing band + footer

const closing = (t, range) => `
  <section class="closing" aria-label="${esc(t.whereToBuy.title)}">
    <div class="closing__card" data-reveal>
      <h2 class="closing__title">${esc(t.whereToBuy.title)}</h2>
      <p>${esc(t.whereToBuy.body)}</p>
    </div>
    <div class="closing__card closing__card--red" data-reveal>
      <h2 class="closing__title">${esc(t.catalogue.title)}</h2>
      <p>${esc(fmt(t.catalogue.body, { size: range.downloads.catalogue.sizeMb }))}</p>
      <a class="btn btn--light" href="${esc(range.downloads.catalogue.file)}" download>${esc(t.catalogue.cta)}</a>
    </div>
  </section>`;

// ---------------------------------------------------------------- page

export function renderHome({ t, range, emblemSvg }) {
  const tt = { ...t, _catalogueFile: range.downloads.catalogue.file };
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${loader(tt, emblemSvg)}
  ${siteHeader(tt, range.media, range.categories, { home: true, catalogueFile: tt._catalogueFile })}
  <main id="main">
    ${fanJourney(tt, range)}
    ${bldcModels(tt, range)}
    ${rangeParade(tt, range)}
    ${closing(tt, range)}
  </main>
  ${siteFooter(tt, range.media, range.categories)}
  <noscript><p class="noscript">${esc(t.noscript)}</p></noscript>`;
}
