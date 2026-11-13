// Renders the still of the Aeroflow's opened motor for the home page's "01 BLDC" step, shown where the scroll
// animation can't run (no 3D, reduced motion, no JavaScript): npm run motor-still -> public/stills/motor-open.webp
// It is the same 3D model the animation opens, so the still and the animation always match.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { startDevServer, launchBrowser } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'stills', 'motor-open.webp');
const { server, url } = await startDevServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(`${url}/privacy-policy/`, { waitUntil: 'load', timeout: 90000 });
  const png = await page.evaluate(async () => {
    const src = await (await fetch('/src/three/aeroflow-model.js')).text();
    const THREE = await import(src.match(/from\s+"([^"]*three[^"]*)"/)[1]);
    const { createAeroflow } = await import('/src/three/aeroflow-model.js');
    const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js').catch(() => ({}));
    const fan = createAeroflow();
    fan.setFinish('wood');
    fan.setExplode(1, 1);
    fan.rotor.rotation.y = 0.5;
    const c = document.createElement('canvas'); c.width = 900; c.height = 900;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    r.setClearColor('#2a2624'); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = RoomEnvironment ? pm.fromScene(new RoomEnvironment(), 0.04).texture : null;
    scene.add(new THREE.HemisphereLight('#fff3e6', '#3a2a20', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(1.2, 1.5, 2.2); scene.add(key);
    scene.add(fan.fan);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    cam.position.set(0.62, -0.7, 1.45); cam.lookAt(0.02, -0.21, 0);
    r.render(scene, cam);
    return c.toDataURL('image/png');
  });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await sharp(Buffer.from(png.split(',')[1], 'base64')).webp({ quality: 82 }).toFile(OUT);
  console.log(`Motor still: ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
