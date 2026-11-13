// Scroll-triggered text animations (Motion, the framework-free version of Framer Motion).
//   data-reveal="words"  headings rise in word by word
//   data-reveal          paragraphs and cards fade up
// The text is in the HTML from the start, so nothing is lost with JavaScript off or reduced motion.

import { animate, inView, stagger } from 'motion';

const EASE_OUT = [0.22, 1, 0.36, 1];

// Wraps each word in a clipped span so it can rise into place. Screen readers get the plain text once.
function splitWords(el) {
  if (el.dataset.split) return el.querySelectorAll('.word__inner');
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const text = el.textContent.trim();
  const words = text.split(/\s+/).map((w) => `<span class="word"><span class="word__inner">${escape(w)}</span></span>`);
  el.innerHTML = `<span class="sr-only">${escape(text)}</span><span aria-hidden="true">${words.join(' ')}</span>`;
  el.dataset.split = '1';
  return el.querySelectorAll('.word__inner');
}

const hide = (el) => {
  if (el.dataset.reveal === 'words') splitWords(el).forEach((w) => { w.style.transform = 'translateY(105%)'; });
  else { el.style.opacity = '0'; el.style.transform = 'translateY(24px)'; }
};

const play = (el, delay = 0) => {
  if (el.dataset.reveal === 'words') {
    return animate(splitWords(el), { transform: ['translateY(105%)', 'translateY(0%)'] }, { duration: 0.8, delay: stagger(0.07, { startDelay: delay }), ease: EASE_OUT });
  }
  return animate(el, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.7, delay, ease: EASE_OUT });
};

// Shows an element in its final state at once (used if its reveal never got to play).
const show = (el) => {
  if (el.dataset.reveal === 'words') splitWords(el).forEach((w) => { w.style.transform = 'translateY(0%)'; });
  else { el.style.opacity = '1'; el.style.transform = 'none'; }
};

// The only reveal for [data-reveal] (no other script animates these): hidden just before it can play, played once
// on entering the view, never reversed. If it hasn't played 1.5 s after coming near the view, it is shown
// anyway, so nothing can stay invisible. Reduced motion or no JavaScript: everything is simply visible.
export function setupReveal({ reducedMotion }) {
  if (reducedMotion) return;
  const near = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      near.unobserve(target);
      setTimeout(() => { if (!target.dataset.revealed) { target.dataset.revealed = '1'; show(target); } }, 1500);
    }
  }, { rootMargin: '120px 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.closest('.hero')) return; // the hero is revealed when the loader hands over (revealHero)
    hide(el);
    inView(el, () => { if (el.dataset.revealed) return; el.dataset.revealed = '1'; play(el); }, { amount: 0.15 }); // plays once
    near.observe(el);
  });
}

// Called by the loader just before the page fades in: the hero's words rise one after another.
export function revealHero({ reducedMotion }) {
  if (reducedMotion) return;
  const title = document.querySelector('.hero__title');
  title.dataset.reveal = 'words';
  const parts = [...document.querySelectorAll('.hero__copy > :not(.hero__title), .fan-controls')];
  hide(title);
  parts.forEach((p) => { p.style.opacity = '0'; p.style.transform = 'translateY(16px)'; });
  play(title, 0.1);
  parts.forEach((p, i) => {
    animate(p, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] }, { duration: 0.7, delay: 0.35 + i * 0.08, ease: EASE_OUT });
  });
}
