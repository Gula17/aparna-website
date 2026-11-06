// Aparna front-facing fans (pedestal, table and wall), built procedurally in three.js from one shared builder.
// Each fan below is a set of measurements and colours read off that product's own pictures:
//   SULTAN 20"  high-speed pedestal  catalogue picture: dark wire guard, three dark swept blades, domed hub,
//                                    black pole, grey round base with a dark rim
//   HEXA 20"    high-speed pedestal  catalogue picture: as the Sultan's stand, five dark paddle blades that
//                                    widen to rounded tips
//   VISTARA 16" table fan            poster + its own photo: cream wire guard with a teal rim, five curved aqua
//                                    blades, large cream hub, cream stand on a wide base with four teal buttons
//   VENTO 12"   wall fan             its own photo + poster 11: dark wire guard with one inner ring, three wide
//                                    grey-blue blades, large black domed hub, black rounded wall body
//   SPECTRA 16", WENDY    wall fans     posters 14: white, a short wall body with a ring switch, two pull cords
//   GLIDER, SPIDER 16"    table fans    posters 10: black, a round domed base with one knob (Glider) or three (Spider)
//   FIONA 16"   pedestal fan            poster 13: all white, a grey speed panel on the pole
//   NEXA 20"    high-speed pedestal     catalogue picture: as the Sultan, three broad paddle blades
// Third batch (posters 9-17 and the catalogue's all-purpose and high-speed pages), first colour shown on each:
//   TORNADO, JAZZ, VELORA wall · VECTRA, BLAZO, BLITZ, GOAIR 12/16, JAWA, REGAL, SAFARI table
//   PIANO BLACK/WHITE on a C-shaped yoke · STALLION pedestal · BULLET 12/16 (and OSC), ORNET, SHINE, CHAMPION,
//   INDUS high-speed pedestals
// The backs (motor housing, rear guard), which the pictures hide, follow the visible front. Printed logos on the
// hubs are left off: the brand rules forbid retyping the name in a font.
//
// Same parts as the ceiling models (aeroflow-model.js), so the scene drives them unchanged: the rotor turns about
// its own y axis, which is pointed at the viewer here.

import * as THREE from 'three';
import { lathe, makeBlurTexture } from './aeroflow-model.js';

const R = 0.5; // guard radius

const physical = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.45, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};

// One guard (front or back): radial wires and rings on a shallow dome, facing +z (front) or -z (back).
function guard(material, rimMaterial, { side = 1, depth = 0.1, offset = 0.06, wires = 60, rings = [0.85], inner = 0.13 } = {}) {
  const g = new THREE.Group();
  const z = (r) => side * (offset + depth * (1 - (r / R) ** 2)); // deepest in the middle
  for (let i = 0; i < wires; i++) {
    const a = (i / wires) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const r = inner + ((R - inner) * k) / 12;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z(r)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0032, 4), material));
  }
  for (const f of rings) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * f, 0.0038, 6, 96), material);
    ring.position.z = z(R * f);
    g.add(ring);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0075, 8, 128), rimMaterial);
  rim.position.z = z(R);
  g.add(rim);
  return g;
}

// Blade outlines, as width and sweep along the blade (t = 0 at the root, 1 at the tip).
const BLADE_SHAPES = {
  // swept "scimitar": widest a third of the way out, narrowing to a curved tip
  scimitar: { width: (t) => 0.075 + 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - 0.35 * t), sweep: (t) => 0.16 * t * t },
  // wide classic table-fan blade
  broad: { width: (t) => 0.08 + 0.17 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.85)), sweep: (t) => 0.12 * t * t },
  // paddle: narrow at the root, widening to a broad rounded tip
  paddle: { width: (t) => 0.05 + 0.13 * Math.min(1, t * 1.6), sweep: (t) => 0.03 * t },
};

function bladeGeometry({ shape, tip, root, pitch }) {
  const { width, sweep } = BLADE_SHAPES[shape];
  const lead = [], trail = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = root + (tip - root) * t;
    lead.push(new THREE.Vector2(x, sweep(t) - width(t) * 0.45));
    trail.push(new THREE.Vector2(x, sweep(t) + width(t) * 0.55));
  }
  const s = new THREE.Shape();
  s.moveTo(lead[0].x, lead[0].y);
  s.splineThru(lead.slice(1));
  const a = lead[steps], b = trail[steps];
  const round = shape === 'paddle' ? 0.06 : 0.03; // paddle blades end in a broad round tip
  s.bezierCurveTo(a.x + round, a.y + 0.02, b.x + round, b.y - 0.02, b.x, b.y);
  s.splineThru(trail.slice(0, -1).reverse());
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 16 });
  geo.translate(0, 0, -0.005);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-pitch));
  geo.computeVertexNormals();
  return geo;
}

// A rounded box (for the table base and the wall body), centred on the origin.
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bevel = Math.min(r, d / 2) * 0.8;
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -(d - 2 * bevel) / 2);
  geo.computeVertexNormals();
  return geo;
}

