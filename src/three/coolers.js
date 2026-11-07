// Aparna air coolers (Pearl, Discovery and Ultima series), built procedurally in three.js from one shared builder.
// Each cooler below is a set of proportions, colours and details read off its own poster (posters 18-24):
//   - a white (or cream, grey) cabinet with a front panel: louvres, a square grid, vertical slats, or (Ultima
//     2601) a round spiral fan grille with the fan visible behind it
//   - brown honeycomb cooling pads on one side (Pearl, Discovery) or vent slots (Ultima)
//   - a lower water tank (ribbed on the Ultimas) with a water-level window, castor wheels, knobs on top
//   - a glass top on the DLX models
// The inner fan is the turning part (the scene spins it); it shows through the Ultima 2601's grille.
// Sides the posters don't show follow the visible side.

import * as THREE from 'three';
import { makeBlurTexture } from './aeroflow-model.js';

const physical = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};

function roundedBox(w, h, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bevel = Math.min(r, d / 2) * 0.6;
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.5, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -(d - 2 * bevel) / 2);
  geo.computeVertexNormals();
  return geo;
}

// Brown honeycomb cooling pad seen through a white plastic lattice, as on the Pearl and Discovery posters.
let padTexture;
function honeycombTexture() {
  if (padTexture) return padTexture;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8b5a38';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) { // the pad's fibrous mottle
    g.fillStyle = `rgba(${150 + Math.random() * 60},${95 + Math.random() * 40},${55 + Math.random() * 30},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 3 + Math.random() * 5, 2 + Math.random() * 3);
  }
  g.strokeStyle = '#f4f3ef';
  g.lineWidth = 9;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 3; x++) { // the lattice of rounded openings
    g.beginPath();
    g.roundRect(8 + x * 82, 8 + y * 63, 76, 56, 14);
    g.stroke();
  }
  padTexture = new THREE.CanvasTexture(c);
  padTexture.colorSpace = THREE.SRGBColorSpace;
  return padTexture;
}

function cooler(name, cfg) {
  const { w, d, upper, lower } = cfg;
  const H = upper + lower;
  const floor = -H / 2 - 0.05;
  const m = {
    body: physical({ color: cfg.body ?? '#f4f4f1', roughness: 0.3, clearcoat: 0.6 }),
    lower: physical({ color: cfg.lowerColour ?? cfg.body ?? '#f1f1ee', roughness: 0.32, clearcoat: 0.5 }),
    front: physical({ color: cfg.front.colour, roughness: 0.28, clearcoat: 0.8, metalness: 0.1 }),
    dark: physical({ color: '#16171a', roughness: 0.45 }),
    knob: physical({ color: cfg.knob ?? '#c9ccd1', metalness: 0.5, roughness: 0.3 }),
    glass: physical({ color: '#101114', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.2 }),
    wheel: physical({ color: '#34353a', roughness: 0.35, clearcoat: 0.8 }),
    leg: physical({ color: cfg.legs ?? cfg.lowerColour ?? '#e9e9e6', roughness: 0.3, clearcoat: 0.6 }),
    pad: new THREE.MeshStandardMaterial({ map: honeycombTexture(), roughness: 0.8 }),
    blade: physical({ color: '#2a2b2e', roughness: 0.4 }),
  };
  const fan = new THREE.Group();
  fan.name = name;
  const stator = new THREE.Group();

  // cabinet and tank
  const cab = new THREE.Mesh(roundedBox(w, upper, d, 0.07), m.body);
  cab.position.y = floor + lower + upper / 2;
  const tank = new THREE.Mesh(roundedBox(w * 0.97, lower, d * 0.97, 0.05), m.lower);
  tank.position.y = floor + lower / 2;
  const lid = new THREE.Mesh(roundedBox(w * 0.96, d * 0.94, 0.05, 0.04), m.body); // laid flat below
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = floor + H + 0.02;
  stator.add(cab, tank, lid);
  if (cfg.glassTop) {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.75), m.glass);
    top.rotation.x = -Math.PI / 2;
    top.position.y = floor + H + 0.052;
    stator.add(top);
  }

  // front panel
  const pw = w * (cfg.front.width ?? 0.72), ph = upper * (cfg.front.height ?? 0.74);
  const panelY = floor + lower + upper * 0.52;
  const z = d / 2 + 0.006;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), ['louvre', 'smooth'].includes(cfg.front.kind) ? m.front : m.dark);
  panel.position.set(cfg.front.x ?? 0, panelY, z);
  stator.add(panel);
  const fx = cfg.front.x ?? 0;
  if (cfg.front.kind === 'louvre') {
    // horizontal louvres
    const n = Math.round(ph / 0.075);
    for (let i = 0; i < n; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.96, 0.045, 0.012), m.front);
      slat.rotation.x = -0.45;
      slat.position.set(fx, panelY - ph / 2 + (i + 0.5) * (ph / n), z + 0.012);
      stator.add(slat);
    }
  } else if (cfg.front.kind === 'grid' || cfg.front.kind === 'slats') {
    // a black square grid (Ultima 1801) or vertical slats (Ultima 2201) over a dark panel
    const frameMat = physical({ color: cfg.front.colour, roughness: 0.3, clearcoat: 0.5 });
    const cols = cfg.front.kind === 'grid' ? 9 : 16;
    for (let i = 1; i < cols; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, ph, 0.03), frameMat);
      bar.position.set(fx - pw / 2 + (i * pw) / cols, panelY, z + 0.015);
      stator.add(bar);
    }
    if (cfg.front.kind === 'grid') for (let i = 1; i < 9; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.012, 0.03), frameMat);
      bar.position.set(fx, panelY - ph / 2 + (i * ph) / 9, z + 0.015);
      stator.add(bar);
    }
  } else if (cfg.front.kind === 'spiral') {
    // a round fan grille of curved spokes (Ultima 2601), the fan visible behind it
    const r = Math.min(pw, ph) * 0.47;
    const ringMat = physical({ color: '#2b2c2f', roughness: 0.35, metalness: 0.3 });
    for (const f of [0.18, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * f, f === 1 ? 0.012 : 0.008, 8, 64), ringMat);
      ring.position.set(fx, panelY, z + 0.02);
      stator.add(ring);
    }
    for (let i = 0; i < 30; i++) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, rr = r * (0.18 + 0.82 * t), a = (i / 30) * Math.PI * 2 + t * 1.3;
        pts.push(new THREE.Vector3(fx + Math.cos(a) * rr, panelY + Math.sin(a) * rr, z + 0.02));
      }
      stator.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.006, 4), ringMat));
    }
    panel.material = physical({ color: '#3a3b3f', roughness: 0.6 });
  }

  // side: honeycomb pads (Pearl, Discovery) or vent slots (Ultima)
  for (const side of cfg.sides) {
    const sx = (w / 2 + 0.03) * (side === 'left' ? -1 : 1); // just outside the cabinet's rounded edge
    if (cfg.side === 'honeycomb') {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.72, upper * 0.78), m.pad);
      pad.rotation.y = side === 'left' ? -Math.PI / 2 : Math.PI / 2;
      pad.position.set(sx, floor + lower + upper * 0.5, 0);
      stator.add(pad);
    } else {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, d * 0.62), m.dark);
        slot.position.set(sx, floor + lower + upper * (0.18 + (0.64 * i) / (n - 1)), 0);
        stator.add(slot);
      }
    }
  }

  // ribbed lower tank (Ultima) and the water-level window
  if (cfg.ribs) for (let i = 0; i < 9; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, lower * 0.8, 0.025), m.lower);
    rib.position.set(-w * 0.4 + (i * w * 0.8) / 8, floor + lower * 0.48, d * 0.485 + 0.01);
    stator.add(rib);
  }
  const window_ = new THREE.Mesh(new THREE.PlaneGeometry(0.025, lower * 0.4), physical({ color: '#8fa3b4', roughness: 0.2, clearcoat: 1 }));
  window_.position.set(cfg.ribs ? w * 0.07 : 0, floor + lower * 0.5, d * 0.485 + (cfg.ribs ? 0.026 : 0.004));
  stator.add(window_);

  // knobs on top, at the front
  for (let i = 0; i < (cfg.knobs ?? 0); i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.035, 24), m.knob);
    knob.position.set((i - ((cfg.knobs ?? 1) - 1) / 2) * 0.11, floor + H + 0.06, d * 0.3);
    stator.add(knob);
  }

  // castor wheels (and coloured legs on some Pearls)
  for (const [x, zz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    if (cfg.legs) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), m.leg);
      leg.position.set(x * w * 0.44, floor + 0.02, zz * d * 0.44);
      stator.add(leg);
    }
    // a swivel castor: mount plate, fork and a wheel that shows below the body
    const cx = x * w * 0.4, cz = zz * d * 0.38;
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.03, 20), m.wheel);
    mount.position.set(cx, floor - 0.012, cz);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.026), m.wheel);
    fork.position.set(cx, floor - 0.05, cz - 0.012);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.034, 24), m.wheel);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(cx, floor - 0.082, cz + 0.008);
    stator.add(mount, fork, wheel);
  }

  // the inner fan (turns), behind the front panel
  const axis = new THREE.Group();
  axis.position.set(fx, panelY, d / 2 - 0.07);
  axis.rotation.x = Math.PI / 2;
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  axis.add(rotor);
  const fanR = Math.min(pw, ph) * 0.42;
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(fanR * 0.2, fanR * 0.2, 0.05, 24), m.blade));
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(fanR * 0.8, 0.008, fanR * 0.4), m.blade);
    blade.position.x = fanR * 0.6;
    blade.rotation.x = -0.4;
    pivot.add(blade);
    pivot.userData.restAngle = (i * Math.PI) / 2;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(fanR * 0.2, fanR, 48),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  blurDisc.rotation.x = -Math.PI / 2;
  axis.add(blurDisc);
  const hitArea = new THREE.Mesh(new THREE.PlaneGeometry(w, H), new THREE.MeshBasicMaterial({ visible: false }));

  fan.add(stator, axis, hitArea);
  const shadows = (on) => fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = on; o.receiveShadow = on; } });
  return {
    fan, rotor, stator, blades, blurDisc, hitArea, setFinish() {}, shadows,
    // a three-quarter view from a little above, showing the front and the side pads
    viewerPose: { elevation: 0.18, azimuth: 0.6, screenX: 0.5, screenY: 0.5, fill: 0.9, zoom: cfg.zoom ?? 0.95 },
  };
}

const build = (name, cfg) => ({ shadows = false } = {}) => { const c = cooler(name, cfg); c.shadows(shadows); return c; };

// Pearl and Discovery: tall personal coolers. Discovery pads on the right, Pearl pads on the left.
const PERSONAL = { w: 0.66, d: 0.56, upper: 1.0, lower: 0.62, side: 'honeycomb', knobs: 2 };
const BLACK = '#17181b', LILAC = '#b9a3d9', TEAL = '#3f9fb8';

export const COOLERS = {
  'discovery-1201': build('discovery-1201', { ...PERSONAL, sides: ['right'], front: { kind: 'louvre', colour: BLACK } }),
  'discovery-1202': build('discovery-1202', { ...PERSONAL, sides: ['right'], front: { kind: 'louvre', colour: LILAC }, knobs: 3 }),
  'discovery-1203-dlx': build('discovery-1203-dlx', { ...PERSONAL, sides: ['right'], front: { kind: 'louvre', colour: BLACK }, glassTop: true }),
  'discovery-1204-dlx': build('discovery-1204-dlx', { ...PERSONAL, upper: 1.1, lower: 0.72, sides: ['right'], front: { kind: 'louvre', colour: BLACK }, glassTop: true, zoom: 0.88 }),
  'pearl-009': build('pearl-009', { ...PERSONAL, w: 0.58, side: 'slots', sides: ['left'], front: { kind: 'louvre', colour: TEAL, width: 0.62 }, knobs: 2 }),
  'pearl-1201': build('pearl-1201', { ...PERSONAL, sides: ['left'], front: { kind: 'louvre', colour: LILAC } }),
  'pearl-1202': build('pearl-1202', { ...PERSONAL, sides: ['left'], front: { kind: 'louvre', colour: TEAL }, legs: TEAL }),
  'pearl-1203-dlx': build('pearl-1203-dlx', { ...PERSONAL, sides: ['left'], front: { kind: 'louvre', colour: LILAC }, legs: LILAC, glassTop: true, knobs: 3 }),
  // Ultima: larger, a smooth or gridded dark front, vent slots, ribbed tank
  'ultima-1401': build('ultima-1401', { w: 0.82, d: 0.62, upper: 0.95, lower: 0.62, side: 'slots', sides: ['right'], front: { kind: 'smooth', colour: BLACK, width: 0.78 }, ribs: true }),
  'ultima-1402': build('ultima-1402', { w: 0.82, d: 0.62, upper: 1.0, lower: 0.7, side: 'slots', sides: ['right'], front: { kind: 'smooth', colour: BLACK, width: 0.74, x: -0.05 }, ribs: true, zoom: 0.9 }),
  'ultima-1601': build('ultima-1601', { w: 0.85, d: 0.64, upper: 1.0, lower: 0.66, body: '#efe9dc', lowerColour: '#5a4636', side: 'honeycomb', sides: ['right'], front: { kind: 'louvre', colour: '#5b4636' }, knobs: 3, zoom: 0.9 }),
  'ultima-1801': build('ultima-1801', { w: 0.85, d: 0.64, upper: 1.0, lower: 0.66, lowerColour: '#1d1e21', side: 'slots', sides: ['right'], front: { kind: 'grid', colour: '#1b1c1f', width: 0.7, x: -0.06 }, knobs: 2, zoom: 0.9 }),
  'ultima-2201': build('ultima-2201', { w: 1.05, d: 0.72, upper: 1.0, lower: 0.6, body: '#e4e5e7', lowerColour: '#d8d9db', side: 'slots', sides: ['left'], front: { kind: 'slats', colour: '#18191c', width: 0.62, x: 0.12 }, ribs: true, zoom: 0.85 }),
  'ultima-2601': build('ultima-2601', { w: 1.05, d: 0.72, upper: 1.05, lower: 0.62, body: '#dfe0e2', lowerColour: '#d3d4d6', side: 'slots', sides: ['left', 'right'], front: { kind: 'spiral', colour: '#2b2c2f', width: 0.86, height: 0.84 }, ribs: true, zoom: 0.82 }),
};
