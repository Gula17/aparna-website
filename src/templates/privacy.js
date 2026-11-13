// /privacy-policy/: plain-language privacy policy (copy in en.json "privacy"; a draft for Aparna to review).

import { esc } from './helpers.js';
import { siteHeader, siteFooter } from './layout.js';

export function renderPrivacy({ t, range, catalogue }) {
  const p = t.privacy;
  return `
  <a class="skip-link" href="#main">${esc(t.skipLink)}</a>
  ${siteHeader(t, range.media, catalogue.categories)}
  <main id="main" class="legal">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol>
      <li><a href="/">${esc(t.product.home)}</a></li>
      <li aria-current="page">${esc(p.title)}</li>
    </ol></nav>
    <article class="legal__body">
      <header class="legal__head">
        <h1 class="section-title legal__title">${esc(p.title)}</h1>
        <p class="legal__updated">${esc(p.updated)}</p>
        <p class="legal__lead">${esc(p.lead)}</p>
      </header>
      ${p.sections.map((s) => `
      <section class="legal__section">
        <h2 class="legal__h2">${esc(s.heading)}</h2>
        ${(s.paras ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}
        ${s.list ? `<ul class="legal__list">${s.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </section>`).join('')}
    </article>
  </main>
  ${siteFooter(t, range.media, catalogue.categories)}`;
}

export const privacyMeta = ({ t }) => ({ title: `${t.privacy.title} | Aparna`, description: t.privacy.metaDescription });