// ---- the stands
function pedestalStand(m, { headY, floorY, panel = false, chromeUpper = false }) {
  const g = new THREE.Group();
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 24), m.body);
  neck.position.set(0, headY - 0.2, -0.17);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, headY - 0.3 - floorY, 24), m.body);
  pole.position.set(0, (headY - 0.3 + floorY) / 2, -0.17);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.05, 32), m.body);
  collar.position.set(0, floorY + 0.13, -0.17);
  if (chromeUpper) {
    // the telescopic upper pole is bright chrome, with a height-lock collar where it meets the lower pole
    const midY = (headY - 0.3 + floorY) / 2 + 0.15;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, headY - 0.3 - midY, 20), m.chrome);
    upper.position.set(0, (headY - 0.3 + midY) / 2, -0.17);
    pole.scale.y = (midY - floorY) / (headY - 0.3 - floorY);
    pole.position.y = (midY + floorY) / 2;
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 24), m.accent);
    lock.position.set(0, midY, -0.17);
    g.add(upper, lock);
  } else if (m.accent !== m.body) {
    // a coloured height-lock collar half way up the pole (Stallion, Fiona)
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.07, 24), m.accent);
    lock.position.set(0, (headY - 0.3 + floorY) / 2 + 0.12, -0.17);
    g.add(lock);
  }
  const base = new THREE.Mesh(lathe([[0.06, floorY + 0.12], [0.16, floorY + 0.1], [0.33, floorY + 0.06], [0.4, floorY + 0.04], [0.41, floorY + 0.02]]), m.base);
  const rim = new THREE.Mesh(lathe([[0.41, floorY + 0.025], [0.425, floorY + 0.012], [0.42, floorY], [0, floorY]]), m.baseRim);
  base.position.z = rim.position.z = -0.17;
  g.add(neck, pole, collar, base, rim);
  if (panel) {
    // a speed-control panel on the upper pole, with four buttons down its face
    const box = new THREE.Mesh(roundedBox(0.11, 0.34, 0.08, 0.04), m.accent);
    box.position.set(0, headY - 0.52, -0.13);
    g.add(box);
    for (let i = 0; i < 4; i++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), m.base);
      key.position.set(0, headY - 0.42 - i * 0.06, -0.085);
      g.add(key);
    }
  }
  return g;
}

function tableStand(m, { headY, floorY }) {
  const g = new THREE.Group();
  // a tapered column from under the motor down to the base, oval in section
  const h = headY - 0.28 - (floorY + 0.12);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.13, h, 32), m.body);
  column.scale.z = 0.6;
  column.position.set(0, floorY + 0.12 + h / 2, -0.12);
  // footprint 0.78 x 0.46, 0.13 high: drawn as a rounded outline, laid flat
  const base = new THREE.Mesh(roundedBox(0.78, 0.46, 0.13, 0.08), m.base);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, floorY + 0.065, -0.1);
  g.add(column, base);
  // four piano-key speed buttons on the front edge
  for (let i = 0; i < 4; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.04), m.accent);
    key.position.set(-0.105 + i * 0.07, floorY + 0.14, 0.06);
    g.add(key);
  }
  return g;
}

function tableRoundStand(m, { headY, floorY, knobs = 1 }) {
  const g = new THREE.Group();
  const h = headY - 0.27 - (floorY + 0.1);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 32), m.body);
  column.scale.z = 0.7;
  column.position.set(0, floorY + 0.1 + h / 2, -0.15);
  const base = new THREE.Mesh(lathe([[0.08, floorY + 0.12], [0.2, floorY + 0.1], [0.32, floorY + 0.06], [0.36, floorY + 0.03], [0.355, floorY]]), m.base);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.355, 48), m.base);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = floorY;
  base.position.z = bottom.position.z = -0.15;
  g.add(column, base, bottom);
  for (let i = 0; i < knobs; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.035, 20), m.accent);
    knob.position.set((i - (knobs - 1) / 2) * 0.075, floorY + 0.085, 0.1);
    g.add(knob);
  }
  return g;
}

function wallStand(m, { headY, body = [0.27, 0.66], drop = 0.14, ring = false, knob = false, cords = false }) {
  const g = new THREE.Group();
  // the rounded body that hangs below the head, against the wall
  const [bw, bh] = body;
  // drop: how far below the hub the body starts (Vento's tall body tucks in behind the motor; Spectra's and
  // Wendy's hang below the guard on a short neck)
  const top = headY - drop;
  const box = new THREE.Mesh(roundedBox(bw, bh, 0.16, Math.min(0.12, bw / 2.2)), m.body);
  box.position.set(0, top - bh / 2, -0.2);
  g.add(box);
  if (drop > 0.2) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, drop - 0.08, 20), m.body);
    neck.position.set(0, headY - 0.04 - (drop - 0.08) / 2, -0.2);
    g.add(neck);
  }
  const detailY = top - bh * 0.62;
  if (knob) {
    // a round speed knob on the body's face
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.04, 28), m.accent);
    k.rotation.x = Math.PI / 2;
    k.position.set(0, detailY, -0.1);
    g.add(k);
  } else if (ring) {
    // the round speed-switch surround on the body's face
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 12, 40), m.accent);
    r.position.set(0, detailY, -0.11);
    g.add(r);
  } else {
    const dimple = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.base);
    dimple.rotation.x = Math.PI / 2;
    dimple.scale.set(1, 0.25, 1.4);
    dimple.position.set(0, detailY, -0.11);
    g.add(dimple);
  }
  if (cords) {
    // two pull cords (speed and oscillation) with tassels
    for (const x of [-0.045, 0.045]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 6), m.base);
      cord.position.set(x, top - bh - 0.11, -0.16);
      const tassel = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 6, 12), m.body);
      tassel.position.set(x, top - bh - 0.25, -0.16);
      g.add(cord, tassel);
    }
  }
  return g;
}

