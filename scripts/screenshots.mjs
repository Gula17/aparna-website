// Takes screenshots of the home page on a phone and a desktop, scene by scene, into screenshots/.
// Also prints any console errors. Use: npm run shots  (or: node scripts/screenshots.mjs intro)

import fs from 'node:fs/promises';
import path from 'node:path';
import { startDevServer, launchBrowser } from './browser.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'screenshots');
const DEVICES = {
  mobile: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
// Where to stop and shoot: a selector to scroll to, plus an offset in screen heights.
const STOPS = [
  ['01-hero', null, 0],
  ['02-bldc-intro', '.bldc__intro', 0.35],
  ['03-bldc-step1', '.bldc-step[data-step="0"]', 0.1],
  ['04-bldc-step3', '.bldc-step[data-step="2"]', 0.1],
  ['05-bldc-step5', '.bldc-step[data-step="4"]', 0.1],
  ['06-models', '.bldc-models', 0],
  ['07-range-intro', '.range', 0],
  ['08-range-a', '.parade', 0.3],
  ['09-range-b', '.parade', 1.6],
  ['10-range-c', '.parade', 3.6],
  ['11-range-end', '.closing', -1.05],
  ['12-closing', '.closing', 0],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2];
// Optional: limit to some devices and stops, e.g. `node scripts/screenshots.mjs - mobile 01,02`
const deviceFilter = process.argv[3];
const stopFilter = process.argv[4]?.split(',');

await fs.mkdir(OUT, { recursive: true });
const { server, url } = await startDevServer();
const browser = await launchBrowser();
const errors = [];

try {
  for (const [name, viewport] of Object.entries(DEVICES)) {
    if (deviceFilter && deviceFilter !== name) continue;
    const page = await browser.newPage();
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${name}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.setViewport(viewport);

    if (only === 'intro') {
      await page.goto(`${url}/?force3d`, { waitUntil: 'domcontentloaded' });
      const start = Date.now();
      for (const ms of [500, 1200, 1700, 2300, 3200]) {
        await wait(Math.max(0, ms - (Date.now() - start)));
        await page.screenshot({ path: path.join(OUT, `${name}-intro-${ms}ms.png`) });
      }
      await page.close();
      continue;
    }

    await page.evaluateOnNewDocument(() => sessionStorage.setItem('aparna-intro-seen', '1'));
    await page.goto(`${url}/?force3d`, { waitUntil: 'networkidle0' });
    await wait(1500);
    for (const [shot, selector, offset] of STOPS) {
      if (stopFilter && !stopFilter.some((s) => shot.startsWith(s))) continue;
      await page.evaluate((sel, off) => {
        const top = sel ? document.querySelector(sel).getBoundingClientRect().top + scrollY : 0;
        window.scrollTo({ top: top + off * innerHeight, behavior: 'instant' });
      }, selector, offset);
      await wait(1300);
      await page.screenshot({ path: path.join(OUT, `${name}-${shot}.png`) });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(errors.length ? `Console messages:\n${[...new Set(errors)].join('\n')}` : 'No console errors.');
console.log(`Screenshots in ${OUT}`);
