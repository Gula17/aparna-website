// Renders the 3D fan to public/media/fan-still.png (transparent background).
// That image is the hero's first paint and the fallback for devices that don't get real-time 3D,
// so it always matches the live model. Run after changing the model: `npm run still`.

import path from 'node:path';
import sharp from 'sharp';
import { startDevServer, launchBrowser } from './browser.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'public', 'media', 'fan-still.png');

const { server, url } = await startDevServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text()));
  await page.goto(`${url}/tools/fan-still.html`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
  const canvas = await page.$('canvas');
  const png = await canvas.screenshot({ omitBackground: true });
  await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(OUT);
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
