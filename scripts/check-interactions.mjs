// Drives the built site through its interactive moments and screenshots each one into screenshots/:
// loader frames, card hover tilt, the Aeroflow 360° quick view (before and after a drag), a poster quick view.
// Run `npm run build` first, then: node scripts/check-interactions.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { startPreviewServer, launchBrowser } from './browser.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'screenshots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await fs.mkdir(OUT, { recursive: true });

const { server, url } = await startPreviewServer();
const browser = await launchBrowser();
const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `ix-${name}.jpg`), type: 'jpeg', quality: 70 });

try {
  const page = await browser.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 700 });

  // Loader. Software WebGL makes every frame slow, so CSS animations (and their 3 s safety net) are slowed
  // 10x here; the JavaScript timings still run at normal speed.
  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
  await page.goto(`${url}/?force3d`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 6; i++) {
    await shot(page, `loader-${i}`);
    await wait(500);
  }
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await wait(3000);
  await shot(page, 'hero');

  // Product cards: hover tilt.
  await page.evaluate(() => document.querySelector('.bldc-models').scrollIntoView({ behavior: 'instant' }));
  await wait(1500);
  const card = await page.$('.model-card');
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.25, { steps: 6 });
  await wait(700);
  await shot(page, 'card-hover');

  // Aeroflow quick view with the 360° viewer, then a drag.
  await page.click('[data-preview="preview-ceiling-fans-aeroflow-48"]');
  await wait(2500);
  await shot(page, 'viewer');
  const canvas = await page.$('#preview-ceiling-fans-aeroflow-48 .viewer');
  const vb = await canvas.boundingBox();
  await page.mouse.move(vb.x + vb.width * 0.3, vb.y + vb.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(vb.x + vb.width * 0.75, vb.y + vb.height * 0.35, { steps: 12 });
  await page.mouse.up();
  await wait(600);
  await shot(page, 'viewer-dragged');
  await page.keyboard.press('Escape');
  await wait(2000);
  const stillOpen = await page.$eval('#preview-ceiling-fans-aeroflow-48', (d) => d.open);
  if (stillOpen) errors.push('Esc did not close the quick view');

  // A model without a 3D model: poster with lens.
  await page.click('[data-preview="preview-ceiling-fans-aerosleek-48"]');
  await wait(1200);
  await shot(page, 'poster-preview');
  const share = await page.$eval('#preview-ceiling-fans-aerosleek-48 [data-share]', (a) => a.href);
  console.log('WhatsApp link:', decodeURIComponent(share));
} finally {
  await browser.close();
  await server.close();
}
console.log(errors.length ? `Problems:\n${[...new Set(errors)].join('\n')}` : 'No console errors.');