function yokeStand(m, { headY, floorY }) {
  const g = new THREE.Group();
  // the arm: half a ring round the bottom of the head, from one pivot to the other
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.028, 12, 64, Math.PI), m.body);
  arm.rotation.z = Math.PI;
  arm.position.set(0, headY, -0.05);
  for (const x of [-0.56, 0.56]) {
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), m.accent);
    pivot.rotation.z = Math.PI / 2;
    pivot.position.set(x, headY, -0.05);
    g.add(pivot);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, headY - 0.56 - floorY - 0.08, 20), m.body);
  post.position.set(0, (headY - 0.56 + floorY + 0.08) / 2, -0.05);
  const base = new THREE.Mesh(lathe([[0.06, floorY + 0.1], [0.24, floorY + 0.09], [0.33, floorY + 0.06], [0.35, floorY + 0.02], [0.345, floorY]]), m.base);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.345, 48), m.baseRim);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = floorY;
  base.position.z = bottom.position.z = -0.05;
  g.add(arm, post, base, bottom);
  return g;
}

const STANDS = { pedestal: pedestalStand, table: tableStand, tableRound: tableRoundStand, wall: wallStand, yoke: yokeStand };

function createFrontFan(name, cfg) {
  const m = {
    wire: physical(cfg.colours.wire),
    rim: physical(cfg.colours.rim ?? cfg.colours.wire),
    blade: physical(cfg.colours.blade),
    hub: physical(cfg.colours.hub),
    body: physical(cfg.colours.body),
    base: physical(cfg.colours.base ?? cfg.colours.body),
    baseRim: physical(cfg.colours.baseRim ?? cfg.colours.body),
    accent: physical(cfg.colours.accent ?? cfg.colours.body),
    chrome: physical({ color: '#e8eaec', metalness: 1, roughness: 0.16 }),
  };
  if (!cfg.colours.accent) m.accent = m.body; // so stands can tell "no accent colour"
  const fan = new THREE.Group();
  fan.name = name;

  // ---- still parts: guards, motor housing, stand
  const stator = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = cfg.headY;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(cfg.motor, cfg.motor * 0.92, 0.2, 48), m.body);
  motor.rotation.x = Math.PI / 2;
  motor.position.z = -0.17;
  const motorBack = new THREE.Mesh(new THREE.SphereGeometry(cfg.motor * 0.92, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.body);
  motorBack.rotation.x = -Math.PI / 2;
  motorBack.position.z = -0.27;
  head.add(
    guard(m.wire, m.rim, { side: 1, depth: 0.1, offset: 0.07, ...cfg.guard }),
    guard(m.wire, m.rim, { side: -1, depth: 0.05, offset: 0.05, wires: 48, rings: [0.45, 0.75], inner: 0.15 }),
    motor, motorBack,
  );
  stator.add(head, STANDS[cfg.stand](m, { ...cfg, ...cfg.standOptions }));

  // ---- turning parts: blades and hub, about the fan's axis (pointed at the viewer, +z)
  const axis = new THREE.Group();
  axis.position.y = cfg.headY;
  axis.rotation.x = Math.PI / 2;
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  axis.add(rotor);
  const hr = cfg.hub.radius;
  const hub = new THREE.Mesh(cfg.hub.flat
    ? lathe([[0, hr * 0.45], [hr * 0.6, hr * 0.44], [hr * 0.92, hr * 0.38], [hr, hr * 0.26], [hr * 0.98, 0]])
    : lathe([[0, hr], [hr * 0.46, hr * 0.96], [hr * 0.8, hr * 0.77], [hr * 0.96, hr * 0.46], [hr, hr * 0.15], [hr * 0.92, 0]]), m.hub);
  rotor.add(hub);
  const bladeGeo = bladeGeometry({ shape: cfg.blades.shape, tip: cfg.blades.tip ?? 0.45, root: hr * 0.8, pitch: cfg.blades.pitch ?? 0.38 });
  const blades = [];
  for (let i = 0; i < cfg.blades.count; i++) {
    const pivot = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, m.blade);
    blade.position.y = 0.03;
    pivot.add(blade);
    pivot.userData.restAngle = (i * Math.PI * 2) / cfg.blades.count;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }
  const blurDisc = new THREE.Mesh(
    new THREE.RingGeometry(hr, 0.46, 72),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = 0.03;
  axis.add(blurDisc);
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.MeshBasicMaterial({ visible: false }));
  hitArea.position.y = cfg.headY;

  fan.add(stator, axis, hitArea);
  return {
    fan, rotor, stator, blades, blurDisc, hitArea,
    setFinish() {}, // one finish each
    // seen from just above eye level, the whole fan in view
    viewerPose: { elevation: 0.1, azimuth: 0.45, screenX: 0.5, screenY: 0.5, fill: 0.9, zoom: cfg.zoom },
    shadows(on) { fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

const withShadows = (model, shadows) => { model.shadows(shadows); return model; };

// Dark wire, dark body: the high-speed pedestal fans.
const HIGH_SPEED = {
  wire: { color: '#3a3b3e', metalness: 0.7, roughness: 0.35 },
  blade: { color: '#3d3f43', metalness: 0.2, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.25 },
  hub: { color: '#2f3033', metalness: 0.35, roughness: 0.38, clearcoat: 0.6 },
  body: { color: '#2f3033', metalness: 0.35, roughness: 0.4, clearcoat: 0.5 },
  base: { color: '#55575b', metalness: 0.3, roughness: 0.42, clearcoat: 0.4 },
  baseRim: { color: '#1b1c1e', metalness: 0.2, roughness: 0.5 },
};

export const createSultan = ({ shadows = false } = {}) => withShadows(createFrontFan('sultan', {
  stand: 'pedestal', headY: 0.6, floorY: -1.1, motor: 0.13, zoom: 0.82,
  guard: { rings: [0.18, 0.31, 0.55, 0.85] },
  hub: { radius: 0.13 },
  blades: { count: 3, shape: 'scimitar' },
  colours: HIGH_SPEED,
}), shadows);

export const createHexa = ({ shadows = false } = {}) => withShadows(createFrontFan('hexa', {
  stand: 'pedestal', headY: 0.6, floorY: -1.1, motor: 0.13, zoom: 0.82,
  guard: { rings: [0.3, 0.6, 0.85], wires: 72 },
  hub: { radius: 0.12 },
  blades: { count: 5, shape: 'paddle', tip: 0.44, pitch: 0.42 },
  colours: HIGH_SPEED,
}), shadows);

export const createVistara = ({ shadows = false } = {}) => withShadows(createFrontFan('vistara', {
  stand: 'table', headY: 0.2, floorY: -0.72, motor: 0.12, zoom: 1.05,
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.165, flat: true },
  blades: { count: 5, shape: 'scimitar', tip: 0.44, pitch: 0.36 },
  colours: {
    wire: { color: '#d9d2bf', metalness: 0.5, roughness: 0.35 },
    rim: { color: '#2bb3b1', metalness: 0.2, roughness: 0.35, clearcoat: 0.6 },
    blade: { color: '#3fd2cf', roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.92 },
    hub: { color: '#eeead8', roughness: 0.32, clearcoat: 0.7 },
    body: { color: '#e9e5d3', roughness: 0.35, clearcoat: 0.6 },
    accent: { color: '#2bb3b1', roughness: 0.3, clearcoat: 0.8 },
  },
}), shadows);

export const createVento = ({ shadows = false } = {}) => withShadows(createFrontFan('vento', {
  stand: 'wall', headY: 0.35, floorY: -0.55, motor: 0.13, zoom: 1.05,
  guard: { rings: [0.82], wires: 56 },
  hub: { radius: 0.2 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#2f3033', metalness: 0.6, roughness: 0.35 },
    blade: { color: '#8693a4', roughness: 0.34, clearcoat: 0.6, transparent: true, opacity: 0.95 }, // grey-blue, as in its photo
    hub: { color: '#1c1d1f', metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 },
    body: { color: '#1f2022', metalness: 0.3, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 },
    base: { color: '#3a3b3e', metalness: 0.3, roughness: 0.3, clearcoat: 0.9 },
  },
}), shadows);

// ---------------------------------------------------------------- second batch

const WHITE = { color: '#f2f2ef', roughness: 0.3, clearcoat: 0.7 };

export const createSpectra = ({ shadows = false } = {}) => withShadows(createFrontFan('spectra', {
  stand: 'wall', headY: 0.42, floorY: -0.7, motor: 0.12, zoom: 0.95,
  standOptions: { body: [0.25, 0.36], drop: 0.44, ring: true, cords: true },
  guard: { rings: [0.3, 0.6, 0.86], wires: 72 },
  hub: { radius: 0.15 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#e8e6e1', metalness: 0.35, roughness: 0.35 },
    blade: { ...WHITE, transparent: true, opacity: 0.93 },
    hub: { ...WHITE, clearcoat: 1, clearcoatRoughness: 0.08 },
    body: WHITE,
    base: { color: '#d9d9d6', roughness: 0.35 },
    accent: { color: '#9a9ea4', metalness: 0.3, roughness: 0.35 },
  },
}), shadows);

export const createWendy = ({ shadows = false } = {}) => withShadows(createFrontFan('wendy', {
  stand: 'wall', headY: 0.42, floorY: -0.7, motor: 0.12, zoom: 0.95,
  standOptions: { body: [0.23, 0.4], drop: 0.44, ring: true, cords: true },
  guard: { rings: [0.4, 0.86], wires: 64 },
  hub: { radius: 0.13 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#e6dccb', metalness: 0.35, roughness: 0.35 },
    blade: { ...WHITE, transparent: true, opacity: 0.93 },
    hub: { ...WHITE, clearcoat: 1, clearcoatRoughness: 0.08 },
    body: WHITE,
    base: { color: '#d9d9d6', roughness: 0.35 },
    accent: { color: '#1b1c1e', roughness: 0.25, clearcoat: 0.9 },
  },
}), shadows);

export const createGlider = ({ shadows = false } = {}) => withShadows(createFrontFan('glider', {
  stand: 'tableRound', headY: 0.2, floorY: -0.72, motor: 0.13, zoom: 1.05,
  standOptions: { knobs: 1 },
  guard: { rings: [0.32, 0.62, 0.86], wires: 72 },
  hub: { radius: 0.17 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#1f2022', metalness: 0.6, roughness: 0.32 },
    blade: { color: '#b9bec5', roughness: 0.3, clearcoat: 0.7, transparent: true, opacity: 0.88 },
    hub: { color: '#141516', metalness: 0.3, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 },
    body: { color: '#151618', metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 },
    accent: { color: '#9a9ea4', metalness: 0.4, roughness: 0.35 },
  },
}), shadows);

export const createSpider = ({ shadows = false } = {}) => withShadows(createFrontFan('spider', {
  stand: 'tableRound', headY: 0.2, floorY: -0.72, motor: 0.13, zoom: 1.05,
  standOptions: { knobs: 3 },
  guard: { rings: [0.32, 0.62, 0.86], wires: 72 },
  hub: { radius: 0.16 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#2a2b2e', metalness: 0.6, roughness: 0.32 },
    blade: { color: '#8a8f96', roughness: 0.32, clearcoat: 0.6, transparent: true, opacity: 0.92 },
    hub: { color: '#3a3c40', metalness: 0.35, roughness: 0.3, clearcoat: 0.8 },
    body: { color: '#1d1e20', metalness: 0.3, roughness: 0.28, clearcoat: 0.9 },
    accent: { color: '#3a3c40', metalness: 0.35, roughness: 0.3 },
  },
}), shadows);

export const createFiona = ({ shadows = false } = {}) => withShadows(createFrontFan('fiona', {
  stand: 'pedestal', headY: 0.6, floorY: -1.1, motor: 0.12, zoom: 0.82,
  standOptions: { panel: true },
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#e4e1da', metalness: 0.35, roughness: 0.35 },
    blade: { ...WHITE, transparent: true, opacity: 0.93 },
    hub: { ...WHITE, clearcoat: 1, clearcoatRoughness: 0.08 },
    body: { color: '#ecebe7', roughness: 0.3, clearcoat: 0.6 },
    base: { color: '#f0efeb', roughness: 0.3, clearcoat: 0.6 },
    baseRim: { color: '#dcdbd7', roughness: 0.35 },
    accent: { color: '#b9bcc1', metalness: 0.2, roughness: 0.3, clearcoat: 0.6 },
  },
}), shadows);

