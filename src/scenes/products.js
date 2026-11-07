// The BLDC product cards and their quick views.
//   - Cards tilt towards the pointer with a soft glare, and float gently (CSS) when idle.
//   - Clicking a card opens its quick view: a 360° viewer where a 3D model exists (the Aeroflow),
//     otherwise the poster with a close-up lens. Plus verified specs, features and WhatsApp sharing.
// No buying anywhere: the calls to action are the brief's (share, catalogue, ask at your shop).

import { animate } from 'motion';

const EASE_OUT = [0.22, 1, 0.36, 1];

// ---------------------------------------------------------------- tilt

function addTilt(card) {
  const inner = card.querySelector('.model-card__inner');
  card.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    card.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    animate(inner, { rotateY: x * 12, rotateX: -y * 9, scale: 1.025 }, { duration: 0.3, ease: 'easeOut' });
  });
  card.addEventListener('pointerleave', () => {
    animate(inner, { rotateY: 0, rotateX: 0, scale: 1 }, { type: 'spring', stiffness: 180, damping: 16 });
  });
}

// ---------------------------------------------------------------- close-up lens on posters

export function addLens(lens) {
  const img = lens.querySelector('img');
  const move = (e) => {
    const r = lens.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  };
  lens.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { move(e); lens.classList.add('is-zoomed'); } });
  lens.addEventListener('pointermove', move);
  lens.addEventListener('pointerleave', () => lens.classList.remove('is-zoomed'));
  // Touch: tap to zoom in where you tapped, tap again to zoom out.
  lens.addEventListener('click', (e) => { move(e); lens.classList.toggle('is-zoomed'); });
}

// ---------------------------------------------------------------- 360° viewer

const viewers = new WeakMap();

// Puts a 360° viewer into a [data-viewer] element (lazy-loads three.js). Used by the quick view and the
// product page. Resolves to the viewer, or null where 3D isn't available.
export async function mountViewer(host, { quality }) {
  if (viewers.has(host)) return viewers.get(host);
  const ready = (async () => {
    const { createFanScene } = await import('../three/fan-scene.js'); // already cached if the hero has 3D
    const exploded = host.hasAttribute('data-exploded'); // the parts view
    const viewer = createFanScene(host.querySelector('canvas'), { viewer: true, quality, observe: host, model: host.dataset.viewer, exploded });
    Object.assign(viewer.pose, { elevation: -0.45, azimuth: 0.6, zoom: 1, screenX: 0.5, screenY: 0.56, fill: 0.8 }, viewer.viewerPose ?? {}, exploded ? viewer.explodedPose : {});
    if (exploded) viewer.setLevel(1); // blades turn slowly in the parts view
    viewer.setLevel(2);
    // Keyboard: arrows turn and tilt it.
    host.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
      if (!step) return;
      e.preventDefault();
      viewer.orbit(...step);
    });
    host.addEventListener('pointerdown', () => host.classList.add('is-used'), { once: true });
    return viewer;
  })();
  viewers.set(host, ready);
  return ready;
}

async function startViewer(dialog, { can3D, quality }) {
  const host = dialog.querySelector('[data-viewer]');
  if (!host) return;
  const media = dialog.querySelector('.preview__media');
  if (!can3D) {
    media.classList.add('no-viewer');
    return;
  }
  const first = !viewers.has(host);
  const viewer = await mountViewer(host, { quality });
  media.classList.add('has-viewer');
  if (first) {
    dialog.querySelectorAll('.finishes--viewer input').forEach((input) => {
      input.addEventListener('change', () => viewer.setFinish(input.value));
    });
  }
}

// ---------------------------------------------------------------- the dialog

// Running open/close animations per dialog, so they can be stopped before the next one starts.
const running = new WeakMap();
function stopAnimations(dialog) {
  (running.get(dialog) ?? []).forEach((a) => a.stop());
  running.delete(dialog);
  const panel = dialog.querySelector('.preview__panel');
  panel.style.opacity = '';
  panel.style.transform = '';
}

function openPreview(dialog, options) {
  stopAnimations(dialog);
  dialog.showModal();
  if (!options.reducedMotion) {
    // Only position and scale animate in, never opacity, so the content is readable even if a busy
    // device drops the animation's frames. The backdrop fades in with CSS.
    running.set(dialog, [
      animate(dialog.querySelector('.preview__panel'), { y: [36, 0], scale: [0.96, 1] }, { duration: 0.5, ease: EASE_OUT }),
    ]);
  }
  startViewer(dialog, options);
}

async function closePreview(dialog, { reducedMotion }) {
  if (!dialog.open || dialog.dataset.closing) return;
  dialog.dataset.closing = '1';
  stopAnimations(dialog);
  if (!reducedMotion) {
    const out = animate(dialog.querySelector('.preview__panel'), { opacity: 0, y: 20, scale: 0.98 }, { duration: 0.2 });
    running.set(dialog, [out]);
    // Never let a busy device keep the dialog open: close after 300 ms whatever the animation is doing.
    await Promise.race([out, new Promise((r) => setTimeout(r, 300))]);
  }
  dialog.close(); // the browser returns focus to the card's button
  stopAnimations(dialog);
  delete dialog.dataset.closing;
}

export function setupProducts({ reducedMotion, can3D, quality }) {
  const options = { reducedMotion, can3D, quality };
  const cards = [...document.querySelectorAll('[data-tilt]')];
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  cards.forEach((card) => {
    if (canHover && !reducedMotion) addTilt(card);
    // The whole card opens its quick view (the button inside is the keyboard and screen-reader way in).
    const button = card.querySelector('[data-preview]');
    card.addEventListener('click', (e) => { if (!e.target.closest('a, button')) button.click(); });
  });

  document.querySelectorAll('[data-preview]').forEach((button) => {
    const dialog = document.getElementById(button.dataset.preview);
    button.addEventListener('click', () => openPreview(dialog, options));
  });

  document.querySelectorAll('dialog.preview').forEach((dialog) => {
    dialog.querySelector('[data-close]').addEventListener('click', () => closePreview(dialog, options));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); closePreview(dialog, options); }); // Esc
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closePreview(dialog, options); }); // backdrop
    dialog.querySelectorAll('[data-lens]').forEach(addLens);

    // WhatsApp: share a link back to this page (no phone number, brief §7.4).
    const share = dialog.querySelector('[data-share]');
    const pageUrl = `${location.origin}${location.pathname}#bldc`;
    share.href = `https://wa.me/?text=${encodeURIComponent(`${share.dataset.shareText} ${pageUrl}`)}`;
  });
}
