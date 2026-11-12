// One product's page: image gallery (swipe, arrows, thumbnails, close-up lens), colour picker, the 360°
// viewer where a 3D model exists, and WhatsApp sharing.
//
// Colours: picking a colour updates the label, paints the 3D views in that finish, shows only that colour's
// photos (slides marked data-colour: Aparna's studio photos) and opens the 360° view, or that colour's first
// photo where there is no 3D model. A photo is only marked with the colour it shows.

import { addLens, mountViewer } from './products.js';
import { setColour } from './my-list.js';

function setupGallery(root) {
  const stage = root.querySelector('.gallery__stage');
  const slides = [...root.querySelectorAll('[data-slide]')];
  const thumbs = [...root.querySelectorAll('[data-thumb]')];
  let current = 0;

  // Only the slides of the chosen colour (plus the 360° views and photos with no colour) are shown.
  const visible = () => slides.filter((s) => !s.hidden);
  const go = (i, { instant = false } = {}) => {
    const shown = visible();
    if (!shown.length) return;
    let pos = shown.indexOf(slides[i]);
    if (pos < 0) pos = 0;
    pos = (pos + shown.length) % shown.length;
    current = slides.indexOf(shown[pos]);
    const reduce = instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
    stage.scrollTo({ left: slides[current].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  };
  const step = (dir) => {
    const shown = visible();
    const pos = shown.indexOf(slides[current]);
    go(slides.indexOf(shown[((pos < 0 ? 0 : pos) + dir + shown.length) % shown.length]));
  };
  // Keep the thumbnails in step with swiping.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.intersectionRatio > 0.6) {
        current = slides.indexOf(e.target);
        thumbs.forEach((t, i) => t.setAttribute('aria-current', String(i === current)));
      }
    }
  }, { root: stage, threshold: [0.6] });
  slides.forEach((s) => io.observe(s));

  root.querySelector('[data-prev]')?.addEventListener('click', () => step(-1));
  root.querySelector('[data-next]')?.addEventListener('click', () => step(1));
  thumbs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.thumb))));
  stage.addEventListener('keydown', (e) => {
    if (e.target.closest('[data-viewer]')) return; // the viewer uses the arrows to turn the fan
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  root.querySelectorAll('[data-lens]').forEach(addLens);

  // Show one colour: hide the photos (and their thumbnails) of the other colours, then open the 360° view
  // if there is one, or else this colour's first photo. Only colours that have their own photos filter.
  function showColour(colour, { first = false } = {}) {
    const hasOwn = slides.some((s) => s.dataset.colour === colour);
    slides.forEach((s, i) => {
      const hide = hasOwn && Boolean(s.dataset.colour) && s.dataset.colour !== colour;
      s.hidden = hide;
      if (thumbs[i]) thumbs[i].hidden = hide;
    });
    const few = visible().length < 2;
    root.querySelectorAll('[data-prev], [data-next]').forEach((b) => { b.hidden = few; });
    const view360 = slides.findIndex((s) => !s.hidden && s.classList.contains('gallery__slide--3d') && !s.classList.contains('gallery__slide--parts'));
    const own = slides.findIndex((s) => !s.hidden && s.dataset.colour === colour);
    go(view360 >= 0 ? view360 : own >= 0 ? own : slides.indexOf(visible()[0]), { instant: first });
  }
  return { showColour };
}

export function setupProductPage({ can3D, quality }) {
  const page = document.querySelector('main.product');
  if (!page) return;
  const id = page.dataset.product;

  // 360° viewer (first slide) and the parts view (second) where this product has a 3D model. Without 3D on
  // this device, drop those slides and their thumbnails, and keep the photos.
  const host = page.querySelector('[data-viewer]:not([data-exploded])');
  const partsHost = page.querySelector('[data-viewer][data-exploded]');
  let viewer = null;
  if (host && !can3D) {
    const removed = page.querySelectorAll('.gallery__thumb--3d').length;
    [host, partsHost].forEach((h) => h?.closest('[data-slide]').remove());
    page.querySelectorAll('.gallery__thumb--3d').forEach((t) => t.remove());
    page.querySelectorAll('[data-thumb]').forEach((t) => { t.dataset.thumb = String(Number(t.dataset.thumb) - removed); });
    if (page.querySelectorAll('[data-slide]').length < 2) page.querySelectorAll('[data-prev], [data-next], .gallery__thumbs').forEach((el) => el.remove());
  }
  const gallery = setupGallery(page.querySelector('[data-gallery]'));
  if (host && can3D) mountViewer(host, { quality, controls: true }).then((v) => { viewer = v; paint3D(); });
  // the parts view starts when its slide is swiped (or clicked) into view
  if (partsHost && can3D) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      mountViewer(partsHost, { quality }).then((v) => {
        const input = page.querySelector('[data-colours] input:checked');
        if (v && input?.dataset.finish) v.setFinish(input.dataset.finish);
        partsViewer = v;
      });
    }, { root: page.querySelector('.gallery__stage'), threshold: 0.5 });
    io.observe(partsHost);
  }
  let partsViewer = null;

  // Colour picker.
  const picker = page.querySelector('[data-colours]');
  const chosenLabel = picker?.querySelector('[data-chosen]');
  const template = chosenLabel?.textContent.replace(/:.*/, ': {colour}') ?? '';
  // Paints the 3D views in the chosen finish. Called again once a viewer has loaded.
  function paint3D() {
    const input = picker?.querySelector('input:checked');
    if (!input?.dataset.finish) return;
    viewer?.setFinish(input.dataset.finish);
    partsViewer?.setFinish(input.dataset.finish);
  }
  function applyColour({ first = false } = {}) {
    const input = picker?.querySelector('input:checked');
    if (!input) return;
    chosenLabel.textContent = template.replace('{colour}', input.value);
    const mrp = page.querySelector('[data-mrp-value]');
    if (mrp && input.dataset.mrp) mrp.textContent = input.dataset.mrp; // the price list prices some models by colour
    paint3D();
    gallery.showColour(input.value, { first });
    if (!first) setColour(id, input.value); // if it's already in My list, remember the new colour
  }
  picker?.addEventListener('change', () => applyColour());
  applyColour({ first: true }); // the page opens on the starting colour's photos only

  // Finishes seen on the poster but not yet named in the data (Air Max): they only repaint the 3D model.
  const posterFinishes = page.querySelector('[data-poster-finishes]');
  posterFinishes?.addEventListener('change', (e) => { viewer?.setFinish(e.target.value); partsViewer?.setFinish(e.target.value); });

  // WhatsApp: share this page's link.
  const share = page.querySelector('[data-share]');
  if (share) share.href = `https://wa.me/?text=${encodeURIComponent(`${share.dataset.shareText} ${location.origin}${location.pathname}`)}`;
}

export const chosenColourFor = (id) => {
  const page = document.querySelector(`main.product[data-product="${CSS.escape(id)}"]`);
  return page?.querySelector('[data-colours] input:checked')?.value ?? null;
};
