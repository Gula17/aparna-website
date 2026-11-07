// One product's page: image gallery (swipe, arrows, thumbnails, close-up lens), colour picker, the 360°
// viewer where a 3D model exists, and WhatsApp sharing.
//
// Colours: picking a colour updates the label, turns the 3D model to that finish, and jumps to a photo of
// that colour if one exists (slides marked data-colour). No product has per-colour photos yet, so no image
// is ever swapped in for a colour it doesn't show.

import { addLens, mountViewer } from './products.js';
import { setColour } from './my-list.js';

function setupGallery(root) {
  const stage = root.querySelector('.gallery__stage');
  const slides = [...root.querySelectorAll('[data-slide]')];
  const thumbs = [...root.querySelectorAll('[data-thumb]')];
  let current = 0;

  const go = (i) => {
    current = (i + slides.length) % slides.length;
    stage.scrollTo({ left: slides[current].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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

  root.querySelector('[data-prev]')?.addEventListener('click', () => go(current - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => go(current + 1));
  thumbs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.thumb))));
  stage.addEventListener('keydown', (e) => {
    if (e.target.closest('[data-viewer]')) return; // the viewer uses the arrows to turn the fan
    if (e.key === 'ArrowRight') go(current + 1);
    if (e.key === 'ArrowLeft') go(current - 1);
  });
  root.querySelectorAll('[data-lens]').forEach(addLens);
  return { goToColour: (colour) => { const i = slides.findIndex((s) => s.dataset.colour === colour); if (i >= 0) go(i); } };
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
  if (host && can3D) mountViewer(host, { quality }).then((v) => { viewer = v; applyColour(); });
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
  function applyColour() {
    const input = picker?.querySelector('input:checked');
    if (!input) return;
    chosenLabel.textContent = template.replace('{colour}', input.value);
    if (viewer && input.dataset.finish) viewer.setFinish(input.dataset.finish);
    if (partsViewer && input.dataset.finish) partsViewer.setFinish(input.dataset.finish);
    gallery.goToColour(input.value);
    setColour(id, input.value); // if it's already in My list, remember the new colour
  }
  picker?.addEventListener('change', applyColour);

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
