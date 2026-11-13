// Aparna's events: /events/ (every event, newest first) and /events/<event>/ (one event, told as a scroll story:
// the glimpse loop, the day in order, the drone view, a photo wall, the launches, the range at the meet and the
// decor). Data: src/content/events.generated.json, from src/content/events.json (npm run content).
// Motion lives in src/scenes/events.js; with reduced motion or without JavaScript every section is a plain,
// complete layout.

import { esc, fmt } from './helpers.js';
import { siteHeader, siteFooter } from './layout.js';

const srcset = (img) => img.variants.map((v) => `${esc(v.file)} ${v.width}w`).join(', ');
const image = (img, { sizes, className = '', eager = false } = {}) => {
  const big = img.variants.at(-1);
  return `<img class="${className}" src="${esc(img.variants[0].file)}" srcset="${srcset(img)}" sizes="${esc(sizes)}"
    width="${big.width}" height="${big.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};

// A photo that opens large in the viewer.
const openable = (t, it, i, total, inner) => `
  <button class="ev-open" type="button" data-photo="${esc(it.variants.at(-1).file)}" data-caption="${esc(it.caption || it.alt)}"
    aria-label="${esc(fmt(t.events.openPhoto, { n: i + 1, total }))}">${inner}</button>`;

// A muted loop that plays only on screen (src/scenes/events.js). The poster shows until then, and always on
// Data Saver, with reduced motion or without JavaScript.
const loop = (src, poster, className) => `
  <div class="${className}">
    ${poster ? image(poster, { sizes: '100vw', className: 'ev-loop__poster' }) : ''}
    <video class="ev-loop__video" data-loop muted loop playsinline preload="none" aria-hidden="true"
      ${poster ? `poster="${esc(poster.variants.at(-1).file)}"` : ''}><source src="${esc(src)}" type="video/mp4"></video>
  </div>`;

const viewer = (t) => `
  <dialog class="photo-viewer" data-photo-viewer aria-label="${esc(t.events.viewer)}">
    <figure class="photo-viewer__figure"><img class="photo-viewer__img" alt="" data-viewer-img><figcaption data-viewer-caption></figcaption></figure>
    <button class="photo-viewer__close" type="button" data-viewer-close aria-label="${esc(t.events.close)}">×</button>
    <button class="photo-viewer__step photo-viewer__step--prev" type="button" data-viewer-prev aria-label="${esc(t.events.prev)}">‹</button>
    <button class="photo-viewer__step photo-viewer__step--next" type="button" data-viewer-next aria-label="${esc(t.events.next)}">›</button>
  </dialog>`;

const breadcrumb = (t, trail) => `
  <nav class="breadcrumb ev-crumbs" aria-label="Breadcrumb"><ol>
    <li><a href="/">${esc(t.product.home)}</a></li>
    ${trail.map(([label, href]) => (href ? `<li><a href="${esc(href)}">${esc(label)}</a></li>` : `<li aria-current="page">${esc(label)}</li>`)).join('')}
  </ol></nav>`;

// The big title, one span per letter so it can rise in letter by letter.
const letters = (text) => [...text].map((ch, i) => (ch === ' ' ? ' ' : `<span style="--i:${i}">${esc(ch)}</span>`)).join('');

// The marigold ribbon: the event's marquee lines (events.json) with a ✦ after each. The set repeats four times,
// each copy in its own block with the same trailing space, and the track slides by exactly one copy, so the loop
// wraps with no jump and fills the widest screens.
const marquee = (words) => {
  const run = `<div class="ev-marquee__run">${words.map((w) => `<span>${esc(w)}</span><span class="ev-marquee__star">✦</span>`).join('')}</div>`;
  return `<div class="ev-marquee" aria-hidden="true"><div class="ev-marquee__track">${run.repeat(4)}</div></div>`;
};

// ---------------------------------------------------------------- /events/

export function renderEvents({ t, range, catalogue, events }) {
  const first = events.events[0];
  const drone = first?.drones?.at(-1);
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories)}
  <main id="main" class="events ev">
    <section class="ev-hero ev-hero--index" aria-labelledby="events-title">
      ${drone ? loop(drone.video, drone.poster, 'ev-hero__media') : first?.cover ? `<div class="ev-hero__media">${image(first.cover, { sizes: '100vw', className: 'ev-loop__poster', eager: true })}</div>` : ''}
      <span class="ev-hero__shade" aria-hidden="true"></span>
      <canvas class="ev-petals" data-petals aria-hidden="true"></canvas>
      <div class="ev-hero__text">
        ${breadcrumb(t, [[t.events.title, null]])}
        <p class="ev-eyebrow">${esc(t.events.eyebrow)}</p>
        <h1 class="ev-title" id="events-title" aria-label="${esc(t.events.title)}">${letters(t.events.title)}</h1>
        <p class="ev-lead">${esc(t.events.lead)}</p>
      </div>
      <a class="ev-scroll" href="#event-list">${esc(t.events.scroll)}</a>
    </section>
    ${first ? marquee(first.marquee) : ''}
    <ul class="ev-cards" id="event-list">
      ${events.events.map((e, i) => `
        <li class="ev-card" data-reveal>
          <a class="ev-card__link" href="${esc(e.url)}" ${e.video ? `data-preview="${esc(e.video)}"` : ''}>
            <span class="ev-card__media">
              ${e.cover ? image(e.cover, { sizes: '(min-width: 900px) 60vw, 100vw', className: 'ev-card__img', eager: i === 0 }) : ''}
            </span>
            <span class="ev-card__body">
              <span class="ev-card__when">${esc(e.when)}</span>
              <span class="ev-card__name">${esc(e.name)}</span>
              ${e.kicker ? `<span class="ev-card__kicker">${esc(e.kicker)}</span>` : ''}
              <span class="ev-card__summary">${esc(e.summary)}</span>
              <span class="ev-card__more">${esc(fmt(t.events.seePhotos, { count: e.count }))} <span aria-hidden="true">→</span></span>
            </span>
          </a>
        </li>`).join('')}
    </ul>
    <p class="ev-soon"><span class="ev-soon__dot" aria-hidden="true"></span>${esc(t.events.more)}</p>
  </main>
  ${siteFooter(t, range.media, catalogue.categories)}`;
}