export const createNexa = ({ shadows = false } = {}) => withShadows(createFrontFan('nexa', {
  stand: 'pedestal', headY: 0.6, floorY: -1.1, motor: 0.13, zoom: 0.82,
  guard: { rings: [0.3, 0.86], wires: 64 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'paddle', tip: 0.45, pitch: 0.4 },
  colours: HIGH_SPEED,
}), shadows);

// ---------------------------------------------------------------- third batch

const CREAM_WIRE = { color: '#e4dccb', metalness: 0.35, roughness: 0.35 };
const COPPER_RIM = { color: '#b8653f', metalness: 0.8, roughness: 0.3 };
const SOFT = (color, extra = {}) => ({ color, roughness: 0.32, clearcoat: 0.7, ...extra });
const BLADE = (color, opacity = 0.92) => ({ color, roughness: 0.3, clearcoat: 0.7, transparent: true, opacity });
const DARK_BODY = { color: '#1d1e20', metalness: 0.3, roughness: 0.28, clearcoat: 0.9 };

const make = (name, cfg) => ({ shadows = false } = {}) => withShadows(createFrontFan(name, cfg), shadows);
const WALL = { stand: 'wall', headY: 0.36, floorY: -0.6, motor: 0.12, zoom: 1.05 };
const WALL_LOW = { stand: 'wall', headY: 0.42, floorY: -0.7, motor: 0.12, zoom: 0.95 };
const TABLE = { stand: 'table', headY: 0.2, floorY: -0.72, motor: 0.12, zoom: 1.05 };
const PEDESTAL = { stand: 'pedestal', headY: 0.6, floorY: -1.1, motor: 0.13, zoom: 0.82 };
const BROAD3 = { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 };

