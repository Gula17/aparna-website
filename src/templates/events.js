// Aparna's events: /events/ (every event, newest first) and /events/<event>/ (one event: its loop, photos and
// galleries). Data: src/content/events.generated.json, from src/content/events.json (npm run content).

import { esc, fmt } from './helpers.js';
import { siteHeader, siteFooter } from './layout.js';

const srcset = (img) => img.variants.map((v) => `${esc(v.file)} ${v.width}w`).join(', ');
const image = (img, { sizes, className = '', eager = false } = {}) => {
  const big = img.variants.at(-1);
  return `<img class="${className}" src="${esc(img.variants[0].file)}" srcset="${srcset(img)}" sizes="${esc(sizes)}"
    width="${big.width}" height="${big.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};

// A swipeable strip of photos; each one opens large in the viewer (src/scenes/events.js).
function strip(t, items, { id, label, tall = false }) {
  return `
    <div class="photo-strip ${tall ? 'photo-strip--tall' : ''}" data-strip>
      <ul class="photo-strip__list" id="${esc(id)}" aria-label="${esc(label)}" tabindex="0">
        ${items.map((it, i) => `
          <li class="photo-strip__item">
            <button class="photo-strip__open" type="button" data-photo="${esc(it.variants.at(-1).file)}" data-caption="${esc(it.caption || it.alt)}" aria-label="${esc(fmt(t.events.openPhoto, { n: i + 1, total: items.length }))}">
              ${image(it, { sizes: tall ? '(min-width: 900px) 24vw, 70vw' : '(min-width: 900px) 34vw, 82vw', className: 'photo-strip__img' })}
            </button>
            ${it.caption ? `<p class="photo-strip__caption">${esc(it.caption)}</p>` : ''}
          </li>`).join('')}
      </ul>
      <div class="photo-strip__nav">
        <button class="photo-strip__btn" type="button" data-strip-prev aria-controls="${esc(id)}" aria-label="${esc(t.events.prev)}">‹</button>
        <button class="photo-strip__btn" type="button" data-strip-next aria-controls="${esc(id)}" aria-label="${esc(t.events.next)}">›</button>
      </div>
    </div>`;
}

const viewer = (t) => `
  <dialog class="photo-viewer" data-photo-viewer aria-label="${esc(t.events.viewer)}">
    <figure class="photo-viewer__figure"><img class="photo-viewer__img" alt="" data-viewer-img><figcaption data-viewer-caption></figcaption></figure>
    <button class="photo-viewer__close" type="button" data-viewer-close aria-label="${esc(t.events.close)}">×</button>
    <button class="photo-viewer__step photo-viewer__step--prev" type="button" data-viewer-prev aria-label="${esc(t.events.prev)}">‹</button>
    <button class="photo-viewer__step photo-viewer__step--next" type="button" data-viewer-next aria-label="${esc(t.events.next)}">›</button>
  </dialog>`;

const breadcrumb = (t, trail) => `
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol>
    <li><a href="/">${esc(t.product.home)}</a></li>
    ${trail.map(([label, href]) => (href ? `<li><a href="${esc(href)}">${esc(label)}</a></li>` : `<li aria-current="page">${esc(label)}</li>`)).join('')}
  </ol></nav>`;

export function renderEvents({ t, range, catalogue, events }) {
  const catalogueFile = range.downloads.catalogue.file;
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories, { catalogueFile })}
  <main id="main" class="events">
    ${breadcrumb(t, [[t.events.title, null]])}
    <header class="events__intro">
      <p class="eyebrow">${esc(t.events.eyebrow)}</p>
      <h1 class="section-title">${esc(t.events.title)}</h1>
      <p class="events__lead">${esc(t.events.lead)}</p>
    </header>
    <ul class="event-cards">
      ${events.events.map((e, i) => `
        <li class="event-card">
          <a class="event-card__link" href="${esc(e.url)}">
            ${e.cover ? image(e.cover, { sizes: '(min-width: 900px) 60vw, 94vw', className: 'event-card__img', eager: i === 0 }) : ''}
            <span class="event-card__body">
              <span class="event-card__when">${esc(e.when)}</span>
              <span class="event-card__name">${esc(e.name)}</span>
              ${e.kicker ? `<span class="event-card__kicker">${esc(e.kicker)}</span>` : ''}
              <span class="event-card__summary">${esc(e.summary)}</span>
              <span class="event-card__more">${esc(fmt(t.events.seePhotos, { count: e.count }))} →</span>
            </span>
          </a>
        </li>`).join('')}
    </ul>
    <p class="events__soon">${esc(t.events.more)}</p>
  </main>
  ${siteFooter(t, range.media, catalogue.categories)}`;
}