// ---------------------------------------------------------------- /events/<event>/

export function renderEvent({ t, range, catalogue, events, id }) {
  const e = events.events.find((x) => x.id === id);
  const launched = e.launches.map((name) => catalogue.categories.find((c) => c.name === name)).filter(Boolean);
  const launchProducts = catalogue.products.filter((p) => e.launches.includes(p.category) && p.images[0]);
  const others = events.events.filter((x) => x.id !== e.id);
  const [story, range2, decor] = [e.galleries[0], e.galleries[1], e.galleries[2]];
  const allPhotos = [...(story?.items ?? []), ...e.photos, ...(range2?.items ?? []), ...(decor?.items ?? [])];
  const total = allPhotos.length;
  let n = 0; // numbers every photo once, in page order, for the viewer labels
  const open = (it, inner) => openable(t, it, n++, total, inner);
  const drone = e.drones?.[0];

  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories)}
  <main id="main" class="events ev event">
    <section class="ev-hero" aria-labelledby="event-title">
      ${e.video ? loop(e.video, e.cover, 'ev-hero__media') : e.cover ? `<div class="ev-hero__media">${image(e.cover, { sizes: '100vw', className: 'ev-loop__poster', eager: true })}</div>` : ''}
      <span class="ev-hero__shade" aria-hidden="true"></span>
      <canvas class="ev-petals" data-petals aria-hidden="true"></canvas>
      <div class="ev-hero__text">
        ${breadcrumb(t, [[t.events.title, '/events/'], [e.name, null]])}
        <p class="ev-eyebrow">${esc(e.when)}</p>
        <h1 class="ev-title" id="event-title" aria-label="${esc(e.name)}">${letters(e.name)}</h1>
        ${e.kicker ? `<p class="ev-kicker">${esc(e.kicker)}</p>` : ''}
        <p class="ev-lead">${esc(e.summary)}</p>
        ${e.afterMovie ? `<div class="ev-actions"><a class="btn btn--light" href="${esc(e.afterMovie)}" target="_blank" rel="noopener">${esc(t.events.afterMovie)}</a></div>` : ''}
      </div>
      <a class="ev-scroll" href="#the-day">${esc(t.events.scroll)}</a>
    </section>

    ${marquee(e.marquee)}

    ${story ? `
    <section class="ev-story" id="the-day" aria-labelledby="story-title" data-story>
      <div class="ev-story__head">
        <p class="ev-eyebrow">${esc(story.subtitle)}</p>
        <h2 class="ev-h2" id="story-title">${esc(story.title)}</h2>
        <p class="ev-story__hint">${esc(t.events.storyHint)}</p>
      </div>
      <div class="ev-story__viewport" data-story-viewport>
        <ol class="ev-story__track" data-story-track tabindex="0" aria-label="${esc(story.title)}">
          ${story.items.map((it) => `
            <li class="ev-story__item">
              ${open(it, image(it, { sizes: '(min-width: 900px) 28vw, 74vw', className: 'ev-story__img' }))}
            </li>`).join('')}
        </ol>
      </div>
    </section>` : ''}

    ${drone ? `
    <section class="ev-drone" aria-label="${esc(drone.label)}">
      ${loop(drone.video, drone.poster, 'ev-drone__media')}
      <span class="ev-drone__shade" aria-hidden="true"></span>
      <p class="ev-drone__text" data-reveal><span>${esc(t.events.fromAbove)}</span>${esc(drone.label)}</p>
    </section>` : ''}

    ${e.photos.length ? `
    <section class="ev-wall" aria-labelledby="photos-title">
      <div class="ev-wall__head">
        <p class="ev-eyebrow">${esc(e.name)}</p>
        <h2 class="ev-h2" id="photos-title">${esc(t.events.photos)}</h2>
      </div>
      <ul class="ev-wall__grid">
        ${e.photos.map((it, i) => `
          <li class="ev-wall__item ev-wall__item--${i % 10}" data-speed="${[0.06, -0.04, 0.1, -0.08, 0.04, -0.1, 0.08, -0.05, 0.07, -0.06][i % 10]}">
            ${open(it, `${image(it, { sizes: '(min-width: 900px) 40vw, 92vw', className: 'ev-wall__img' })}${it.caption ? `<span class="ev-wall__caption">${esc(it.caption)}</span>` : ''}`)}
          </li>`).join('')}
      </ul>
    </section>` : ''}

    ${launched.length ? `
    <section class="ev-launch" aria-labelledby="launch-title">
      <div class="ev-launch__inner">
        ${launchProducts[0] ? `<div class="ev-launch__media" data-reveal>${image(launchProducts[0].images[0], { sizes: '(min-width: 900px) 50vw, 92vw', className: 'ev-launch__img' })}</div>` : ''}
        <div class="ev-launch__text" data-reveal>
          <p class="ev-eyebrow">${esc(t.events.newLaunch)}</p>
          <h2 class="ev-h2" id="launch-title">${esc(fmt(t.events.launched, { name: e.name }))}</h2>
          <ul class="ev-launch__list">
            ${launched.map((c) => `<li><a class="btn btn--primary" href="/products/${esc(c.slug)}/">${esc(c.name)} <span aria-hidden="true">→</span></a></li>`).join('')}
          </ul>
        </div>
      </div>
    </section>` : ''}

    ${range2 ? `
    <section class="ev-fan" aria-labelledby="fan-title" data-fan>
      <div class="ev-fan__head">
        <p class="ev-eyebrow">${esc(range2.subtitle)}</p>
        <h2 class="ev-h2" id="fan-title">${esc(range2.title)}</h2>
      </div>
      <ul class="ev-fan__deck" style="--count:${range2.items.length}">
        ${range2.items.map((it, i) => `
          <li class="ev-fan__card" style="--k:${i - (range2.items.length - 1) / 2}">
            ${open(it, image(it, { sizes: '(min-width: 900px) 22vw, 60vw', className: 'ev-fan__img' }))}
          </li>`).join('')}
      </ul>
    </section>` : ''}

    ${decor ? `
    <section class="ev-decor" aria-labelledby="decor-title">
      <div class="ev-decor__head">
        <p class="ev-eyebrow">${esc(decor.subtitle)}</p>
        <h2 class="ev-h2" id="decor-title">${esc(decor.title)}</h2>
      </div>
      <ul class="ev-decor__strip" tabindex="0" aria-label="${esc(decor.title)}">
        ${decor.items.map((it) => `<li class="ev-decor__item">${open(it, image(it, { sizes: '(min-width: 900px) 24vw, 66vw', className: 'ev-decor__img' }))}</li>`).join('')}
      </ul>
    </section>` : ''}

    <section class="ev-end" aria-labelledby="end-title">
      <h2 class="ev-end__title" id="end-title">${letters(e.name)}</h2>
      <p class="ev-end__kicker">${esc(e.kicker || e.when)}</p>
      <div class="ev-actions ev-actions--center">
        ${e.afterMovie
          ? `<a class="btn btn--light" href="${esc(e.afterMovie)}" target="_blank" rel="noopener">${esc(t.events.afterMovie)}</a>`
          : `<span class="ev-pill">${esc(t.events.afterMovieSoon)}</span>`}
        <a class="btn btn--ghost-light" href="/events/">${esc(t.events.all)}</a>
        ${others.slice(0, 3).map((x) => `<a class="btn btn--ghost-light" href="${esc(x.url)}">${esc(x.name)} →</a>`).join('')}
      </div>
    </section>
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