export const createTornado = make('tornado', {
  ...WALL, standOptions: { body: [0.28, 0.62], cords: true },
  guard: { rings: [0.35, 0.65, 0.86], wires: 72 },
  hub: { radius: 0.15 },
  blades: BROAD3,
  colours: {
    wire: { color: '#c9ccd0', metalness: 0.6, roughness: 0.3 },
    blade: BLADE('#a7adb5', 0.9),
    hub: { color: '#c6cace', metalness: 0.9, roughness: 0.2 },
    body: { color: '#4a4c50', metalness: 0.35, roughness: 0.3, clearcoat: 0.8 },
    base: { color: '#2e2f32', roughness: 0.35 },
  },
});

export const createJazz = make('jazz', {
  ...WALL_LOW, standOptions: { body: [0.2, 0.42], drop: 0.44, knob: true, cords: true },
  guard: { rings: [0.4, 0.86], wires: 64 },
  hub: { radius: 0.15 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim: COPPER_RIM, blade: BLADE('#d9773a', 0.95), hub: SOFT('#e0813f'), body: DARK_BODY, base: { color: '#2e2f32' }, accent: SOFT('#e0813f') },
});

export const createVelora = make('velora', {
  ...WALL_LOW, standOptions: { body: [0.2, 0.34], drop: 0.44, knob: true, cords: true },
  guard: { rings: [0.4, 0.86], wires: 64 },
  hub: { radius: 0.15 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim: COPPER_RIM, blade: BLADE('#b5682f', 0.95), hub: SOFT('#e0813f'), body: DARK_BODY, base: { color: '#2e2f32' }, accent: SOFT('#e0813f') },
});

