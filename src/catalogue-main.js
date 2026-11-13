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
import { canRun3D as canRun3DOn, fewCores, lowMemory } from './scenes/device.js';
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

// shared rule (src/scenes/device.js): iPhones and iPads get 3D, at low quality
const canRun3D = () => canRun3DOn({ reducedMotion });

const quality = (navigator.hardwareConcurrency ?? 4) >= 8 && matchMedia('(pointer: fine) and (min-width: 900px)').matches ? 'high' : 'low';

setupReveal({ reducedMotion });
setupNavMenu();
setupCatalogue();
// Small GPUs and low-memory phones keep the product motion but skip the extra effects.
setupShowroom({ reducedMotion, lite: quality === 'low' && (lowMemory() || fewCores()) });
const can3D = canRun3D();
setupShowcase({ reducedMotion, can3D, quality });
setupProductPage({ can3D, quality });
setupQuickView({ can3D, quality });
setupEvents({ reducedMotion });
