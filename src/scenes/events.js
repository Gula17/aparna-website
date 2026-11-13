// Events pages (src/templates/events.js): marigold petals over the hero, muted loops that play only on screen,
// the day's story pinned and scrubbed sideways on wide screens, a photo wall that drifts as you scroll, the
// range prints fanning out, a preview loop on the event cards, and a full-size photo viewer.
// Loops never play by themselves on Data Saver, with reduced motion or on narrow screens (they are 12-21 MB):
// those visitors see the poster.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function setupEvents({ reducedMotion }) {
  const root = document.querySelector('main.ev');
  if (!root) return;
  const saveData = navigator.connection?.saveData;
  const wide = matchMedia('(min-width: 900px)').matches;
  const autoplay = !reducedMotion && !saveData && matchMedia('(min-width: 701px)').matches;

  // ---- muted loops: play while on screen
  const loops = [...root.querySelectorAll('[data-loop]')];
  const play = (v) => v.play().then(() => v.classList.add('is-playing')).catch(() => {});
  const io = new IntersectionObserver((entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting && autoplay) play(v); // reduced motion, Data Saver, phones: the poster stays
      else if (!isIntersecting && !v.paused) v.pause();
    }
  }, { threshold: 0.25 });
  loops.forEach((v) => io.observe(v));

  // ---- event cards: a short preview of the loop on hover (mouse only)
  if (autoplay && matchMedia('(hover: hover)').matches) {
    for (const link of root.querySelectorAll('[data-preview]')) {
      let v = null;
      link.addEventListener('mouseenter', () => {
        if (!v) {
          v = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, src: link.dataset.preview });
          v.setAttribute('aria-hidden', 'true');
          link.querySelector('.ev-card__media').append(v);
        }
        v.play().catch(() => {});
      });
      link.addEventListener('mouseleave', () => v?.pause());
    }
  }

  // ---- petals over the hero
  const canvas = root.querySelector('[data-petals]');
  if (canvas && !reducedMotion) petals(canvas);

  if (!reducedMotion) {
    // ---- the day: pinned, scrolled sideways as the page scrolls (wide screens); a swipe strip elsewhere
    const story = root.querySelector('[data-story]');
    const track = story?.querySelector('[data-story-track]');
    if (story && track && wide) {
      story.classList.add('is-pinned');
      // While pinned the section is exactly one screen tall (events.css), so it pins only once the heading and
      // every card, the lower staggered ones included, are fully on screen. The card size comes from the screen
      // height: what is left after the heading, the gaps and the stagger, at the cards' 4:5 shape.
      const head = story.querySelector('.ev-story__head');
      const fit = () => {
        const spare = innerHeight - head.offsetHeight - 36 /* viewport top padding */ - 34 /* stagger */ - 56 /* section padding */ - 28 /* air */;
        story.style.setProperty('--story-card', `${Math.round(Math.max(200, Math.min(400, spare / 1.25)))}px`);
      };
      fit();
      ScrollTrigger.addEventListener('refreshInit', fit);
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: { trigger: story, start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
      });
    }
    // trigger positions are measured again once fonts and pictures have loaded, so they never drift
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    if (document.readyState === 'complete') ScrollTrigger.refresh();
    else addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

    // ---- photo wall: each photo drifts at its own speed
    for (const item of root.querySelectorAll('.ev-wall__item[data-speed]')) {
      const speed = Number(item.dataset.speed);
      gsap.fromTo(item, { y: () => innerHeight * speed }, { y: () => -innerHeight * speed, ease: 'none', scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    }

    // ---- the range prints: gathered into one pile, fanning out when they come into view
    const fan = root.querySelector('[data-fan]');
    if (fan) {
      fan.classList.add('is-gathered');
      ScrollTrigger.create({ trigger: fan, start: 'top 70%', once: true, onEnter: () => fan.classList.remove('is-gathered') });
    }

    // ([data-reveal] blocks fade in once through src/scenes/reveal.js, the site-wide reveal: one owner only)
  }

  // ---- full-size photo viewer: every photo on the page in one sequence
  const dialog = document.querySelector('[data-photo-viewer]');
  const photos = [...root.querySelectorAll('[data-photo]')];
  if (dialog && photos.length) {
    const img = dialog.querySelector('[data-viewer-img]');
    const cap = dialog.querySelector('[data-viewer-caption]');
    let current = 0;
    const show = (i) => {
      current = (i + photos.length) % photos.length;
      const b = photos[current];
      img.src = b.dataset.photo;
      img.alt = b.querySelector('img')?.alt ?? '';
      cap.textContent = b.dataset.caption ?? '';
    };
    photos.forEach((b, i) => b.addEventListener('click', () => { show(i); dialog.showModal(); }));
    dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-viewer-prev]').addEventListener('click', () => show(current - 1));
    dialog.querySelector('[data-viewer-next]').addEventListener('click', () => show(current + 1));
    dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('photo-viewer__figure')) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    dialog.addEventListener('close', () => photos[current]?.focus());
  }
}

// Marigold, saffron and red petals drifting down and turning, drawn on a canvas over the hero. It stops while
// the hero is off screen.
function petals(canvas) {
  const ctx = canvas.getContext('2d');
  const colours = ['#ff9f1c', '#ffb347', '#f7c948', '#ec3237', '#ff7a1a'];
  let w = 0, h = 0, running = false, last = 0;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);
  const count = Math.round(Math.min(46, Math.max(18, w / 34)));
  const make = (fresh) => ({
    x: Math.random() * w, y: fresh ? -20 - Math.random() * h * 0.3 : Math.random() * h,
    r: 5 + Math.random() * 7, vy: 22 + Math.random() * 38, sway: 18 + Math.random() * 30, phase: Math.random() * 6.28,
    spin: (Math.random() - 0.5) * 2.4, a: Math.random() * 6.28, colour: colours[(Math.random() * colours.length) | 0],
  });
  const list = Array.from({ length: count }, () => make(false));
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const p of list) {
      p.y += p.vy * dt;
      p.phase += dt * 1.2;
      p.a += p.spin * dt;
      const x = p.x + Math.sin(p.phase) * p.sway;
      if (p.y > h + 20) Object.assign(p, make(true));
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.a);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.phase * 1.7))); // tumbling
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    running = e.isIntersecting && !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(canvas);
}