export const createVectra = make('vectra', {
  ...TABLE,
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.15, flat: true },
  blades: BROAD3,
  colours: {
    wire: CREAM_WIRE, rim: SOFT('#4fb6e6'),
    blade: BLADE('#6cc3ef', 0.9), hub: SOFT('#8fd3f4'),
    body: SOFT('#eeeeea'), base: SOFT('#5fbde9'), accent: SOFT('#f2f2ef'),
  },
});

export const createBlazo = make('blazo', {
  ...TABLE,
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.14 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim: COPPER_RIM, blade: BLADE('#d9826c', 0.93), hub: SOFT('#d9826c'), body: SOFT('#eeeeea'), base: SOFT('#c8613a'), accent: SOFT('#f2f2ef') },
});

export const createBlitz = make('blitz', {
  ...TABLE,
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.15 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim: COPPER_RIM, blade: BLADE('#c8705a', 0.95), hub: SOFT('#c8705a'), body: SOFT('#eeeeea'), base: SOFT('#b85a36'), accent: SOFT('#f2f2ef') },
});

const GOAIR = {
  ...TABLE,
  guard: { rings: [0.3, 0.6, 0.86], wires: 80 },
  hub: { radius: 0.15 },
  blades: { count: 5, shape: 'scimitar', tip: 0.44, pitch: 0.34 },
  colours: {
    wire: { color: '#e7e8ea', metalness: 0.4, roughness: 0.35 },
    blade: BLADE('#eef0f2', 0.9), hub: { color: '#55585d', metalness: 0.3, roughness: 0.3, clearcoat: 0.6 },
    body: SOFT('#eceef0'), base: SOFT('#e4e6e8'), accent: { color: '#2a2b2e', roughness: 0.3 },
  },
};
export const createGoair12 = make('goair-12', GOAIR);
export const createGoair16 = make('goair-16', GOAIR);

const AP_WHITE = (rim) => ({
  ...TABLE,
  guard: { rings: [0.35, 0.62, 0.86], wires: 56 },
  hub: { radius: 0.14 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim, blade: BLADE('#f2f2ef', 0.93), hub: SOFT('#f4f4f2'), body: SOFT('#eeeeea'), base: SOFT('#eeeeea'), accent: SOFT('#1f8fc7') },
});
export const createJawa = make('jawa', AP_WHITE(SOFT('#2a8fb8')));
export const createRegal = make('regal', { ...AP_WHITE(SOFT('#7cc7d6')), colours: { ...AP_WHITE().colours, wire: { color: '#9fd3df', metalness: 0.3, roughness: 0.35, transparent: true, opacity: 0.85 }, rim: SOFT('#7cc7d6') } });

export const createSafari = make('safari', {
  ...TABLE,
  guard: { rings: [0.35, 0.62, 0.86], wires: 40 },
  hub: { radius: 0.12 },
  blades: BROAD3,
  colours: {
    wire: { color: '#2f3a40', metalness: 0.4, roughness: 0.35 },
    blade: BLADE('#4a565d', 0.95), hub: { color: '#3a464c', roughness: 0.3, clearcoat: 0.6 },
    body: { color: '#2b3237', metalness: 0.3, roughness: 0.3, clearcoat: 0.7 }, base: { color: '#2b3237', roughness: 0.3, clearcoat: 0.7 },
    accent: { color: '#5d676d', roughness: 0.3 },
  },
});

