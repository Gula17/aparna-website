// Entry point for the catalogue pages: /products/, the category pages, every product page and /my-list/.
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

import { setupReveal } from './scenes/reveal.js';
import { setupCatalogue } from './scenes/catalogue.js';
import { setupShowroom } from './scenes/showroom.js';
import { setupShowcase } from './scenes/showcase.js';
import { setupProductPage, chosenColourFor } from './scenes/product-page.js';
import { setupSaveButtons, setupListPage } from './scenes/my-list.js';

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
setupSaveButtons({ chosenColour: chosenColourFor });
setupCatalogue();
// Small GPUs and low-memory phones keep the product motion but skip the extra effects.
setupShowroom({ reducedMotion, lite: quality === 'low' && ((navigator.deviceMemory ?? 4) <= 2 || (navigator.hardwareConcurrency ?? 4) <= 4) });
const can3D = canRun3D();
setupShowcase({ reducedMotion, can3D, quality });
setupProductPage({ can3D, quality });
setupListPage();