export function renderEvent({ t, range, catalogue, events, id }) {
  const e = events.events.find((x) => x.id === id);
  const catalogueFile = range.downloads.catalogue.file;
  const launched = e.launches.map((name) => catalogue.categories.find((c) => c.name === name)).filter(Boolean);
  const others = events.events.filter((x) => x.id !== e.id);
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories, { catalogueFile })}
  <main id="main" class="events event">
    ${breadcrumb(t, [[t.events.title, '/events/'], [e.name, null]])}
    <section class="event-hero" aria-labelledby="event-title">
      <div class="event-hero__media">
        ${e.cover ? image(e.cover, { sizes: '100vw', className: 'event-hero__poster', eager: true }) : ''}
        ${e.video ? `<video class="event-hero__video" data-event-video muted loop playsinline preload="none" aria-hidden="true" ${e.cover ? `poster="${esc(e.cover.variants.at(-1).file)}"` : ''}><source src="${esc(e.video)}" type="video/mp4"></video>` : ''}
        <span class="event-hero__shade" aria-hidden="true"></span>
      </div>
      <div class="event-hero__text">
        <p class="eyebrow event-hero__eyebrow">${esc(e.when)}</p>
        <h1 class="event-hero__title" id="event-title">${esc(e.name)}</h1>
        ${e.kicker ? `<p class="event-hero__kicker">${esc(e.kicker)}</p>` : ''}
        <p class="event-hero__summary">${esc(e.summary)}</p>
        <div class="event-hero__actions">
          ${e.afterMovie ? `<a class="btn btn--light" href="${esc(e.afterMovie)}" target="_blank" rel="noopener">${esc(t.events.afterMovie)}</a>` : ''}
          ${e.video ? `<button class="btn btn--ghost-light" type="button" data-video-toggle aria-pressed="false" data-play="${esc(t.events.playLoop)}" data-pause="${esc(t.events.pauseLoop)}">${esc(t.events.playLoop)}</button>` : ''}
        </div>
      </div>
    </section>

    ${launched.length ? `
    <section class="event-launches" aria-labelledby="launches-title">
      <h2 class="event-launches__title" id="launches-title">${esc(fmt(t.events.launched, { name: e.name }))}</h2>
      <ul class="event-launches__list">${launched.map((c) => `<li><a class="btn btn--ghost" href="/products/${esc(c.slug)}/">${esc(c.name)} →</a></li>`).join('')}</ul>
    </section>` : ''}

    ${e.photos.length ? `
    <section class="event-block" aria-labelledby="photos-title">
      <h2 class="section-title event-block__title" id="photos-title" data-reveal="words">${esc(t.events.photos)}</h2>
      ${strip(t, e.photos, { id: `${e.id}-photos`, label: t.events.photos })}
    </section>` : ''}

    ${e.galleries.map((g, i) => `
    <section class="event-block" aria-labelledby="gallery-${i}">
      <h2 class="section-title event-block__title" id="gallery-${i}" data-reveal="words">${esc(g.title)}</h2>
      ${g.subtitle ? `<p class="event-block__sub">${esc(g.subtitle)}</p>` : ''}
      ${strip(t, g.items, { id: `${e.id}-gallery-${i}`, label: g.title, tall: true })}
    </section>`).join('')}

    <nav class="event-more" aria-label="${esc(t.events.title)}">
      <a class="btn btn--ghost" href="/events/">← ${esc(t.events.all)}</a>
      ${others.slice(0, 3).map((x) => `<a class="btn btn--ghost" href="${esc(x.url)}">${esc(x.name)} →</a>`).join('')}
    </nav>
  </main>
  ${viewer(t)}
  ${siteFooter(t, range.media, catalogue.categories)}`;
}

export function eventsMeta({ t, events, marker }) {
  const [kind, id] = marker.split(':');
  if (kind === 'events') return { title: `${t.events.title} | Aparna`, description: t.events.lead, image: events.events[0]?.cover?.variants.at(-1).file };
  const e = events.events.find((x) => x.id === id);
  return { title: `${e.name} | Aparna events`, description: e.summary, image: e.cover?.variants.at(-1).file };
}
