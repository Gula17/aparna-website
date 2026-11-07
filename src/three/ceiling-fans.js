// The rest of the Aparna ceiling-fan range (Signature, Silver, Ultra Gold and the new premium range), built
// procedurally in three.js from one shared builder. Each fan is a set of choices read off its own catalogue
// picture or poster: canopy, motor shape and its copper rings, blade shape and tip, the decorative trim where
// the blade meets the motor (loop, teardrop, oval window, stripes), how many blades (four on the 24" fans),
// and the colour it is shown in. Colours follow the product data (White, Ivory, Smoke Brown, Metallic Brown,
// Glossy Brown, Metallic Blue, Rose Gold and the premium range's own), so the product page's colour picker
// repaints the model. Parts the pictures don't show follow the visible design.
//
// Same parts as the Aeroflow (aeroflow-model.js): still canopy and downrod, turning motor and blades.

import * as THREE from 'three';
import { lathe, makeBlurTexture } from './aeroflow-model.js';

const TOP = 0.5; // canopy top; these fans hang on a short drop, as in their pictures

// Body and blade colours for every colour name in the product data (and the pictures' own colours).
export const CEILING_FINISHES = {
  'white': { body: '#f2f1ee', blade: '#f4f3f0', metal: 0 },
  'ivory': { body: '#efe5cc', blade: '#f1e8d2', metal: 0 },
  'smoke-brown': { body: '#625e5e', blade: '#6a6563', metal: 0.35 }, // the slate grey-brown the catalogue prints
  'metallic-brown': { body: '#5e3a2a', blade: '#673f2c', metal: 0.55 },
  'glossy-brown': { body: '#4f2f20', blade: '#553324', metal: 0.2, gloss: true },
  'metallic-blue': { body: '#3d5876', blade: '#45617f', metal: 0.55 },
  'rose-gold': { body: '#c99782', blade: '#cf9f8a', metal: 0.7 },
  'bricken-gold': { body: '#b98a55', blade: '#c29561', metal: 0.6 },
  'golden': { body: '#d6ad74', blade: '#dcb67f', metal: 0.5 },
  'pearl-white': { body: '#f3f1ec', blade: '#f5f3ee', metal: 0.25, gloss: true },
  'titanium-silver': { body: '#b9bcc0', blade: '#c3c6ca', metal: 0.75 },
  'honey-gold': { body: '#d8b06a', blade: '#ddb874', metal: 0.6 },
  'coffee-brown': { body: '#4a3326', blade: '#523a2c', metal: 0.3 },
};
const ACCENTS = {
  copper: { color: '#b8653f', metalness: 1, roughness: 0.28 },
  rose: { color: '#d39a86', metalness: 1, roughness: 0.25 },
  chrome: { color: '#e6e8ea', metalness: 1, roughness: 0.16 },
  gold: { color: '#d9a94f', metalness: 1, roughness: 0.25 },
  body: null, // trims in the body colour
};

const physical = (spec = {}) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.45, ...spec });

// A flat plate from an outline in (x along the radius, y across the chord), lying in the blade plane.
function plate(outline, { thickness = 0.012, pitch = -0.1, y = 0, curve = 12 } = {}) {
  const shape = Array.isArray(outline) ? new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z))) : outline;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: curve });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(pitch));
  geo.translate(0, y, 0);
  geo.computeVertexNormals();
  return geo;
}

// Blade outlines. root/tip are radii; w is the chord.
function bladeShape(kind, root, w) {
  const s = new THREE.Shape();
  const h = w / 2;
  if (kind === 'swept') { // Signature and premium: a gently curved blade, wider near the tip
    s.moveTo(root, -h * 0.8);
    s.bezierCurveTo(0.5, -h * 1.0, 0.8, -h * 1.15 + 0.05, 0.99, -h * 0.75 + 0.07);
    s.quadraticCurveTo(1.03, 0.06, 0.98, h * 0.95 + 0.07);
    s.bezierCurveTo(0.8, h * 1.25 + 0.05, 0.5, h * 1.15, root, h * 0.8);
    s.closePath();
  } else if (kind === 'round') { // 24" fans: short, wide, rounded tip
    s.moveTo(root, -h);
    s.lineTo(0.84, -h * 1.05);
    s.quadraticCurveTo(1.0, -h * 1.05, 1.0, 0);
    s.quadraticCurveTo(1.0, h * 1.05, 0.84, h * 1.05);
    s.lineTo(root, h);
    s.closePath();
  } else { // straight, slightly tapered, square tip with softened corners ('square') or a cut corner ('angled')
    const t = 0.88;
    s.moveTo(root, -h);
    s.lineTo(0.975, -h * t);
    s.quadraticCurveTo(1.0, -h * t, 1.0, -h * t + 0.02);
    if (kind === 'angled') { s.lineTo(1.0, h * t * 0.4); s.lineTo(0.95, h * t); } else { s.lineTo(1.0, h * t - 0.02); s.quadraticCurveTo(1.0, h * t, 0.975, h * t); }
    s.lineTo(root, h);
    s.closePath();
  }
  return s;
}

