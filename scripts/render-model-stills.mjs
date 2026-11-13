// Renders a still of a product's own 3D model, on a clear background, for products that have a 3D model but no
// photo of any kind (so their catalogue card isn't empty): npm run model-stills -> src/content/model-renders/<id>.png
// Never another product's picture: each still is that product's own model, from the same three-quarter view.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { startDevServer, launchBrowser } from './browser.mjs';
import { PRODUCT_MODELS, PICTURED_COLOUR, FINISH_KEYS } from '../src/three/models.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src', 'content', 'model-renders');
const catalogue = JSON.parse(await fs.readFile(path.join(ROOT, 'src/content/catalogue.generated.json'), 'utf8'));
// products with a 3D model and no picture apart from event photos (which are no longer product pictures)
const todo = catalogue.products
  .filter((p) => PRODUCT_MODELS[p.id] && !p.images.some((i) => i.kind !== 'photo' && i.kind !== 'render'))
  .map((p) => ({ id: p.id, model: PRODUCT_MODELS[p.id], finish: FINISH_KEYS?.[PICTURED_COLOUR?.[p.id]] ?? null }));
if (!todo.length) { console.log('Model stills: none needed'); process.exit(0); }

const { server, url } = await startDevServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(`${url}/privacy-policy/`, { waitUntil: 'load', timeout: 90000 });
  const shots = await page.evaluate(async (todo) => {
    const src = await (await fetch('/src/three/aeroflow-model.js')).text();
    const THREE = await import(src.match(/from\s+"([^"]*three[^"]*)"/)[1]);
    const { MODELS } = await import('/src/three/fan-scene.js');
    const models = todo.map((t) => { const m = MODELS[t.model](); if (t.finish) m.setFinish(t.finish); return m; });
    await new Promise((r) => setTimeout(r, 2000)); // logo textures
    return models.map((m) => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1200;
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setClearColor(0x000000, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const env = new THREE.Scene(); env.background = new THREE.Color('#999');
      for (const [x, y, z] of [[0, -3, 0], [3, 2, 2], [-2, 2, 3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: '#fff' })); l.position.set(x, y, z); env.add(l); }
      scene.environment = new THREE.PMREMGenerator(r).fromScene(env).texture;
      scene.add(new THREE.HemisphereLight('#fff', '#777', 1.0));
      const key = new THREE.DirectionalLight('#fff', 1.3); key.position.set(1, 1, 2); scene.add(key);
      m.rotor.rotation.y = 0.5;
      scene.add(m.fan);
      const box = new THREE.Box3().setFromObject(m.fan);
      const ctr = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
      const v = m.viewerPose ?? { elevation: -0.45, azimuth: 0.6 };
      const el = v.elevation ?? -0.45, az = v.azimuth ?? 0.6, d = size * 1.25;
      const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
      cam.position.set(ctr.x + Math.sin(az) * Math.cos(el) * d, ctr.y + Math.sin(el) * d, ctr.z + Math.cos(az) * Math.cos(el) * d);
      cam.lookAt(ctr);
      r.render(scene, cam);
      const data = c.toDataURL('image/png'); r.dispose(); return data;
    });
  }, todo);
  await fs.mkdir(OUT, { recursive: true });
  for (const [i, t] of todo.entries()) {
    const file = path.join(OUT, `${t.id}.png`);
    await sharp(Buffer.from(shots[i].split(',')[1], 'base64')).trim({ threshold: 1 }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file);
    console.log(`Model still: ${path.relative(ROOT, file)}`);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
