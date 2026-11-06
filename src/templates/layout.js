// Header and footer shared by every page (home, catalogue, category, product, my list).

import { esc, picture } from './helpers.js';

const SOCIAL_ICONS = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
};

const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.6C1.4 8.6 3.1 5 6.6 5c2 0 3.3 1.1 4.1 2.3C11.5 6.1 12.8 5 14.8 5c3.5 0 5.2 3.6 3.8 6.4C17 15.6 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
export const heartIcon = HEART;

/**
 * @param {object} t        copy (en.json)
 * @param {object} media    image map (needs 'logo-tile')
 * @param {object[]} categories  [{name, slug, count}]
 * @param {object} opts     { home: true } on the home page (header floats over the hero)
 */
export const siteHeader = (t, media, categories, { home = false, catalogueFile } = {}) => `
  <header class="site-header ${home ? '' : 'site-header--solid'}">
    <a class="site-header__logo" href="/" aria-label="${esc(t.nav.home)}">
      ${picture(media, 'logo-tile', { className: 'site-header__tile', sizes: '136px', eager: true, alt: 'Aparna' })}
    </a>
    <nav class="site-nav" aria-label="${esc(t.nav.label)}">
      <details class="nav-menu">
        <summary>${esc(t.nav.products)}</summary>
        <ul class="nav-menu__list">
          <li><a href="/products/"><strong>${esc(t.nav.allProducts)}</strong></a></li>
          ${categories.map((c) => `<li><a href="/products/${esc(c.slug)}/">${esc(c.name)} <span>${c.count}</span></a></li>`).join('')}
        </ul>
      </details>
      <a class="site-nav__bldc" href="${home ? '#bldc' : '/#bldc'}">${esc(t.nav.bldc)}</a>
      <a class="site-nav__list" href="/my-list/" aria-label="${esc(t.nav.myList)}">
        ${HEART}<span class="site-nav__list-label">${esc(t.nav.myList)}</span><span class="list-count" data-list-count hidden>0</span>
      </a>
      <a class="site-nav__cta" href="${esc(catalogueFile)}" download>${esc(t.nav.catalogue)}</a>
    </nav>
  </header>`;

export const siteFooter = (t, media, categories) => `
  <footer class="site-footer">
    <div class="site-footer__brand">
      ${picture(media, 'logo-tile', { className: 'site-footer__tile', sizes: '160px', alt: 'Aparna' })}
    </div>
    <nav class="site-footer__nav" aria-label="${esc(t.footer.categories)}">
      <h2 class="site-footer__heading">${esc(t.footer.categories)}</h2>
      <ul>
        <li><a href="/products/">${esc(t.nav.allProducts)}</a></li>
        ${categories.map((c) => `<li><a href="/products/${esc(c.slug)}/">${esc(c.name)}</a></li>`).join('')}
      </ul>
    </nav>
    <div class="site-footer__social">
      <h2 class="site-footer__heading">${esc(t.footer.follow)}</h2>
      <ul>
        ${Object.entries(SOCIAL_ICONS).map(([key, icon]) => `
          <li><a href="#" aria-label="${esc(t.footer.social[key])}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
          </a></li>`).join('')}
      </ul>
    </div>
    <p class="site-footer__legal">${esc(t.footer.copyright)} · ${esc(t.footer.madeIn)}</p>
  </footer>`;