// The decorative trim where the blade meets the motor.
function trimGeometry(kind, root, w, pitch) {
  const y = -0.026; // on the underside of the blade: ceiling fans are seen from below
  const x0 = root + 0.02;
  if (kind === 'loop' || kind === 'teardrop' || kind === 'window') {
    const s = new THREE.Shape();
    const len = kind === 'teardrop' ? 0.16 : 0.13, hw = w * (kind === 'window' ? 0.32 : 0.36);
    s.moveTo(x0, 0);
    if (kind === 'teardrop') { s.quadraticCurveTo(x0 + 0.02, -hw, x0 + len * 0.6, -hw * 0.8); s.quadraticCurveTo(x0 + len, 0, x0 + len * 0.6, hw * 0.8); s.quadraticCurveTo(x0 + 0.02, hw, x0, 0); } else { s.absellipse(x0 + len / 2, 0, len / 2, hw, 0, Math.PI * 2, false); }
    const hole = new THREE.Path();
    hole.absellipse(x0 + len * (kind === 'teardrop' ? 0.48 : 0.5), 0, len * (kind === 'window' ? 0.32 : 0.36), hw * (kind === 'window' ? 0.55 : 0.62), 0, Math.PI * 2, true);
    s.holes.push(hole);
    return plate(s, { thickness: 0.008, pitch, y, curve: 20 });
  }
  if (kind === 'ring') { // New Josh: a small round ring on each blade, a little way out from the root
    const s = new THREE.Shape();
    s.absarc(x0 + 0.11, 0, w * 0.3, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(x0 + 0.11, 0, w * 0.21, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return plate(s, { thickness: 0.008, pitch, y, curve: 24 });
  }
  if (kind === 'stripes') { // three thin parallel bars across the blade root (Rolex)
    const g = new THREE.BufferGeometry();
    const parts = [0, 1, 2].map((i) => plate([[x0 + i * 0.035, -w * 0.4], [x0 + i * 0.035 + 0.014, -w * 0.4], [x0 + i * 0.035 + 0.014, w * 0.4], [x0 + i * 0.035, w * 0.4]], { thickness: 0.006, pitch, y }));
    return mergeGeometries(parts) ?? g;
  }
  if (kind === 'ornate') { // Signature: a decorated insert along the blade root
    return plate([[x0, -w * 0.38], [x0 + 0.2, -w * 0.32], [x0 + 0.24, 0], [x0 + 0.2, w * 0.32], [x0, w * 0.38]], { thickness: 0.006, pitch, y });
  }
  return null;
}

function mergeGeometries(list) {
  // small local merge (positions + normals) so the stripes are one mesh
  const pos = [], nor = [], idx = [];
  let offset = 0;
  for (const g of list) {
    const gi = g.index ? g : g;
    const p = gi.getAttribute('position'), n = gi.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (gi.index) for (let i = 0; i < gi.index.count; i++) idx.push(gi.index.getX(i) + offset); else for (let i = 0; i < p.count; i++) idx.push(i + offset);
    offset += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

function createCeiling(name, cfg) {
  const small = cfg.size === 24, mid = cfg.size === 36;
  const k = small ? 1.45 : mid ? 1.15 : 1; // motor scale: smaller sweeps have a relatively bigger motor
  const count = cfg.blades ?? (small ? 4 : 3);
  const m = {
    body: physical(), blade: physical(), cap: physical(),
    accent: physical(ACCENTS[cfg.accent ?? 'copper'] ?? {}),
    bracket: physical({ color: '#3a3b3e', metalness: 0.5, roughness: 0.4 }),
  };
  const fan = new THREE.Group();
  fan.name = name;

  // ---- still: canopy (bowl or cone) and the downrod
  const canopy = new THREE.Mesh(cfg.canopy === 'cone'
    ? lathe([[0, TOP], [0.09, TOP], [0.092, TOP - 0.02], [0.07, TOP - 0.09], [0.04, TOP - 0.15], [0.026, TOP - 0.17]])
    : lathe([[0, TOP], [0.09, TOP], [0.1, TOP - 0.03], [0.095, TOP - 0.08], [0.07, TOP - 0.13], [0.035, TOP - 0.16], [0.024, TOP - 0.17]]), m.body);
  const downrod = new THREE.Mesh(lathe([[0.02, TOP - 0.17], [0.019, 0.15], [0.024, 0.09 * k], [0.05 * k, 0.06 * k]], 28), m.body);
  const stator = new THREE.Group();
  stator.add(canopy, downrod);

  // ---- turning: the motor (upper dome, waist, lower body, base cap) with its rings, and the blades
  const r = 0.2 * k;
  const deep = cfg.motor === 'deep';
  const upper = new THREE.Mesh(lathe([[0.05 * k, 0.06 * k], [0.12 * k, 0.052 * k], [r * 0.92, 0.03 * k], [r, 0.005]]), m.body);
  const lower = new THREE.Mesh(lathe([[r, 0.005], [r * 1.01, -0.02 * k], [r * 0.96, -(deep ? 0.06 : 0.045) * k], [r * 0.82, -(deep ? 0.075 : 0.058) * k]]), m.body);
  const capY = -(deep ? 0.075 : 0.058) * k;
  const cap = new THREE.Mesh(lathe([[r * 0.82, capY], [r * 0.74, capY - 0.008 * k], [r * 0.4, capY - 0.013 * k], [0, capY - 0.015 * k]]), m.cap);
  const rotorParts = [upper, lower, cap];
  if (cfg.band !== false) { // copper ring round the waist
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.0055 * k, 10, 96), m.accent);
    band.rotation.x = Math.PI / 2;
    band.position.y = cfg.band === 'low' ? -0.025 * k : 0.004;
    rotorParts.push(band);
    if (cfg.doubleBand) {
      const b2 = band.clone();
      b2.position.y = 0.02 * k;
      b2.scale.setScalar(0.94);
      rotorParts.push(b2);
    }
  }
  if (cfg.capRing !== false) { // ring round the base cap
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.005 * k, 10, 96), m.accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = capY - 0.002;
    rotorParts.push(ring);
  }
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.add(...rotorParts);

  const pitch = -0.1;
  const w = cfg.chord ?? (small ? 0.3 : mid ? 0.19 : 0.15);
  const root = r * 0.95;
  const bladeGeo = plate(bladeShape(cfg.tip ?? (small ? 'round' : 'square'), root + 0.04, w), { pitch, y: -0.006 });
  const bracketGeo = plate([[r * 0.7, -w * 0.18], [root + 0.12, -w * 0.22], [root + 0.12, w * 0.22], [r * 0.7, w * 0.18]], { thickness: 0.014, pitch, y: 0.004 });
  const trimGeo = trimGeometry(cfg.trim ?? 'none', root + 0.04, w, pitch);
  const trimMat = cfg.trimColour === 'body' ? m.body : m.accent;
  const blades = [];
  for (let i = 0; i < count; i++) {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(bladeGeo, m.blade), new THREE.Mesh(bracketGeo, m.bracket));
    if (trimGeo) pivot.add(new THREE.Mesh(trimGeo, trimMat));
    pivot.userData.restAngle = (i * Math.PI * 2) / count;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(r, 1.02, 96),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = -0.01;
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ visible: false }));
  hitArea.rotation.x = -Math.PI / 2;
  fan.add(stator, rotor, blurDisc, hitArea);

  function setFinish(key) {
    const f = CEILING_FINISHES[key] ?? CEILING_FINISHES[cfg.colour] ?? CEILING_FINISHES['smoke-brown'];
    for (const [mat, color] of [[m.body, f.body], [m.blade, f.blade], [m.cap, f.body]]) {
      mat.color.set(color);
      mat.metalness = f.metal;
      mat.roughness = f.gloss ? 0.18 : 0.38;
      mat.clearcoat = f.gloss ? 1 : 0.35;
      mat.clearcoatRoughness = f.gloss ? 0.05 : 0.25;
      mat.envMapIntensity = 1 + mat.metalness * 1.2;
      mat.needsUpdate = true;
    }
  }
  setFinish(cfg.colour);
  return {
    fan, rotor, stator, blades, blurDisc, hitArea, setFinish,
    shadows(on) { fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

// ---------------------------------------------------------------- the range, as pictured
// colour: the colour in its picture · trim: blade-root decoration · tip: blade end · band/capRing: copper rings
const SILVER = { size: 48, colour: 'smoke-brown', accent: 'copper', trim: 'loop' };
const MINI = { size: 24, colour: 'smoke-brown', accent: 'copper', trim: 'none' };

export const CEILING = {
  // Signature Series and the new premium range
  'air-max-48': { size: 48, colour: 'golden', accent: 'copper', tip: 'swept', trim: 'ornate', chord: 0.16, doubleBand: true },
  'art-pro-48': { size: 48, colour: 'golden', accent: 'copper', tip: 'swept', trim: 'ornate', chord: 0.16 },
  'coral-48': { size: 48, colour: 'golden', accent: 'gold', tip: 'swept', trim: 'window', trimColour: 'body', chord: 0.16 },
  'coras-48': { size: 48, colour: 'golden', accent: 'copper', tip: 'swept', trim: 'ornate', chord: 0.16 },
  'irus-48': { size: 48, colour: 'metallic-brown', accent: 'copper', tip: 'swept', trim: 'ornate', chord: 0.15 },
  'heritage-48': { size: 48, colour: 'honey-gold', accent: 'chrome', tip: 'swept', trim: 'window', chord: 0.17, motor: 'deep' },
  'pazero-48': { size: 48, colour: 'titanium-silver', accent: 'rose', tip: 'swept', trim: 'window', chord: 0.16, motor: 'deep' },
  // Silver Series, 24" and 36"
  'mini-dlx-24': { ...MINI, trim: 'none' },
  'mini-smart-24': { ...MINI, colour: 'metallic-brown', trim: 'window' },
  'mini-star-24': { ...MINI, band: false },
  'new-josh-24': { ...MINI, colour: 'ivory', trim: 'ring', capRing: true },
  'diplomat-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'window', band: false },
  'major-36': { size: 36, colour: 'metallic-brown', accent: 'copper', trim: 'none', doubleBand: true },
  'orbit-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'teardrop' },
  // Silver Series, 48"
  'apsara-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
  'areta-48': { ...SILVER, colour: 'white', trim: 'window', accent: 'chrome' },
  'croma-48': { ...SILVER, trim: 'loop' },
  'crystal-pro-48': { ...SILVER, trim: 'teardrop' },
  'electra-48': { ...SILVER, colour: 'white', trim: 'window', accent: 'chrome', band: false },
  'festiva-48': { ...SILVER, trim: 'none', capRing: false },
  'flora-48': { ...SILVER, trim: 'loop', accent: 'rose' },
  'florence-48': { ...SILVER, trim: 'window' },
  'glaze-48': { ...SILVER, trim: 'teardrop', doubleBand: true },
  'ikon-48': { ...SILVER, colour: 'white', trim: 'none', accent: 'chrome', tip: 'angled' },
  'luster-48': { ...SILVER, trim: 'loop', doubleBand: true },
  'phantom-48': { ...SILVER, trim: 'window', band: 'low' },
  'prince-48': { ...SILVER, colour: 'metallic-brown', trim: 'none', doubleBand: true },
  'rosa-48': { ...SILVER, colour: 'ivory', trim: 'stripes', accent: 'copper' },
  'senorita-48': { ...SILVER, trim: 'stripes' },
  'sonet-deco-48': { ...SILVER, trim: 'teardrop' },
  'sparsh-48': { ...SILVER, colour: 'metallic-blue', trim: 'none', band: false, accent: 'chrome' },
  'stunner-48': { ...SILVER, colour: 'metallic-brown', trim: 'window' },
  'unicorn-48': { ...SILVER, colour: 'white', trim: 'window', accent: 'copper' },
  // Ultra Gold Series, 24" and 36"
  'little-star-24': { ...MINI, colour: 'smoke-brown', band: false },
  'mini-copper-24': { ...MINI, trim: 'none' },
  'new-josh-copper-24': { ...MINI, colour: 'ivory', trim: 'ring', capRing: true },
  'tejas-24': { ...MINI, colour: 'glossy-brown', trim: 'window' },
  'nova-dlx-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'loop', band: false },
  'saphire-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'window' },
  'virat-36': { size: 36, colour: 'metallic-brown', accent: 'copper', trim: 'none', doubleBand: true },
  // Ultra Gold Series, 48"
  'aroma-deco-48': { ...SILVER, trim: 'teardrop' },
  'aspire-48': { ...SILVER, trim: 'loop', accent: 'rose' },
  'croma-pro-48': { ...SILVER, trim: 'loop', doubleBand: true },
  'fortune-pro-48': { ...SILVER, trim: 'none', doubleBand: true },
  'kiara-48': { ...SILVER, trim: 'none', band: false },
  'lotus-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
  'lumero-48': { ...SILVER, colour: 'ivory', trim: 'ornate', accent: 'copper', tip: 'swept', chord: 0.16 },
  'orchid-deco-48': { ...SILVER, trim: 'none', accent: 'rose', doubleBand: true },
  'orina-48': { ...SILVER, trim: 'window', band: false },
  'platinium-48': { ...SILVER, trim: 'window' },
  'porsche-48': { ...SILVER, trim: 'window', band: 'low' },
  'rafale-48': { ...SILVER, trim: 'none', band: false, tip: 'angled' },
  'raftaar-48': { ...SILVER, trim: 'loop' },
  'rolex-48': { ...SILVER, trim: 'stripes' },
  'runner-48': { ...SILVER, trim: 'window', doubleBand: true },
  'sayonara-48': { ...SILVER, trim: 'loop' },
  'smart-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
  'venus-deco-48': { ...SILVER, trim: 'loop', accent: 'rose', doubleBand: true },
  'viraj-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose', doubleBand: true },
  'viraz-48': { ...SILVER, trim: 'none', band: false },
  'vista-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
};

export const CEILING_MODELS = Object.fromEntries(Object.entries(CEILING).map(([key, cfg]) => [
  key, ({ shadows = false } = {}) => { const fan = createCeiling(key, cfg); fan.shadows(shadows); return fan; },
]));

// ---------------------------------------------------------------- AIR MAX (Signature Series), its own model
// From poster 07 AIRMAX, which shows it in two finishes (gold tone and copper tone; the colour names are still
// being confirmed by Aparna): an inverted-cone canopy with a glossy maroon rim, a cone shank cover over the
// motor ("designer shank cover"), a low wide motor whose base carries a curved three-armed plate edged in
// maroon, a maroon-framed cover with a wavy-line insert on each blade root, and broad satin blades that widen
// slightly to a rounded tip.

const AIRMAX_FINISHES = {
  gold: { body: '#d8b57f', blade: '#dcbb88', insert: '#e3c99a', lines: '#7a4a2a', metal: 0.45 },
  copper: { body: '#9c5236', blade: '#a65a3b', insert: '#e9e4de', lines: '#a8573a', metal: 0.5 },
};

function wavyTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = line;
  g.lineWidth = 2.2;
  for (let i = -6; i < 16; i++) { // flowing wavy lines, as on the blade-root inserts
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = i * 11 + 18 * Math.sin(x / 34 + i * 0.4) + x * 0.12;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createAirMax({ shadows = false } = {}) {
  const m = {
    body: physical({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    blade: physical({ roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.25 }),
    maroon: physical({ color: '#7d1f26', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0.3 }),
    insert: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }),
  };
  const fan = new THREE.Group();
  fan.name = 'air-max';

  // still: inverted-cone canopy with a maroon rim, the downrod and the cone shank cover
  const canopy = new THREE.Mesh(lathe([[0, TOP], [0.11, TOP], [0.112, TOP - 0.012], [0.07, TOP - 0.08], [0.03, TOP - 0.15], [0.022, TOP - 0.165]]), m.body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.009, 10, 64), m.maroon);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TOP - 0.008;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, TOP - 0.165 - 0.13, 20), m.body);
  rod.position.y = (TOP - 0.165 + 0.13) / 2;
  const shank = new THREE.Mesh(lathe([[0.019, 0.14], [0.03, 0.11], [0.05, 0.085], [0.075, 0.068]], 40), m.body);
  const stator = new THREE.Group();
  stator.add(canopy, rim, rod, shank);

  // turning: a low wide motor with a maroon line at the waist and the three-armed plate on its base
  const r = 0.2;
  const upper = new THREE.Mesh(lathe([[0.07, 0.068], [0.14, 0.058], [0.19, 0.03], [r, 0.004]]), m.body);
  const lower = new THREE.Mesh(lathe([[r, 0.004], [0.202, -0.018], [0.19, -0.034], [0.17, -0.04]]), m.body);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.17, 64), m.body);
  base.rotation.x = Math.PI / 2;
  base.position.y = -0.04;
  const waist = new THREE.Mesh(new THREE.TorusGeometry(r * 1.004, 0.0045, 8, 96), m.maroon);
  waist.rotation.x = Math.PI / 2;
  waist.position.y = 0.006;
  const triLobe = (R, y, material) => { // the curved "Y": three arms swirling towards the blades
    const s = new THREE.Shape();
    for (let i = 0; i <= 180; i++) {
      const p = (i / 180) * Math.PI * 2;
      const rr = R * (0.36 + 0.64 * Math.pow(0.5 + 0.5 * Math.cos(3 * p - 0.5 * Math.sin(3 * p)), 1.6)); // three swept arms
      const x = Math.cos(p) * rr, z = Math.sin(p) * rr;
      if (i === 0) s.moveTo(x, z); else s.lineTo(x, z);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    return new THREE.Mesh(g, material);
  };
  const plateEdge = triLobe(0.172, -0.041, m.maroon);
  const plate = triLobe(0.15, -0.049, m.body);
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.add(upper, lower, base, waist, plateEdge, plate);

  // blades: broad, slightly wider at the tip, rounded tip; a maroon-framed cover with a wavy insert at the root
  const pitch = -0.1;
  const s = new THREE.Shape();
  s.moveTo(0.22, -0.075);
  s.bezierCurveTo(0.5, -0.082, 0.8, -0.09, 0.95, -0.092);
  s.quadraticCurveTo(1.01, -0.09, 1.0, -0.02);
  s.quadraticCurveTo(0.995, 0.09, 0.93, 0.1);
  s.bezierCurveTo(0.75, 0.098, 0.45, 0.085, 0.22, 0.075);
  s.closePath();
  const bladeGeo = plate_(s, pitch, -0.006, 0.012);
  // (both on the underside of the blade, where the poster shows them)
  const frameGeo = plate_([[0.17, -0.1], [0.42, -0.108], [0.47, -0.07], [0.47, 0.07], [0.42, 0.108], [0.17, 0.1]], pitch, -0.024, 0.014);
  const insertGeo = plate_([[0.2, -0.078], [0.4, -0.084], [0.44, -0.052], [0.44, 0.052], [0.4, 0.084], [0.2, 0.078]], pitch, -0.033, 0.004);
  // texture coordinates across the insert so the wavy lines show
  const uv = insertGeo.getAttribute('uv');
  const pos = insertGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - 0.2) / 0.24, (pos.getZ(i) + 0.09) / 0.18);
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(bladeGeo, m.blade), new THREE.Mesh(frameGeo, m.maroon), new THREE.Mesh(insertGeo, m.insert));
    pivot.userData.restAngle = (i * Math.PI * 2) / 3;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(r, 1.02, 96),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = -0.01;
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ visible: false }));
  hitArea.rotation.x = -Math.PI / 2;
  fan.add(stator, rotor, blurDisc, hitArea);
  fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = shadows; o.receiveShadow = shadows; } });

  const textures = {};
  function setFinish(key) {
    const f = AIRMAX_FINISHES[key] ?? AIRMAX_FINISHES.gold;
    for (const [mat, color] of [[m.body, f.body], [m.blade, f.blade]]) {
      mat.color.set(color);
      mat.metalness = f.metal;
      mat.envMapIntensity = 1 + f.metal * 1.2;
      mat.needsUpdate = true;
    }
    textures[key] ??= wavyTexture(f.insert, f.lines);
    m.insert.map = textures[key];
    m.insert.needsUpdate = true;
  }
  setFinish('gold');
  // a little closer than the other ceiling fans, so the motor plate and blade covers read
  return { fan, rotor, stator, blades, blurDisc, hitArea, setFinish, viewerPose: { elevation: -0.55, azimuth: 0.6, screenX: 0.5, screenY: 0.52, fill: 0.86, zoom: 1.15 } };
}

function plate_(outline, pitch, y, thickness) {
  return plate(outline, { pitch, y, thickness, curve: 24 });
}

CEILING_MODELS['air-max-48'] = createAirMax;
