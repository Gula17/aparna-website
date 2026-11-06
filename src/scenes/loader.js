// Scene 0: the 3D loading screen.
//   1. The diya emblem lights and its silver ring draws itself; the percentage counts real loading.
//   2. When three.js arrives, the emblem shrinks onto the hub of the real 3D Aeroflow behind it, the blades
//      unfold and the fan spins fast, seen from below, while the rest finishes loading.
//   3. At 100% the camera pulls back into the hero and the page fades in.
// Real progress only (fonts, the hero image, the 3D fan and its shaders, the page's images), never a fake
// timer, and the page is never held for more than ~2.5 s (brief §5). Scrolling or pressing a key skips it.

import { gsap } from 'gsap';

const SEEN_KEY = 'aparna-intro-seen';
const MIN_EMBLEM_MS = 900; // long enough for the ring to draw itself
const MIN_SPIN_MS = 700; // let the 3D fan be seen spinning before the hand-over to the hero
const MAX_HOLD_MS = 2400; // then the page opens, whatever is still loading
const LOADER_POSE = { elevation: -1.22, azimuth: 0, zoom: 0.92, screenX: 0.5, screenY: 0.5, roll: 0, air: 0.35 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode: the intro will simply play again */
  }
}

function imageReady(img) {
  if (!img || img.complete) return Promise.resolve();
  return new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  });
}

const pageLoaded = () => (document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', r, { once: true })));

// Turns weighted loading tasks into a smoothly counting percentage. The number only ever moves towards
// what has actually finished.
function progressMeter(loader, tasks) {
  const pct = loader.querySelector('.loader__pct');
  const bar = loader.querySelector('[role="progressbar"]');
  let target = 0;
  let shown = 0;
  let raf = 0;
  tasks.forEach(({ promise, weight }) => promise.then(() => { target += weight; }));
  const tick = () => {
    shown += (Math.min(1, target) - shown) * 0.12;
    if (target >= 0.999 && shown > 0.995) shown = 1;
    const value = Math.round(shown * 100);
    pct.textContent = `${value}%`;
    loader.style.setProperty('--progress', shown.toFixed(3));
    bar.setAttribute('aria-valuenow', String(value));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return { stop: () => cancelAnimationFrame(raf), done: () => shown >= 1 };
}

/**
 * @returns the fan scene (or a promise of it, if it arrives after the page has opened), or null.
 */
export async function runIntro({ fanPromise, playIntro, heroPose, currentLevel, onExit }) {
  const html = document.documentElement;
  const loader = document.getElementById('loader');
  // Opened part-way down the page (a link to #range, a restored scroll): no intro.
  if (playIntro && scrollY > 40) {
    html.classList.remove('intro');
    playIntro = false;
  }
  if (!playIntro || !loader) return fanPromise;

  const started = performance.now();
  const mark = loader.querySelector('.loader__mark');

  const tasks = [
    { promise: document.fonts?.ready ?? Promise.resolve(), weight: 0.15 },
    { promise: imageReady(document.querySelector('.fan-stage__still')), weight: 0.1 },
    { promise: fanPromise, weight: 0.55 },
    { promise: pageLoaded(), weight: 0.2 },
  ];
  const meter = progressMeter(loader, tasks);

  // Skip on the button, or as soon as the visitor scrolls or presses a key: nothing traps them here.
  let skipped = false;
  let skipNow;
  const skip = new Promise((r) => { skipNow = () => { skipped = true; r(); }; });
  loader.querySelector('.loader__skip').addEventListener('click', () => skipNow(), { once: true });
  const skipEvents = ['wheel', 'touchmove', 'keydown'];
  skipEvents.forEach((type) => addEventListener(type, skipNow, { once: true, passive: true }));
  const deadline = wait(MAX_HOLD_MS);

  // ---- phase 1: emblem, until the 3D fan is ready
  const fan = await Promise.race([fanPromise, deadline.then(() => null), skip.then(() => null)]);

  // ---- phase 2: the emblem becomes the hub of the spinning 3D fan
  if (fan && !skipped) {
    await Promise.race([wait(Math.max(0, MIN_EMBLEM_MS - (performance.now() - started))), skip]);
  }
  if (fan && !skipped) {
    Object.assign(fan.pose, LOADER_POSE);
    fan.setLevel(5);
    document.querySelector('.fan-stage').classList.add('is-3d');
    fan.setIntroStart();
    const hub = fan.hubOnScreen();
    const rect = mark.getBoundingClientRect();
    const ringRadius = rect.width * 0.494; // the silver ring's radius inside the cropped emblem
    mark.style.setProperty('--tx', `${hub.x - (rect.left + rect.width / 2)}px`);
    mark.style.setProperty('--ty', `${hub.y - (rect.top + rect.height / 2)}px`);
    mark.style.setProperty('--s', (hub.radius / ringRadius).toFixed(3));
    loader.classList.add('is-handoff');
    await wait(320);
    fan.playIntro(1.1);
    const spunAt = performance.now();
    // Keep spinning until everything has really loaded (or the hold limit, or a skip).
    await Promise.race([Promise.all(tasks.map((x) => x.promise)), deadline, skip]);
    await Promise.race([wait(Math.max(0, MIN_SPIN_MS - (performance.now() - spunAt))), skip]);
  }

  // ---- phase 3: hand over to the hero
  markSeen();
  skipEvents.forEach((type) => removeEventListener(type, skipNow));
  loader.classList.add('is-exiting');
  if (fan) {
    fan.setLevel(currentLevel());
    if (skipped) Object.assign(fan.pose, heroPose());
    else gsap.to(fan.pose, { ...heroPose(), duration: 1.15, ease: 'power3.inOut' });
  }
  await wait(skipped ? 0 : 450);
  onExit?.();
  html.classList.remove('intro'); // the hero copy and header fade in
  setTimeout(() => {
    loader.classList.add('is-done');
    meter.stop();
  }, 800);

  // If the fan was late or skipped, it still arrives; main.js fades it in.
  return fan ?? fanPromise;
}
