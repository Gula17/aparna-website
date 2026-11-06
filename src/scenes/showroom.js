// The showroom's motion on the catalogue pages (styles: src/styles/showroom.css).
//   - each product moves in its own way, but only while its card is on screen (.is-live)
//   - pointer: the card leans, the product moves forward and turns towards the cursor, light and shadow follow
//   - scroll: products drift against their card for depth; cards and category stages rise in (GSAP ScrollTrigger)
// Everything is in the HTML already; with reduced motion only the static stage is shown.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ---- pointer: eased values written as CSS variables, only while a card is moving
function pointerDepth(el) {
  const s = { x: 0, y: 0, l: 0, tx: 0, ty: 0, tl: 0, running: false };
  const frame = () => {
    s.x += (s.tx - s.x) * 0.14;
    s.y += (s.ty - s.y) * 0.14;
    s.l += (s.tl - s.l) * 0.12;
    el.style.setProperty('--mx', s.x.toFixed(3));
    el.style.setProperty('--my', s.y.toFixed(3));
    el.style.setProperty('--lift', s.l.toFixed(3));
    const settled = Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) + Math.abs(s.tl - s.l) < 0.002;
    if (settled && !s.tl) {
      el.style.removeProperty('--mx'); el.style.removeProperty('--my'); el.style.removeProperty('--lift');
      s.running = false;
      return;
    }
    requestAnimationFrame(frame);
  };
  const run = () => { if (!s.running) { s.running = true; requestAnimationFrame(frame); } };
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    s.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    s.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    s.tl = 1;
    run();
  });
  el.addEventListener('pointerleave', () => { s.tx = 0; s.ty = 0; s.tl = 0; run(); });
  // keyboard users get the same "step forward" on focus
  el.addEventListener('focusin', () => { s.tl = 1; run(); });
  el.addEventListener('focusout', () => { s.tl = 0; run(); });
}

export function setupShowroom({ reducedMotion, lite }) {
  const stages = [...document.querySelectorAll('[data-stage-card]')];
  if (!stages.length) return;
  if (lite) document.documentElement.classList.add('lite-fx');

  // ---- only cards on screen animate
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.classList.toggle('is-live', e.isIntersecting && !reducedMotion);
      if (e.isIntersecting) e.target.classList.add('is-seen'); // loads the light-sweep mask (once)
      if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
    }
    queueDepth();
  }, { rootMargin: '80px 0px' });
  stages.forEach((el) => io.observe(el));
  if (reducedMotion) return;

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) stages.forEach(pointerDepth);

  // ---- scroll depth: the product drifts a little against its card (works on touch screens too)
  let queued = false;
  function queueDepth() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const h = innerHeight;
      for (const el of visible) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sy', clamp((r.top + r.height / 2 - h / 2) / h, -1, 1).toFixed(3));
      }
    });
  }
  addEventListener('scroll', queueDepth, { passive: true });

  // ---- scroll reveals
  const stations = gsap.utils.toArray('.cat-station');
  if (stations.length) {
    gsap.from(stations, { autoAlpha: 0, y: 70, rotateX: 22, transformPerspective: 900, transformOrigin: '50% 100%', duration: 1, ease: 'power3.out', stagger: 0.06, delay: 0.15, clearProps: 'all' });
  }
  const spotlight = document.querySelector('[data-spotlight]');
  if (spotlight) {
    // drops in from above the screen and settles into its place
    gsap.from(spotlight, { y: () => -(spotlight.getBoundingClientRect().bottom + 40), rotate: -4, duration: 1.35, ease: 'back.out(1.15)', delay: 0.1, clearProps: 'transform' });
    // the spotlight product lifts away and the showroom darkens as you scroll past it
    // (moves the whole stage: the product inside keeps its own pointer and idle motion)
    gsap.to(spotlight.querySelector('.stage'), {
      yPercent: -14, scale: 1.08, ease: 'none',
      scrollTrigger: { trigger: '.showroom', start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  }
  const intro = document.querySelector('.showroom__intro');
  if (intro) {
    gsap.to(intro, { y: -40, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: '.showroom', start: 'top top', end: 'bottom top', scrub: 0.6 } });
  }

  // Product cards rise in, tilted back, as they enter. Cards shown later by a filter come in the same way.
  const cards = gsap.utils.toArray('.catalogue .product-card, .related .product-card');
  const hidden = { autoAlpha: 0, y: 60, rotateX: 16, transformPerspective: 1000, transformOrigin: '50% 100%' };
  const show = (batch) => {
    const fresh = batch.filter((c) => !c.dataset.revealed);
    fresh.forEach((c) => { c.dataset.revealed = '1'; });
    if (fresh.length) gsap.to(fresh, { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, overwrite: true, clearProps: 'transform,opacity,visibility' });
  };
  gsap.set(cards, hidden);
  ScrollTrigger.batch(cards, { start: 'top 94%', once: true, onEnter: show });

  document.addEventListener('catalogue:filtered', () => {
    const inView = cards.filter((c) => !c.hidden && !c.dataset.revealed && c.getBoundingClientRect().top < innerHeight);
    show(inView);
    ScrollTrigger.refresh();
    queueDepth();
  });
}
