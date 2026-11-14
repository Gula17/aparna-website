// Renders the stills of the Aeroflow's opened motor for the home page's BLDC story, shown where the scroll
// animation can't run (no 3D, reduced motion, lost WebGL, no JavaScript): npm run motor-still ->
//   public/stills/motor-open.webp       "01 BLDC": the brushless DC motor and its inverter electronics lit
//   public/stills/motor-bearings.webp   "05": the two ball bearings and the sealed bottom cover lit, from below
// They are the same 3D model the animation opens, so the stills and the animation always match.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { startDevServer, launchBrowser } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const STILLS = [
  // layout 0 opens evenly; layout 1 leaves wide gaps round the bearings (src/three/bldc-motor.js)
  { file: 'motor-open.webp', layout: 0, focus: { motor: 0.7, board: 0.7 }, camera: [0.62, -0.7, 1.45], target: [0.02, -0.21, 0] },
  { file: 'motor-bearings.webp', layout: 1, focus: { bearing: 0.8, housing: 0.7 }, camera: [0.33, -0.96, 0.6], target: [0, -0.48, 0] },
];

const { server, url } = await startDevServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(`${url}/privacy-policy/`, { waitUntil: 'load', timeout: 90000 });
  for (const still of STILLS) {
    const png = await page.evaluate(async ({ layout, focus, camera, target }) => {
      const src = await (await fetch('/src/three/aeroflow-model.js')).text();
      const THREE = await import(src.match(/from\s+"([^"]*three[^"]*)"/)[1]);
      const { createAeroflow } = await import('/src/three/aeroflow-model.js');
      const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js').catch(() => ({}));
      const fan = createAeroflow();
      fan.setFinish('wood');
      fan.setExplode(1, 1, layout);
      fan.setFocus(focus, 0.5);
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
      cam.position.set(...camera); cam.lookAt(...target);
      r.render(scene, cam);
      const out = c.toDataURL('image/png');
      r.dispose();
      return out;
    }, still);
    const out = path.join(ROOT, 'public', 'stills', still.file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(Buffer.from(png.split(',')[1], 'base64')).webp({ quality: 82 }).toFile(out);
    console.log(`Motor still: ${path.relative(ROOT, out)}`);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
