// Entry point. Small on purpose: the page is already complete HTML. This file adds motion on top.
//   1. decide whether the device gets the real-time 3D fan or the still image
//   2. run the intro (Scene 0) on first visit
//   3. wire the fan journey (Scenes 1-2) and the range parade (Scene 3) to scroll

import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/loader.css';
import './styles/hero.css';
import './styles/range.css';
import './styles/catalogue.css'; // shared header menu, swatches

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { runIntro } from './scenes/loader.js';
import { setupFanJourney, getHeroPose, getCurrentLevel } from './scenes/fan-journey.js';
import { setupRange } from './scenes/range.js';
import { setupProducts } from './scenes/products.js';
import { setupReveal, revealHero } from './scenes/reveal.js';
import { setupNavMenu } from './scenes/nav-menu.js';
import { canRun3D as canRun3DOn } from './scenes/device.js';

gsap.registerPlugin(ScrollTrigger);
// iOS Safari shows and hides its toolbar while you scroll; that resize must not re-measure every trigger mid-scroll
ScrollTrigger.config({ ignoreMobileResize: true });
// A 3D view whose WebGL context Safari took away shows its still picture instead of a blank canvas.
document.addEventListener('fan:contextlost', (e) => {
  e.target.closest('.fan-stage')?.classList.remove('is-3d');
  e.target.closest('[data-viewer]')?.classList.add('is-lost');
});
document.addEventListener('fan:contextrestored', (e) => {
  e.target.closest('.fan-stage')?.classList.add('is-3d');
  e.target.closest('[data-viewer]')?.classList.remove('is-lost');
});


const html = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Brief §8: low-end devices and reduced motion get the still image instead of real-time 3D (src/scenes/device.js).
const canRun3D = () => canRun3DOn({ reducedMotion });

// Soft shadows and full resolution only for desktop-class machines; phones get a lighter render.
function renderQuality() {
  const strong = (navigator.hardwareConcurrency ?? 4) >= 8 && (navigator.deviceMemory ?? 8) >= 8;
  return strong && matchMedia('(pointer: fine) and (min-width: 900px)').matches ? 'high' : 'low';
}

async function loadFan(quality) {
  // three.js lives in its own chunk and only downloads after first paint.
  const { createFanScene } = await import('./three/fan-scene.js');
  const canvas = document.getElementById('fan-canvas');
  return createFanScene(canvas, { observe: document.querySelector('.fan-journey'), quality });
}

async function start() {
  const use3D = canRun3D() || new URLSearchParams(location.search).has('force3d');
  const quality = renderQuality();
  if (!use3D) html.classList.add('no-3d');
  const fanPromise = use3D ? loadFan(quality).catch((err) => { console.warn('3D fan unavailable', err); return null; }) : Promise.resolve(null);

  // These don't need the fan, so they are ready while it loads.
  setupReveal({ reducedMotion });
  setupNavMenu();
  setupProducts({ reducedMotion, can3D: use3D, quality });

  const playIntro = html.classList.contains('intro');
  const fan = await runIntro({
    fanPromise,
    playIntro,
    heroPose: getHeroPose,
    currentLevel: getCurrentLevel,
    onExit: () => revealHero({ reducedMotion }),
  });

  if (fan) {
    document.querySelector('.fan-stage').classList.add('is-3d');
  } else {
    html.classList.add('no-3d');
  }
  setupFanJourney({ fan, reducedMotion });
  setupRange({ reducedMotion });
  ScrollTrigger.refresh();
}

start();
