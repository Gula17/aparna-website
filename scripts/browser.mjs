// Shared helpers for the dev scripts that drive a real browser (fan still render, screenshots).
// Uses the Chrome or Edge already installed on this machine; nothing is downloaded.

import fs from 'node:fs';
import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

// Serves the production build in dist/ (run `npm run build` first). Closer to what visitors get.
export async function startPreviewServer() {
  const server = await preview({ preview: { port: 5198, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
  return { server: { close: () => new Promise((r) => server.httpServer.close(r)) }, url: 'http://127.0.0.1:5198' };
}

export async function startDevServer() {
  if (process.env.USE_BUILD) return startPreviewServer();
  const server = await createServer({ server: { port: 5199, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  return { server, url: 'http://127.0.0.1:5199' };
}

export async function launchBrowser() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  });
}
