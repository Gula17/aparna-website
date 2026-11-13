// Entry point for the catalogue pages: /products/, the category pages, every product page and the
// events pages (/events/).
// Lighter than the home page: no hero scene. three.js only loads on a product page that has a 360° viewer.

import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hero.css'; // product-card details, the 360° viewer and the lens are shared with the home page
import './styles/catalogue.css';
import './styles/showroom.css';
import './styles/product.css';
import './styles/events.css';

import { setupReveal } from './scenes/reveal.js';
import { setupCatalogue } from './scenes/catalogue.js';
import { setupShowroom } from './scenes/showroom.js';
import { setupShowcase } from './scenes/showcase.js';
import { setupQuickView } from './scenes/quick-view.js';
import { setupProductPage } from './scenes/product-page.js';
import { setupNavMenu } from './scenes/nav-menu.js';
import { setupEvents } from './scenes/events.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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


const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function canRun3D() {
  if (reducedMotion || location.search.includes('no3d')) return false;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && !location.search.includes('force3d')) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

const quality = (navigator.hardwareConcurrency ?? 4) >= 8 && matchMedia('(pointer: fine) and (min-width: 900px)').matches ? 'high' : 'low';

setupReveal({ reducedMotion });
setupNavMenu();
setupCatalogue();
// Small GPUs and low-memory phones keep the product motion but skip the extra effects.
setupShowroom({ reducedMotion, lite: quality === 'low' && ((navigator.deviceMemory ?? 4) <= 2 || (navigator.hardwareConcurrency ?? 4) <= 4) });
const can3D = canRun3D();
setupShowcase({ reducedMotion, can3D, quality });
setupProductPage({ can3D, quality });
setupQuickView({ can3D, quality });
setupEvents({ reducedMotion });