const PIANO = (dark) => ({
  stand: 'yoke', headY: 0.22, floorY: -0.62, motor: 0.13, zoom: 1.0,
  guard: { rings: [0.32, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.18, flat: true },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: dark
    ? { wire: { color: '#1f2022', metalness: 0.6, roughness: 0.32 }, blade: BLADE('#c9cdd2', 0.9), hub: { color: '#2a2b2e', metalness: 0.3, roughness: 0.3, clearcoat: 0.8 }, body: DARK_BODY, base: DARK_BODY, baseRim: { color: '#111' }, accent: { color: '#3a3b3e' } }
    : { wire: { color: '#ecedee', metalness: 0.4, roughness: 0.35 }, blade: BLADE('#f2f3f4', 0.92), hub: SOFT('#f4f5f6'), body: SOFT('#eeeff0'), base: SOFT('#f2f3f4'), baseRim: { color: '#222' }, accent: SOFT('#d5d7da') },
});
export const createPianoBlack = make('piano-black', PIANO(true));
export const createPianoWhite = make('piano-white', PIANO(false));

export const createStallion = make('stallion', {
  ...PEDESTAL, motor: 0.12,
  guard: { rings: [0.35, 0.62, 0.86], wires: 64 },
  hub: { radius: 0.13 },
  blades: BROAD3,
  colours: { wire: CREAM_WIRE, rim: COPPER_RIM, blade: BLADE('#e08a3c', 0.95), hub: SOFT('#e08a3c'), body: DARK_BODY, base: DARK_BODY, baseRim: { color: '#111' }, accent: SOFT('#e08a3c') },
});

const BULLET_DARK = { ...HIGH_SPEED, accent: { color: '#2a2b2e', roughness: 0.35 } };
export const createBullet12 = make('bullet-12', {
  ...PEDESTAL, standOptions: {},
  guard: { rings: [0.3, 0.6, 0.86], wires: 64 },
  hub: { radius: 0.13 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: HIGH_SPEED,
});
export const createBullet16 = make('bullet-16', {
  ...PEDESTAL, standOptions: { chromeUpper: true },
  guard: { rings: [0.3, 0.6, 0.86], wires: 64 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: BULLET_DARK,
});
export const createBulletOsc16 = make('bullet-osc-16', {
  ...PEDESTAL, standOptions: { chromeUpper: true },
  guard: { rings: [0.3, 0.6, 0.86], wires: 64 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.36 },
  colours: { ...BULLET_DARK, blade: BLADE('#9aa1a9', 0.88), base: { color: '#1f2022', roughness: 0.35 }, baseRim: { color: '#111' } },
});
export const createOrnet = make('ornet', {
  ...PEDESTAL, standOptions: { chromeUpper: true },
  guard: { rings: [0.35, 0.65, 0.86], wires: 60 },
  hub: { radius: 0.13, flat: true },
  blades: { count: 4, shape: 'broad', tip: 0.43, pitch: 0.36 },
  colours: {
    wire: { color: '#c5c8cc', metalness: 0.6, roughness: 0.3 }, rim: { color: '#d4d6d9', metalness: 0.5, roughness: 0.3 },
    blade: BLADE('#5c6066', 0.95), hub: { color: '#4b4e53', roughness: 0.3, clearcoat: 0.7 },
    body: { color: '#3d3f43', metalness: 0.3, roughness: 0.35, clearcoat: 0.6 }, base: { color: '#5b5e63', roughness: 0.35, clearcoat: 0.5 }, baseRim: { color: '#2a2b2e' },
    accent: { color: '#2a2b2e', roughness: 0.35 },
  },
});
export const createShine = make('shine', {
  ...PEDESTAL,
  guard: { rings: [0.3, 0.6, 0.86], wires: 72 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: { ...HIGH_SPEED, blade: BLADE('#5a5e64', 0.95) },
});
export const createChampion = make('champion', {
  ...PEDESTAL,
  guard: { rings: [0.3, 0.6, 0.86], wires: 64 },
  hub: { radius: 0.14 },
  blades: { count: 3, shape: 'paddle', tip: 0.46, pitch: 0.42 },
  colours: { ...HIGH_SPEED, blade: { color: '#1f2022', metalness: 0.2, roughness: 0.4, clearcoat: 0.5 } },
});
export const createIndus = make('indus', {
  ...PEDESTAL,
  guard: { rings: [0.3, 0.6, 0.86], wires: 48 },
  hub: { radius: 0.11 },
  blades: { count: 2, shape: 'scimitar', tip: 0.46, pitch: 0.4 },
  colours: { ...HIGH_SPEED, hub: { color: '#c6cace', metalness: 0.9, roughness: 0.22 } },
});

// ---------------------------------------------------------------- exhaust and ventilation fans
// FRESH AIR FAN HIGH SPEED 9"/12" (catalogue, ventilation pages): dark metal square frame with a round opening and
// a wire grille, three metal blades, the motor carried at the back on four struts, with a copper band.
// VENTILATION FAN 6"/8"/10" (one shared catalogue picture): white plastic square frame with a round opening and
// five curved white blades.

function squareFrame(size, hole, depth, radius, material) {
  const h = size / 2, r = radius;
  const s = new THREE.Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const opening = new THREE.Path();
  opening.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(opening);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 48 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function wallFan(name, { frame, hole, blades, hub, grille, struts, colours }) {
  const m = {
    frame: physical(colours.frame), blade: physical(colours.blade), hub: physical(colours.hub),
    wire: physical(colours.wire ?? colours.frame), motor: physical(colours.motor ?? colours.frame),
    copper: physical({ color: '#b8653f', metalness: 1, roughness: 0.28 }),
    dark: physical({ color: '#151516', roughness: 0.6 }),
  };
  const fan = new THREE.Group();
  fan.name = name;
  const stator = new THREE.Group();
  stator.add(squareFrame(frame, hole, 0.06, 0.12, m.frame));
  // a short round shroud behind the opening
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(hole, hole, 0.12, 64, 1, true), m.frame);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.z = -0.07;
  stator.add(shroud);
  if (grille) {
    // front wire grille: rings and radial wires across the opening, bolts in the corners
    for (const f of [0.3, 0.55, 0.8, 0.98]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(hole * f, 0.0045, 6, 72), m.wire);
      ring.position.z = 0.045;
      stator.add(ring);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, hole * 0.72, 4), m.wire);
      wire.position.set(Math.cos(a) * hole * 0.62, Math.sin(a) * hole * 0.62, 0.045);
      wire.rotation.z = a - Math.PI / 2;
      stator.add(wire);
    }
    for (const [x, y] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), m.wire);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x * frame * 0.4, y * frame * 0.4, 0.04);
      stator.add(bolt);
    }
  }
  if (struts) {
    // the motor on four struts at the back, with a copper band and a vented end cap
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 40), m.motor);
    motor.rotation.x = Math.PI / 2;
    motor.position.z = -0.36;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 40), m.copper);
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.25;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), m.motor);
    cap.rotation.y = Math.PI;
    cap.position.z = -0.51;
    stator.add(motor, band, cap);
    for (let i = 0; i < 8; i++) {
      const vent = new THREE.Mesh(new THREE.CircleGeometry(0.013, 10), m.dark);
      vent.rotation.y = Math.PI;
      vent.position.set(Math.cos((i / 8) * Math.PI * 2) * 0.1, Math.sin((i / 8) * Math.PI * 2) * 0.1, -0.512);
      stator.add(vent);
    }
    for (const [x, y] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const from = new THREE.Vector3(x * frame * 0.36, y * frame * 0.36, -0.02);
      const to = new THREE.Vector3(x * 0.1, y * 0.1, -0.25);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, from.distanceTo(to), 8), m.frame);
      strut.position.copy(from).add(to).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      stator.add(strut);
    }
  } else {
    // a shallow motor housing behind the plastic fans
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 40), m.frame);
    housing.rotation.x = Math.PI / 2;
    housing.position.z = -0.18;
    stator.add(housing);
  }

  const axis = new THREE.Group();
  axis.rotation.x = Math.PI / 2; // the rotor's y axis points out of the front (+z)
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  axis.add(rotor);
  const hr = hub;
  rotor.add(new THREE.Mesh(lathe([[0, hr * 0.7], [hr * 0.5, hr * 0.66], [hr * 0.85, hr * 0.5], [hr, hr * 0.2], [hr * 0.96, -0.02]]), m.hub));
  const bladeGeo = bladeGeometry({ shape: blades.shape, tip: hole * 0.95, root: hr * 0.7, pitch: blades.pitch });
  const list = [];
  for (let i = 0; i < blades.count; i++) {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(bladeGeo, m.blade));
    pivot.userData.restAngle = (i * Math.PI * 2) / blades.count;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    list.push(pivot);
  }
  const blurDisc = new THREE.Mesh(
    new THREE.RingGeometry(hr, hole * 0.95, 64),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  blurDisc.rotation.x = -Math.PI / 2;
  axis.add(blurDisc);
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(hole, 32), new THREE.MeshBasicMaterial({ visible: false }));
  fan.add(stator, axis, hitArea);
  return {
    fan, rotor, stator, blades: list, blurDisc, hitArea, setFinish() {},
    viewerPose: { elevation: 0.05, azimuth: 0.35, screenX: 0.5, screenY: 0.5, fill: 0.95, zoom: 1.15 },
    shadows(on) { fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

const FRESH_AIR = {
  frame: 1.0, hole: 0.42, hub: 0.11, grille: true, struts: true,
  blades: { count: 3, shape: 'broad', pitch: 0.42 },
  colours: {
    frame: { color: '#4f4640', metalness: 0.55, roughness: 0.4 },
    blade: { color: '#57504a', metalness: 0.45, roughness: 0.45 },
    hub: { color: '#1b1b1c', roughness: 0.3, clearcoat: 0.8 },
    wire: { color: '#9aa0a6', metalness: 0.8, roughness: 0.3 },
    motor: { color: '#6d6f73', metalness: 0.6, roughness: 0.35 },
  },
};
export const createFreshAir9 = ({ shadows = false } = {}) => withShadows(wallFan('fresh-air-9', FRESH_AIR), shadows);
export const createFreshAir12 = ({ shadows = false } = {}) => withShadows(wallFan('fresh-air-12', FRESH_AIR), shadows);

const VENTILATION = {
  frame: 1.0, hole: 0.4, hub: 0.12, grille: false, struts: false,
  blades: { count: 5, shape: 'scimitar', pitch: 0.4 },
  colours: {
    frame: { color: '#f3f2ee', roughness: 0.32, clearcoat: 0.6 },
    blade: { color: '#f6f5f2', roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.95 },
    hub: { color: '#f6f5f2', roughness: 0.28, clearcoat: 0.8 },
  },
};
export const createVentilation = ({ shadows = false } = {}) => withShadows(wallFan('ventilation', VENTILATION), shadows);
