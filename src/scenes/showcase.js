// The featured showcase on /products/ and the product page hero (styles: src/styles/product.css).
//   - products with a 3D model appear as the real-time model, in the showcase and in each category's spotlight
//     (sharp at any size, where the photo is small) (three.js loads only when it comes near the screen);
//     without 3D on this device its photo stage stays
//   - each featured product rises in, turns towards you and settles as you scroll, then lifts away
//   - the light behind the showcase takes on the colour of the product on screen
//   - key numbers count up when they scroll into view (the final text is always the exact value)

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { mountViewer } from './products.js';

gsap.registerPlugin(ScrollTrigger);

function mount3D(box, { quality }) {
  const visual = box.closest('[data-3d-visual]'); // a showcase feature, or a category page's spotlight
  const start = async () => {
    try {
      const viewer = await mountViewer(box.querySelector('[data-viewer]'), { quality });
      if (!viewer) throw new Error('no viewer');
      // ceiling fans from a little further below and larger; front-facing fans keep their own eye-level view
      if (!viewer.viewerPose) Object.assign(viewer.pose, { elevation: -0.5, fill: 0.84, screenY: 0.5 });
      viewer.setLevel(3); // blades turning at a steady speed
      visual.classList.add('has-3d');
    } catch (error) {
      console.warn('3D view not shown, keeping the photo:', error);
      box.remove(); // keep the photo stage
    }
  };
  // A category page's spotlight is at the top of the page: start once its drop-in has landed (while it falls from
  // above the screen an on-screen check can miss it). Showcase products start when they come near the screen.
  if (box.closest('[data-spotlight]')) { setTimeout(start, 1500); return; }
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    start();
  }, { rootMargin: '400px 0px' });
  io.observe(box);
}

function countUp(el) {
  const target = el.dataset.countTo;
  const decimals = (target.split('.')[1] ?? '').length;
  const counter = { v: 0 };
  gsap.to(counter, {
    v: Number(target), duration: 1.4, ease: 'power2.out',
    onUpdate: () => { el.textContent = counter.v.toFixed(decimals); },
    onComplete: () => { el.textContent = target; },
  });
  // A busy device can drop animation frames: the exact value is always shown by the end.
  setTimeout(() => { el.textContent = target; }, 1800);
}

export function setupShowcase({ reducedMotion, can3D, quality }) {
  // ---- real-time 3D where a model exists
  document.querySelectorAll('[data-feature-3d]').forEach((box) => {
    if (can3D) mount3D(box, { quality }); else box.remove();
  });

  if (reducedMotion) return;

  // ---- numbers count up once, as they come into view
  document.querySelectorAll('[data-count-to]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => countUp(el) });
  });

  // ---- product page: the hero settles in
  const hero = document.querySelector('.product-hero');
  if (hero) {
    // the product drops in from above the screen and settles into its place
    const gallery = hero.querySelector('.gallery');
    gsap.from(gallery, { y: () => -(gallery.getBoundingClientRect().bottom + 40), rotate: -3, duration: 1.3, ease: 'back.out(1.1)', clearProps: 'transform' });
    gsap.from(hero.querySelectorAll('.product__info > *'), { autoAlpha: 0, y: 24, duration: 0.8, ease: 'power3.out', stagger: 0.05, delay: 0.15, clearProps: 'all' });
  }

  // ---- featured showcase
  const root = document.querySelector('[data-showcase]');
  if (!root) return;
  const glow = root.querySelector('.showcase__glow');
  root.querySelectorAll('[data-feature]').forEach((feature) => {
    const visual = feature.querySelector('.feature__visual');
    const turn = feature.classList.contains('feature--flip') ? -1 : 1;
    gsap.set(visual, { transformPerspective: 1200 });

    // enters (0-40%), holds (40-60%), lifts away (60-100%) while the section crosses the screen
    gsap.timeline({ scrollTrigger: { trigger: feature, start: 'top bottom', end: 'bottom top', scrub: 0.8 } })
      .fromTo(visual, { yPercent: 22, scale: 0.72, rotateY: 22 * turn, rotateX: 10, autoAlpha: 0.15 },
        { yPercent: 0, scale: 1, rotateY: 0, rotateX: 0, autoAlpha: 1, ease: 'power2.out', duration: 0.4 })
      .to(visual, { duration: 0.2 })
      .to(visual, { yPercent: -16, scale: 0.86, rotateY: -12 * turn, autoAlpha: 0.25, ease: 'power1.in', duration: 0.4 });

    gsap.from(feature.querySelectorAll('.feature__copy > *'), {
      autoAlpha: 0, y: 40, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity,visibility',
      scrollTrigger: { trigger: feature, start: 'top 65%', once: true },
    });

    ScrollTrigger.create({
      trigger: feature, start: 'top 55%', end: 'bottom 45%',
      onToggle: (self) => { if (self.isActive) glow.style.setProperty('--accent', feature.dataset.accent); },
    });
  });
}
