// Header and footer shared by every page (home, catalogue, category, product, events).

import { esc, fmt, picture } from './helpers.js';

// Aparna's official accounts (URLs in en.json "social"), in this order. Monochrome marks; Threads is its "@" loop.
const SOCIAL_ICONS = {
  facebook: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  instagram: '<g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/>',
  threads: '<path fill="currentColor" transform="translate(2.4 2.4) scale(0.8)" d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
};

// One category tile in the Products menu. The thumbnail only downloads when the menu is first opened
// (src/scenes/nav-menu.js swaps data-src in); without JavaScript the <noscript> copy loads lazily on open.
function menuTile(t, c) {
  const [one, two] = c.thumb ?? [];
  const img = (attrs) => `<img ${attrs} width="96" height="96" alt="" decoding="async">`;
  return `
          <li><a class="nav-tile" href="/products/${esc(c.slug)}/">
            <span class="nav-tile__thumb">${one ? `${img(`data-src="${esc(one.file)}" data-srcset="${esc(one.file)} 1x, ${esc(two.file)} 2x"`)}<noscript>${img(`src="${esc(one.file)}" srcset="${esc(one.file)} 1x, ${esc(two.file)} 2x" loading="lazy"`)}</noscript>` : ''}</span>
            <span class="nav-tile__name">${esc(c.name)}</span>
            <span class="nav-tile__count">${esc(fmt(t.nav.menuModels, { count: c.count }))}</span>
          </a></li>`;
}

/**
 * @param {object} t        copy (en.json)
 * @param {object} media    image map (needs 'logo-tile')
 * @param {object[]} categories  [{name, slug, count, thumb?}] (thumb: the menu thumbnails, vite.config.js)
 * @param {object} opts     { home: true } on the home page (header floats over the hero)
 */
export const siteHeader = (t, media, categories, { home = false } = {}) => {
  const total = categories.reduce((n, c) => n + c.count, 0);
  return `
  <header class="site-header ${home ? '' : 'site-header--solid'}">
    <a class="site-header__logo" href="/" aria-label="${esc(t.nav.home)}">
      ${picture(media, 'logo-tile', { className: 'site-header__tile', sizes: '136px', eager: true, alt: 'Aparna' })}
    </a>
    <nav class="site-nav" aria-label="${esc(t.nav.label)}">
      <details class="nav-menu" data-nav-menu>
        <summary>${esc(t.nav.products)}</summary>
        <div class="nav-menu__panel">
          <div class="nav-menu__head">
            <p class="nav-menu__title">${esc(t.nav.menuLabel)}</p>
            <button class="nav-menu__close" type="button" data-nav-close aria-label="${esc(t.nav.menuClose)}"><span aria-hidden="true">×</span></button>
          </div>
          <ul class="nav-menu__grid" aria-label="${esc(t.nav.menuLabel)}">${categories.map((c) => menuTile(t, c)).join('')}
          </ul>
          <a class="nav-menu__explore" href="/products/">${esc(fmt(t.nav.menuExplore, { count: total }))} <span aria-hidden="true">→</span></a>
        </div>
      </details>
      <a class="site-nav__bldc" href="${home ? '#bldc' : '/#bldc'}">${esc(t.nav.bldc)}</a>
      <a class="site-nav__events" href="/events/">${esc(t.nav.events)}</a>
      <a class="site-nav__blog" href="/blog/">${esc(t.nav.blog)}</a>
    </nav>
  </header>`;
};

export const siteFooter = (t, media, categories) => `
  <footer class="site-footer">
    <div class="site-footer__brand">
      <!-- the stacked logo with the white wordmark, on a clear background: the brief's version for Aparna red -->
      <img class="site-footer__logo" src="/brand/aparna-logo-stacked-white.svg" width="835" height="600" alt="Aparna" decoding="async">
    </div>
    <nav class="site-footer__nav" aria-label="${esc(t.footer.categories)}">
      <h2 class="site-footer__heading">${esc(t.footer.categories)}</h2>
      <ul>
        <li><a href="/products/">${esc(t.nav.allProducts)}</a></li>
        ${categories.map((c) => `<li><a href="/products/${esc(c.slug)}/">${esc(c.name)}</a></li>`).join('')}
      </ul>
    </nav>
    <nav class="site-footer__nav" aria-label="${esc(t.footer.aparna)}">
      <h2 class="site-footer__heading">${esc(t.footer.aparna)}</h2>
      <ul><li><a href="/events/">${esc(t.nav.events)}</a></li><li><a href="/blog/">${esc(t.nav.blog)}</a></li></ul>
    </nav>
    <div class="site-footer__social">
      <h2 class="site-footer__heading">${esc(t.footer.follow)}</h2>
      <ul>
        ${Object.entries(SOCIAL_ICONS).filter(([key]) => t.social?.[key]).map(([key, icon]) => `
          <li><a href="${esc(t.social[key])}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t.footer.social[key])}" data-social="${key}">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icon}</svg>
          </a></li>`).join('')}
      </ul>
    </div>
    <div class="site-footer__legal">
      <p><span class="nowrap">${esc(t.footer.copyright)}</span> · <span class="nowrap">${esc(t.footer.madeIn)}</span></p>
      <a class="site-footer__privacy" href="/privacy-policy/">${esc(t.footer.privacy)}</a>
    </div>
  </footer>`;
