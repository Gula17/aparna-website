// Aparna kitchen, heating and ironing appliances, built procedurally in three.js. Each product is a set of
// choices read off its own Catalogue 2026 picture:
//   G-COIL HOT PLATES  square body in steel, nickel or powder coat (grey, white or black), a chrome dish with a
//                      black spiral coil, a knob and a red nameplate; Magnum has a steel top on a black frame,
//                      Rustam a wire pan stand
//   INFRARED COOKTOPS  black glass top with a printed ring and touch panel; Prince has a grill grid
//   FAN HEATERS        box body with a front grille and knobs; the inner fan turns (the scene spins it)
//   QUARTZ (Sigma) and SUN HEATER (14"), IMMERSION RODS, INSTANT WATER HEATERS (Croma, Croma2), KETTLE ELEMENT
// The kitchen and heating models follow the Aparna studio photos (src/content/studio-photos.json).
// (The dry irons and the Cabin Fan 12" are in src/three/small-appliances.js, with the cooler motors and pumps.)
// Only fan heaters have a turning part; for the rest the rotor is empty. Sides the pictures don't show follow
// the visible side.

import * as THREE from 'three';
import { lathe, makeBlurTexture } from './aeroflow-model.js';

const mat = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.4, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};
const FINISH = {
  steel: { color: '#c7cace', metalness: 0.95, roughness: 0.26 },
  nickel: { color: '#e3e5e8', metalness: 1, roughness: 0.14 },
  powder: { color: '#77797d', metalness: 0.25, roughness: 0.65 },
  'powder-dark': { color: '#55575b', metalness: 0.25, roughness: 0.62 },
  white: { color: '#efeeea', roughness: 0.45 },
  black: { color: '#1e1f22', metalness: 0.2, roughness: 0.4, clearcoat: 0.4 },
  charcoal: { color: '#3a3c40', metalness: 0.5, roughness: 0.35 },
  'grey-steel': { color: '#8e9196', metalness: 0.75, roughness: 0.32 },
  'black-glass': { color: '#101114', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 },
  'steel-white': { color: '#e4e5e6', metalness: 0.55, roughness: 0.3 },
  chrome: { color: '#eceef0', metalness: 1, roughness: 0.12 },
};

// What lights up when the 360° view's Start button is pressed (src/three/power.js).
const HOT_COIL = { kind: 'heat', emissive: '#ff3c0a', intensity: 1.5, color: '#ff8a4a' };
const LAMP = { kind: 'lamp' };
// A glowing heating ring seen through a cooktop's glass: concentric red-orange rings, faded at the edge.
let ringGlowTexture = null;
function heatRing(cx, cz, rx, rz, y) {
  if (!ringGlowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,90,20,0.55)'); g.addColorStop(0.75, 'rgba(255,60,10,0.85)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,200,120,0.9)';
    for (let i = 1; i <= 7; i++) { x.lineWidth = 5; x.beginPath(); x.arc(128, 128, i * 16, 0, Math.PI * 2); x.stroke(); }
    ringGlowTexture = new THREE.CanvasTexture(c);
    ringGlowTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: ringGlowTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.set(cx, y, cz);
  m.userData.power = { kind: 'glow', opacity: 1 };
  return m;
}

// rounded rectangle footprint w x d, extruded h high, sitting on y = 0
function slab(w, d, h, r, material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const bevel = Math.min(0.03, h / 3);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return new THREE.Mesh(geo, material);
}
// rounded box standing upright (front = +z), centred
function box(w, h, d, r, material) {
  const m = slab(w, h, d, r, material);
  m.geometry.rotateX(Math.PI / 2);
  m.geometry.translate(0, 0, -d / 2);
  return m;
}

function spiral(rIn, rOut, turns, y, tube, material) {
  const pts = [];
  for (let i = 0; i <= turns * 48; i++) {
    const t = i / (turns * 48), a = t * turns * Math.PI * 2, r = rIn + (rOut - rIn) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 48, tube, 6), material);
}

function knob(material, x, y, z, r = 0.07) {
  const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.06, 28), material);
  k.rotation.x = Math.PI / 2;
  k.position.set(x, y, z);
  return k;
}

// Shared shell: what the scene needs (a turning rotor, the still parts, an invisible blur disc and hit area).
function shell(name, stator, { rotor = new THREE.Group(), axis = null, pose = {} } = {}) {
  const fan = new THREE.Group();
  fan.name = name;
  rotor.name = 'rotor';
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.02, 8), new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, visible: false }));
  const hitArea = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
  fan.add(stator, axis ?? rotor, blurDisc, hitArea);
  return {
    fan, rotor, stator, blades: [], blurDisc, hitArea, setFinish() {},
    viewerPose: { elevation: 0.42, azimuth: 0.55, screenX: 0.5, screenY: 0.5, fill: 0.9, zoom: 1.1, ...pose },
    shadows(on) { fan.traverse((o) => { if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

// ---------------------------------------------------------------- G-coil hot plates
// hammertone powder coat: a fine light/dark speckle over grey, tiled over the body
function hammerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#626468';
  x.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4200; i++) {
    const v = Math.round(55 + rnd() * 150);
    x.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 1.4, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}
// the faint floral print on the dark tops of Comfort and Smart (transparent, laid over the top)
function floralTexture(tone) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.strokeStyle = tone === 'dark' ? 'rgba(45,47,52,0.6)' : 'rgba(200,202,206,0.55)';
  x.lineWidth = 3;
  const sprig = (px, py, s, rot) => {
    x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s);
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(30, -20, 60, -10, 90, -40); x.stroke();
    for (let i = 0; i < 4; i++) {
      x.beginPath(); x.ellipse(20 + i * 22, -10 - i * 8, 14, 6, -0.6, 0, Math.PI * 2); x.stroke();
    }
    x.restore();
  };
  sprig(30, 120, 1, 0.2); sprig(390, 110, 0.9, 2.6); sprig(40, 470, 1, -0.4); sprig(400, 460, 1.1, 3.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Two body shapes, as in the pictures:
//   box     a squared case with a flat top, on four black feet (or sitting flat, feet: false)
//   pressed a rounded, drawn-steel body that slopes up from a wide flat flange; no feet show
function hotplate(name, { finish, frame, stand = false, tall = false, shape = 'box', feet = true, print = false, slots = false, size = 1 }) {
  const g = new THREE.Group();
  const spec = (k) => (k === 'hammer' ? { color: '#ffffff', map: hammerTexture(), metalness: 0.45, roughness: 0.5 } : FINISH[k]);
  const body = mat(spec(frame ?? finish));
  const top = mat(spec(finish));
  const chrome = mat(FINISH.chrome);
  const black = mat({ color: '#111214', roughness: 0.5 });
  const coilMat = mat({ color: '#85878b', metalness: 0.7, roughness: 0.32 });
  const ceramic = mat({ color: '#f1eee6', roughness: 0.55 });
  const pressed = shape === 'pressed';
  const W = 1.0, D = 0.95;
  const H = pressed ? 0.26 : tall ? 0.3 : 0.24;
  const y0 = feet ? -0.2 : -0.25;
  let yTop, front; // the top surface height, and how far the front face stands at knob height
  if (pressed) {
    const flange = slab(W + 0.16, D + 0.16, 0.035, 0.12, body);
    flange.position.y = y0 - 0.02;
    const shellMesh = taper(slab(W, D, H, 0.22, body), 0.16);
    shellMesh.position.y = y0;
    g.add(flange, shellMesh);
    yTop = y0 + H;
    front = (D / 2 + 0.021) * (1 - 0.16 * 0.42) + 0.008; // the slab's bevel stands 0.021 proud of its outline
    // the raised chrome ring the dish is pressed into
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.022, 10, 64), top);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-0.03, yTop - 0.005, -0.03);
    g.add(ring);
  } else {
    const base = slab(W, D, H, 0.06, body);
    base.position.y = y0;
    g.add(base);
    yTop = y0 + H;
    if (frame) { // a top panel in its own finish over the frame (Magnum, Ultima, Smart)
      const lid = slab(W - 0.04, D - 0.04, 0.03, 0.05, top);
      lid.position.y = yTop;
      g.add(lid);
      yTop += 0.03;
    }
    if (print) { // the printed pattern on the top panel
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, D - 0.08), new THREE.MeshBasicMaterial({ map: floralTexture(print), transparent: true, depthWrite: false }));
      p.rotation.x = -Math.PI / 2;
      p.position.y = yTop + 0.002;
      g.add(p);
    }
    if (slots) { // Crescent: a long pressed handle slot down each side of the top
      for (const sx of [-1, 1]) {
        const slot = slab(0.07, D * 0.7, 0.012, 0.03, mat({ color: '#9fa2a6', metalness: 0.9, roughness: 0.35 }));
        slot.position.set(sx * (W / 2 - 0.08), yTop - 0.004, -0.02);
        g.add(slot);
      }
    }
    front = D / 2 + 0.021 + 0.006;
  }
  // chrome dish, white ceramic ring, and the dark G-coil sitting proud on it
  const cx = -0.03, cz = -0.03;
  const dish = new THREE.Mesh(lathe([[0, yTop - 0.02], [0.33, yTop - 0.018], [0.37, yTop - 0.004], [0.39, yTop + 0.006]]), chrome);
  const bed = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.335, 64), ceramic);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = yTop - 0.012;
  const coil = spiral(0.06, 0.31, 5.5, yTop + 0.006, 0.018, coilMat);
  coil.userData.power = HOT_COIL; // glows red-hot when switched on
  const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), coilMat);
  terminal.position.y = yTop - 0.004;
  for (const part of [dish, bed, coil, terminal]) { part.position.x += cx; part.position.z += cz; g.add(part); }
  // the black knob at the front right, and the white oval nameplate with its red rim
  const ky = y0 + H * 0.45;
  const kx = pressed ? 0.33 : 0.36;
  g.add(knob(black, kx, ky, front + 0.025, 0.055));
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.085, 0.03), black); // the knob's grip ridge
  pointer.position.set(kx, ky, front + 0.06);
  g.add(pointer);
  const badgeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 32), mat({ color: '#c8232c', roughness: 0.35, clearcoat: 0.8 }));
  badgeRim.rotation.x = Math.PI / 2;
  badgeRim.scale.x = 2.0;
  badgeRim.position.set(-0.04, y0 + H * 0.4, front);
  const badge = badgeRim.clone();
  badge.material = mat({ color: '#f4f2ee', roughness: 0.35 });
  badge.scale.set(1.8, 0.8, 0.72);
  badge.position.z += 0.004;
  g.add(badgeRim, badge);
  // vent slots down both sides
  const slotMat = mat({ color: '#1a1b1d', roughness: 0.7 });
  const sx = pressed ? (W / 2) * (1 - 0.16 * 0.5) + 0.004 : W / 2 + 0.006;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, pressed ? 0.06 : 0.1, 0.03), slotMat);
      slot.position.set(side * sx, y0 + H * 0.45, -0.24 + i * 0.12);
      g.add(slot);
    }
  }
  if (feet) { // four short black feet showing below the body
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 16), black);
      foot.position.set(x * 0.38, y0 - 0.025, z * 0.35);
      g.add(foot);
    }
  }
  if (stand) { // Rustam: a square wire pan stand over the coil, on four bent legs
    const s = 0.36, h = yTop + 0.08;
    const loop = new THREE.CatmullRomCurve3([[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, z]) => new THREE.Vector3(cx + x, h, cz + z)), true, 'catmullrom', 0.05);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(loop, 64, 0.012, 8, true), chrome));
    for (const z of [-0.12, 0.12]) { // two bars across
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 2 * s, 6), chrome);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(cx, h, cz + z);
      g.add(bar);
    }
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 6), chrome);
      leg.position.set(cx + x * s, h - 0.045, cz + z * s);
      g.add(leg);
    }
  }
  g.scale.setScalar(size);
  // looking down on the front-left corner, as the photos do
  return shell(name, g, { pose: { elevation: 0.35, azimuth: -0.4, zoom: 1.5 } }); // 0.35: the viewer's highest view
}

// ---------------------------------------------------------------- infrared cooktops
function ringTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#0c0d0f';
  x.fillRect(0, 0, 512, 512);
  if (kind === 'swirl') { // Prime: a red sweep across the glass
    const gr = x.createLinearGradient(0, 300, 512, 420);
    gr.addColorStop(0, 'rgba(160,20,30,0)'); gr.addColorStop(0.5, 'rgba(190,30,40,0.9)'); gr.addColorStop(1, 'rgba(160,20,30,0)');
    x.fillStyle = gr;
    x.beginPath(); x.moveTo(0, 360); x.bezierCurveTo(170, 280, 340, 470, 512, 360); x.lineTo(512, 400); x.bezierCurveTo(340, 510, 170, 320, 0, 400); x.fill();
  }
  if (kind === 'grill') { // Prince: plain glass under the grill, a faint ring and the red logo at the back right
    x.strokeStyle = '#3a3c40';
    x.lineWidth = 3;
    x.beginPath(); x.arc(230, 270, 150, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#d3222b';
    x.font = 'bold italic 44px Arial';
    x.fillText('APARNA', 340, 70);
  } else {
    // Presto: two pale rings round a red centre mark; Prime: one grey ring through the red sweep
    x.strokeStyle = kind === 'swirl' ? '#8a8c90' : '#d6d7d9';
    x.lineWidth = 5;
    x.beginPath(); x.arc(200, 270, 160, 0, Math.PI * 2); x.stroke();
    if (kind === 'ring') { x.beginPath(); x.arc(200, 270, 112, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#c4262e';
    x.beginPath(); x.arc(200, 270, kind === 'ring' ? 20 : 8, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = kind === 'grill' ? '#c4262e' : '#d9dadc'; // touch buttons (Prince: one red switch)
  if (kind === 'grill') x.fillRect(440, 400, 30, 30);
  else for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(410 + (i % 2) * 45, 220 + Math.floor(i / 2) * 55, 12, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function cooktop(name, { print = 'ring', grill = false, frameFinish = 'steel' }) {
  const g = new THREE.Group();
  const frame = mat(frameFinish === 'abs' ? { color: '#17181a', roughness: 0.4 } : FINISH.steel);
  const base = slab(1.1, 0.7, 0.13, 0.05, frame);
  base.position.y = -0.12;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.64), new THREE.MeshPhysicalMaterial({ map: ringTexture(print), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }));
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.012;
  g.add(base, glass);
  // the heating ring under the glass, which glows through it when switched on
  const [cx, cz, rx, rz] = print === 'grill' ? [-0.051, 0.017, 0.293, 0.1875] : [-0.109, 0.017, 0.3125, 0.2];
  g.add(heatRing(cx, cz, rx, rz, 0.016));
  // one flat U-shaped carry handle standing out from the left side (chrome, or black on Prime)
  const handleMat = mat(frameFinish === 'abs' ? { color: '#151618', roughness: 0.35 } : FINISH.chrome);
  const path = new THREE.CatmullRomCurve3([[0.53, -0.2], [0.62, -0.18], [0.66, -0.08], [0.66, 0.08], [0.62, 0.18], [0.53, 0.2]]
    .map(([x, z]) => new THREE.Vector3(-x, -0.06, z)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.018, 8), handleMat));
  g.add(knob(mat({ color: '#d9dadc', metalness: 0.7, roughness: 0.3 }), 0.42, -0.06, 0.36, 0.035));
  if (grill) { // Prince: a grill grid over the top
    const bar = mat(FINISH.chrome);
    for (let i = 0; i < 13; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.6, 6), bar);
      b.rotation.x = Math.PI / 2;
      b.position.set(-0.45 + i * 0.075, 0.05, 0);
      g.add(b);
    }
    for (const z of [-0.28, 0, 0.28]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.95, 6), bar);
      b.rotation.z = Math.PI / 2;
      b.position.set(0, 0.05, z);
      g.add(b);
    }
  }
  return shell(name, g, { pose: { elevation: 0.35, azimuth: -0.3, zoom: 1.2 } }); // from the front left, handle side, as photographed
}

// ---------------------------------------------------------------- heaters
// the wide sides of the upright heaters: a field of round perforations, or tall moulded ribs (Silky)
function sideTexture(kind, bg, fg) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = fg;
  if (kind === 'ribs') for (let i = 0; i < 12; i++) x.fillRect(14 + i * 20, 8, 7, 240);
  else for (let r = 0; r < 14; r++) for (let k = 0; k < 14; k++) { x.beginPath(); x.arc(14 + k * 17.5, 14 + r * 17.5, 4.2, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Low models: a soft box, black slatted front, knobs at the top right and a warm-air vent on top (round, or
// a slatted panel on Pearl). Upright models: narrow at the front, deep at the side; the front grille sits in a
// coloured frame, the wide sides are perforated, the knobs stand on top.
function fanHeater(name, { w, h, d, body, front, frame, side, upright = false, knobs = 2, knobColour, vent = 'round' }) {
  const g = new THREE.Group();
  const bodyMat = mat(body);
  const frontMat = mat(front);
  g.add(box(w, h, d, upright ? 0.1 : 0.17, bodyMat)); // the low models are softly rounded all over
  const gw = upright ? w * 0.62 : w * 0.82, gh = upright ? h * 0.66 : h * 0.5;
  const gy = upright ? -h * 0.04 : -h * 0.14;
  let fz = d / 2;
  if (frame) { // the coloured front frame round the grille
    const f = box(w * 0.9, h * 0.88, 0.03, 0.06, mat(frame));
    f.position.set(0, -h * 0.02, d / 2);
    g.add(f);
    fz += 0.015;
  }
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat({ color: '#111214', roughness: 0.6 }));
  panel.userData.power = { kind: 'heat', emissive: '#ff4a12', intensity: 1.3, color: '#5a1a08' }; // the element glows behind the slats
  panel.position.set(0, gy, fz + 0.003);
  g.add(panel);
  const n = upright ? 14 : 7;
  for (let i = 0; i < n; i++) { // the front grille slats
    const slat = new THREE.Mesh(new THREE.BoxGeometry(gw, gh / n * 0.45, 0.02), frontMat);
    slat.position.set(0, gy - gh / 2 + (i + 0.5) * (gh / n), fz + 0.012);
    g.add(slat);
  }
  if (side) { // perforated (or ribbed) wide sides
    const tex = sideTexture(side.kind, side.bg, side.fg);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.72, h * 0.7), mat({ map: tex, roughness: 0.5 }));
      p.rotation.y = sx * Math.PI / 2;
      p.position.set(sx * (w / 2 + 0.004), -h * 0.04, -d * 0.04);
      g.add(p);
    }
  }
  // the control knobs on top (light grey with a pointer ridge, as pictured)
  const knobMat = mat(knobColour ?? { color: '#dcdcd8', roughness: 0.35, clearcoat: 0.5 });
  const ridgeMat = mat({ color: '#9a9b9d', roughness: 0.4 });
  for (let i = 0; i < knobs; i++) {
    const k = new THREE.Group();
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.05, 28), knobMat));
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.022), ridgeMat);
    ridge.position.y = 0.035;
    k.add(ridge);
    if (upright) k.position.set(0, h / 2 + 0.025, d * 0.12 - i * 0.2); // in a line, front to back
    else k.position.set(w * 0.26 + (i - (knobs - 1) / 2) * 0.19, h / 2 + 0.025, d * 0.05);
    g.add(k);
  }
  if (!upright && vent === 'round') { // a round warm-air grille on the top: rings over a dark disc
    const vx = -w * 0.1, r = Math.min(w, d) * 0.27;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat({ color: '#1a1b1d', roughness: 0.6 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(vx, h / 2 + 0.004, 0);
    g.add(disc);
    for (let i = 1; i <= 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (i / 5.3), 0.008, 6, 48), bodyMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(vx, h / 2 + 0.01, 0);
      g.add(ring);
    }
  } else if (!upright) { // Pearl: a slatted vent panel across the back of the top
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, d * 0.4), mat({ color: '#1a1b1d', roughness: 0.6 }));
    vent.rotation.x = -Math.PI / 2;
    vent.position.set(-w * 0.1, h / 2 + 0.004, -d * 0.12);
    g.add(vent);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.012, d * 0.4 / 6 * 0.45), bodyMat);
      bar.position.set(-w * 0.1, h / 2 + 0.01, -d * 0.32 + (i + 0.5) * (d * 0.4 / 6));
      g.add(bar);
    }
  }
  // feet: short pads under the low models, splayed legs under the upright ones
  for (const sx of [-1, 1]) {
    const foot = upright
      ? new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, d * 0.95), bodyMat)
      : new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, d * 0.7), bodyMat);
    foot.position.set(sx * w * (upright ? 0.36 : 0.36), -h / 2 - 0.02, 0);
    if (upright) foot.rotation.z = -sx * 0.25;
    g.add(foot);
  }
  // the inner fan, seen dimly behind the grille: it turns
  const axis = new THREE.Group();
  axis.position.set(0, gy, d / 2 - 0.08);
  axis.rotation.x = Math.PI / 2;
  const rotor = new THREE.Group();
  const bladeMat = mat({ color: '#3a3b3e', roughness: 0.4 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(Math.min(gw, gh) * 0.36, 0.006, 0.05), bladeMat);
    b.position.x = Math.min(gw, gh) * 0.2;
    const p = new THREE.Group();
    p.rotation.y = (i / 5) * Math.PI * 2;
    p.add(b);
    rotor.add(p);
  }
  axis.add(rotor);
  return shell(name, g, { rotor, axis, pose: { elevation: upright ? 0.2 : 0.45, azimuth: 0.5, zoom: 1.15 } });
}

function quartzHeater(name) {
  // Sigma (studio photo 117): a beige moulded frame with hand-hold cut-outs, a red control strip with a dial
  // along the foot, and two glowing quartz rods in front of a chrome reflector behind a wire guard
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const beige = mat({ color: '#e2cfa8', roughness: 0.45, clearcoat: 0.3 });
  const red = mat({ color: '#c9232b', roughness: 0.3, clearcoat: 0.8 });
  const hole = mat({ color: '#6e604a', roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const post = box(0.16, 1.02, 0.42, 0.05, beige);
    post.position.set(sx * 0.5, 0.02, 0);
    const grip = box(0.04, 0.16, 0.2, 0.02, hole); // the hand-hold cut-out near the top
    grip.position.set(sx * 0.58, 0.36, 0);
    const foot = box(0.24, 0.06, 0.5, 0.03, beige);
    foot.position.set(sx * 0.5, -0.5, 0);
    g.add(post, grip, foot);
  }
  const topBar = box(1.0, 0.08, 0.36, 0.03, mat({ color: '#f1efe9', roughness: 0.4 }));
  topBar.position.y = 0.48;
  const base = box(0.86, 0.22, 0.42, 0.04, beige);
  base.position.y = -0.36;
  const strip = box(0.8, 0.17, 0.03, 0.03, red);
  strip.position.set(0, -0.36, 0.215);
  const dial = knob(mat({ color: '#e8dcc0', roughness: 0.4 }), 0.12, -0.36, 0.25, 0.06);
  g.add(topBar, base, strip, dial, lamp('#ffb02e', -0.06, -0.36, 0.235));
  const reflector = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.7), chrome);
  reflector.position.set(0, 0.09, -0.12);
  g.add(reflector);
  for (const y of [0.24, -0.06]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.84, 14), mat({ color: '#e8ddd0', roughness: 0.25, transmission: 0 }));
    rod.userData.power = { kind: 'heat', emissive: '#ff6a1f', intensity: 1.2, color: '#ffb36b' };
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, y, 0.02);
    g.add(rod);
  }
  for (let i = 0; i < 15; i++) { // the front guard: upright wires and two cross wires
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.68, 6), chrome);
    wire.position.set(-0.4 + i * (0.8 / 14), 0.1, 0.16);
    g.add(wire);
  }
  for (const y of [0.09, -0.2]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.84, 6), chrome);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, 0.165);
    g.add(bar);
  }
  return shell(name, g, { pose: { elevation: 0.15, zoom: 1.0 } });
}

function sunHeater(name) {
  // 14" sun heater (studio photo 124): an ivory drum with a glowing orange bowl behind a ring-and-spoke guard
  // and a round centre badge, held in a crescent yoke on an oval foot
  const g = new THREE.Group();
  const chrome = mat({ color: '#d9d4c6', metalness: 0.8, roughness: 0.3 });
  const ivory = mat({ color: '#ece2cb', roughness: 0.4, clearcoat: 0.5 });
  const cy = 0.24;
  const drum = new THREE.Mesh(lathe([[0, -0.12], [0.22, -0.11], [0.36, -0.06], [0.42, 0.02], [0.43, 0.06]]), ivory);
  drum.rotation.x = Math.PI / 2;
  drum.position.y = cy;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.39, 48), mat({ color: '#c9b08a', metalness: 0.6, roughness: 0.3 }));
  glow.userData.power = { kind: 'heat', emissive: '#ff7a1c', intensity: 1.0, color: '#ffb35a' };
  glow.position.set(0, cy, -0.04);
  g.add(drum, glow);
  for (let i = 1; i <= 6; i++) { // guard rings
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 + i * 0.053, 0.004, 5, 64), chrome);
    ring.position.set(0, cy, 0.06);
    g.add(ring);
  }
  for (let i = 0; i < 24; i++) { // and spokes
    const a = (i / 24) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.32, 4), chrome);
    wire.position.set(Math.cos(a) * 0.26, cy + Math.sin(a) * 0.26, 0.06);
    wire.rotation.z = a - Math.PI / 2;
    g.add(wire);
  }
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 40), ivory);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, cy, 0.08);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.02, 10, 64), ivory);
  rim.position.set(0, cy, 0.06);
  // the yoke: a broad crescent under the drum, its tips reaching up past the drum's middle
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 12, 64, Math.PI + 0.9), ivory);
  yoke.rotation.z = Math.PI - 0.45;
  yoke.scale.z = 1.8;
  yoke.position.set(0, cy, -0.04);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 24), ivory);
  neck.position.set(0, cy - 0.58, -0.04);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 32), mat({ color: '#7b5a44', roughness: 0.4 }));
  band.rotation.x = Math.PI / 2;
  band.position.set(0, cy - 0.6, -0.04);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.08, 48), ivory);
  foot.scale.z = 0.62;
  foot.position.set(0, cy - 0.69, -0.04);
  g.add(badge, rim, yoke, neck, band, foot);
  return shell(name, g, { pose: { elevation: 0.12, zoom: 1.05 } });
}

// ---------------------------------------------------------------- water heating
// Pearl immersion rods, as in their studio photos: 1500 W and 2000 W have a lime-green box handle over a clear
// collar (141); 1000 W a black bell-shaped handle over a steel sleeve with a printed label (142)
function immersionRod(name, { handle = 'lime' } = {}) {
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const cordMat = mat({ color: '#111', roughness: 0.6 });
  let top; // where the two rods leave the handle
  if (handle === 'lime') {
    const body = box(0.3, 0.38, 0.17, 0.06, mat({ color: '#c6dc2c', roughness: 0.3, clearcoat: 0.7 }));
    body.position.y = 0.78;
    const band = box(0.31, 0.05, 0.18, 0.02, mat({ color: '#2a2b2d', roughness: 0.45 }));
    band.position.y = 0.58;
    const collar = box(0.2, 0.14, 0.12, 0.03, new THREE.MeshPhysicalMaterial({ color: '#dfe6ea', roughness: 0.1, transparent: true, opacity: 0.45 }));
    collar.position.y = 0.48;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), cordMat);
    cord.position.set(-0.08, 1.02, 0);
    cord.rotation.z = 0.5;
    g.add(body, band, collar, cord);
    top = 0.42;
  } else {
    const bell = new THREE.Mesh(lathe([[0, 1.04], [0.06, 1.03], [0.11, 0.96], [0.135, 0.82], [0.14, 0.72], [0.095, 0.68], [0.07, 0.67]]), mat({ color: '#1f2022', roughness: 0.35, clearcoat: 0.6 }));
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.38, 24), mat({ color: '#e2e3e4', metalness: 0.7, roughness: 0.3 }));
    sleeve.position.y = 0.48;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.24, 24, 1, true, -0.9, 1.8), mat({ color: '#f5f3ee', roughness: 0.5 }));
    label.position.y = 0.5;
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 1.02], [0, 1.1], [0.04, 1.18], [0.1, 1.22]].map(([x, y]) => new THREE.Vector3(x, y, 0))), 12, 0.022, 8), cordMat);
    g.add(bell, sleeve, label, cord);
    top = 0.3;
  }
  // the heating element is one tube: down the left rod, bending out into the coil, four turns down, then back
  // up through the middle of the coil and the right rod (the way a real immersion rod is made)
  const s = 0.045, pts = [];
  for (let y = top; y > -0.05; y -= 0.06) pts.push(new THREE.Vector3(-s, y, 0));
  pts.push(new THREE.Vector3(-0.07, -0.1, 0), new THREE.Vector3(-0.11, -0.15, 0));
  for (let i = 0; i <= 160; i++) { const t = i / 160, a = Math.PI + t * 4 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.12, -0.18 - t * 0.5, Math.sin(a) * 0.12)); }
  pts.push(new THREE.Vector3(-0.06, -0.72, 0), new THREE.Vector3(s, -0.66, 0));
  for (let y = -0.6; y < top; y += 0.06) pts.push(new THREE.Vector3(s, y, 0));
  pts.push(new THREE.Vector3(s, top, 0));
  const element = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 400, 0.016, 8), chrome);
  element.userData.power = HOT_COIL;
  g.add(element);
  g.position.y = -0.18;
  return shell(name, g, { pose: { elevation: 0.15, zoom: 1.0 } });
}

function instantHeater(name, { top, body, lower }) { // Croma / Croma2: a compact wall heater with inlet pipes
  const g = new THREE.Group();
  const main = box(0.55, 0.85, 0.42, 0.08, mat(body));
  const cap = box(0.57, 0.22, 0.44, 0.08, mat(top));
  cap.position.y = 0.48;
  g.add(main, cap);
  if (lower) {
    const l = box(0.56, 0.42, 0.43, 0.06, mat(lower));
    l.position.y = -0.22;
    g.add(l);
  }
  for (const x of [-0.1, 0.1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), mat(FINISH.chrome));
    pipe.position.set(x, -0.5, 0);
    g.add(pipe);
  }
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), mat({ color: '#e33', emissive: '#f22', emissiveIntensity: 0.8 }));
  lamp.userData.power = LAMP;
  lamp.position.set(-0.15, 0.25, 0.212);
  g.add(lamp);
  return shell(name, g, { pose: { elevation: 0.12, zoom: 1.05 } });
}

function kettleElement(name) {
  // studio photo 145: one chrome tube bent into two upright figure-8s side by side, joined along the bottom,
  // rising from a dark grey cylinder with a brass hex flange on top and a brass terminal underneath
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const brass = mat({ color: '#c9944f', metalness: 1, roughness: 0.3 });
  const yb = 0.08, h8 = 0.3, w8 = 0.17; // the bar along the bottom, and each 8's half height and half width
  const pts = [new THREE.Vector3(-0.04, -0.02, 0), new THREE.Vector3(-0.05, yb, 0)];
  for (const [side, x0] of [[-1, -0.2], [1, 0.2]]) {
    if (side === 1) pts.push(new THREE.Vector3(0, yb, 0.012)); // along the bottom bar to the second 8
    // an upright figure-8 (a Gerono lemniscate) from its bottom point, round both loops and back
    for (let i = 0; i <= 96; i++) {
      const t = -Math.PI / 2 + (i / 96) * Math.PI * 2 * side;
      pts.push(new THREE.Vector3(x0 + w8 * Math.sin(2 * t) * side, yb + h8 + h8 * Math.sin(t), 0.02 * Math.cos(t)));
    }
  }
  pts.push(new THREE.Vector3(0.05, yb, 0), new THREE.Vector3(0.04, -0.02, 0));
  const loops = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3), 420, 0.02, 10), chrome);
  loops.userData.power = HOT_COIL;
  g.add(loops);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.165, 0.3, 40), mat({ color: '#3b3d40', roughness: 0.45 }));
  base.position.y = -0.2;
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 6), brass);
  flange.position.y = -0.04;
  const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12), brass);
  terminal.position.y = -0.37;
  g.add(base, flange, terminal);
  g.position.y = -0.15;
  return shell(name, g, { pose: { elevation: 0.15, zoom: 1.15 } });
}

// Croma and Croma2, as in their catalogue pictures
function taper(mesh, amount) { // narrows the top of a slab (y from its bottom to its top) by 'amount'
  const g = mesh.geometry;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = 1 - amount * ((p.getY(i) - min.y) / (max.y - min.y));
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return mesh;
}
function tap(material, x, y, z) { // the white L-shaped outlet tap on the front
  const g = new THREE.Group();
  const stub = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), material);
  stub.position.set(x, y, z + 0.03);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.16, 16), material);
  nozzle.position.set(x, y - 0.09, z + 0.065);
  g.add(stub, nozzle);
  return g;
}
function lamp(color, x, y, z, square = false) {
  const m = mat({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.25 });
  const l = new THREE.Mesh(square ? new THREE.BoxGeometry(0.03, 0.03, 0.01) : new THREE.SphereGeometry(0.018, 14, 10), m);
  l.position.set(x, y, z);
  l.userData.power = LAMP; // lights when switched on
  return l;
}
function cromaHeater(name) {
  // a white body under a red tapered hood with a flared lip, two lamps on the hood, a vent cap on top, a tap
  const g = new THREE.Group();
  const white = mat({ color: '#f1f1ee', roughness: 0.32, clearcoat: 0.6 });
  const red = mat({ color: '#e0242c', roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.08 });
  const body = slab(0.56, 0.42, 0.66, 0.06, white);
  body.position.y = -0.55;
  const lip = slab(0.66, 0.5, 0.05, 0.08, red);
  lip.position.y = 0.09;
  const hood = taper(slab(0.62, 0.46, 0.3, 0.1, red), 0.14);
  hood.position.y = 0.13;
  const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 20), white);
  capBase.position.set(0.15, 0.46, -0.04);
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
  capDome.position.set(0.15, 0.49, -0.04);
  g.add(body, lip, hood, capBase, capDome, tap(white, -0.13, -0.02, 0.21));
  g.add(lamp('#ff3b30', -0.04, 0.27, 0.205), lamp('#38c7d1', 0.05, 0.27, 0.205));
  for (const x of [-0.1, 0.1]) { // inlet and outlet pipes underneath
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), mat(FINISH.chrome));
    pipe.position.set(x, -0.6, 0);
    g.add(pipe);
  }
  return shell(name, g, { pose: { elevation: 0.15, azimuth: 0.45, zoom: 1.05 } });
}
function croma2Heater(name) {
  // a teal lower body, a light-grey upper section with a dipped (saddle) top, two lamps on the left, a tap
  const g = new THREE.Group();
  const grey = mat({ color: '#e6e7e6', roughness: 0.35, clearcoat: 0.5 });
  const teal = mat({ color: '#3fa7b0', roughness: 0.3, clearcoat: 0.7 });
  const white = mat({ color: '#f4f4f2', roughness: 0.3, clearcoat: 0.6 });
  const lower = slab(0.58, 0.42, 0.5, 0.06, teal);
  lower.position.y = -0.5;
  const w = 0.62, h = 0.42, d = 0.46;
  const outline = new THREE.Shape();
  outline.moveTo(-w / 2, -h / 2);
  outline.lineTo(w / 2, -h / 2);
  outline.lineTo(w / 2, h / 2);
  outline.quadraticCurveTo(0, h / 2 - 0.12, -w / 2, h / 2); // the dipped top edge
  outline.closePath();
  const upperGeo = new THREE.ExtrudeGeometry(outline, { depth: d - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 16 });
  upperGeo.translate(0, 0, -(d - 0.04) / 2);
  const upper = new THREE.Mesh(upperGeo, grey);
  upper.position.y = 0.21;
  g.add(lower, upper, tap(white, -0.14, -0.08, 0.21));
  g.add(lamp('#3ac05a', -0.19, 0.27, 0.235, true), lamp('#ff3b30', -0.19, 0.19, 0.235, true));
  return shell(name, g, { pose: { elevation: 0.15, azimuth: 0.45, zoom: 1.05 } });
}

// ---------------------------------------------------------------- the range, as pictured
const build = (fn) => ({ shadows = false } = {}) => { const a = fn(); a.shadows(shadows); return a; };
// as in each one's studio photo
const PLATES = {
  'jhn-1250': { finish: 'hammer', shape: 'pressed' }, 'jhn-2000': { finish: 'hammer', shape: 'pressed' },
  hudsun: { finish: 'hammer', shape: 'pressed', size: 1.08 },
  nelson: { finish: 'chrome', shape: 'pressed' }, calvin: { finish: 'chrome', shape: 'pressed' }, simson: { finish: 'steel', shape: 'pressed' },
  bng: { finish: 'hammer', tall: true }, comfort: { finish: 'grey-steel', print: 'dark' },
  smart: { finish: 'charcoal', frame: 'steel', print: 'light' }, ultima: { finish: 'black-glass', frame: 'steel', feet: false },
  magnum: { finish: 'steel', frame: 'black', feet: false }, crescent: { finish: 'steel', feet: false, slots: true },
  regent: { finish: 'steel-white', feet: false }, excel: { finish: 'steel-white', tall: true },
  phantom: { finish: 'nickel' }, 'ss-2000': { finish: 'steel' }, 'ss-jumbo': { finish: 'steel', tall: true },
  rustam: { finish: 'steel', stand: true },
};

export const APPLIANCES = {
  ...Object.fromEntries(Object.entries(PLATES).map(([k, cfg]) => [`kitchen-appliances-${k}`, build(() => hotplate(k, cfg))])),
  'kitchen-appliances-presto': build(() => cooktop('presto', { print: 'ring', frameFinish: 'steel' })),
  'kitchen-appliances-prime': build(() => cooktop('prime', { print: 'swirl', frameFinish: 'abs' })),
  'kitchen-appliances-prince': build(() => cooktop('prince', { print: 'grill', grill: true, frameFinish: 'steel' })),
  'heating-water-alexa': build(() => fanHeater('alexa', { w: 0.95, h: 0.5, d: 0.68, body: FINISH.white, front: FINISH.black })),
  'heating-water-alineo': build(() => fanHeater('alineo', { w: 1.05, h: 0.56, d: 0.74, body: FINISH.white, front: FINISH.black, knobColour: { color: '#ece6d4', roughness: 0.35 } })),
  'heating-water-pearl': build(() => fanHeater('pearl', { w: 1.0, h: 0.52, d: 0.66, body: { color: '#e4e4e1', roughness: 0.4 }, front: { color: '#2a2b2e', roughness: 0.4 }, vent: 'slats' })),
  // the upright ones: narrow front, deep perforated sides
  'heating-water-pox': build(() => fanHeater('pox', { w: 0.5, h: 0.9, d: 0.75, body: FINISH.white, frame: { color: '#2a2b2e', roughness: 0.4 }, front: { color: '#55575b', roughness: 0.4 }, side: { kind: 'dots', bg: '#f1f1ee', fg: '#a9aaa8' }, upright: true, knobs: 2 })),
  'heating-water-roxx': build(() => fanHeater('roxx', { w: 0.5, h: 0.9, d: 0.75, body: { color: '#ebe5d6', roughness: 0.45 }, frame: { color: '#9c9d9f', roughness: 0.4 }, front: { color: '#2a2b2e', roughness: 0.45 }, side: { kind: 'dots', bg: '#ebe5d6', fg: '#b0a68e' }, upright: true, knobs: 2, knobColour: { color: '#ebe5d6', roughness: 0.4 } })),
  'heating-water-rozer': build(() => fanHeater('rozer', { w: 0.52, h: 0.92, d: 0.72, body: { color: '#26272a', roughness: 0.4 }, frame: { color: '#e6672a', roughness: 0.35, clearcoat: 0.6 }, front: { color: '#c8322a', roughness: 0.35 }, side: { kind: 'dots', bg: '#26272a', fg: '#151617' }, upright: true, knobs: 2, knobColour: { color: '#232427', roughness: 0.35 } })),
  'heating-water-silky': build(() => fanHeater('silky', { w: 0.5, h: 0.95, d: 0.72, body: FINISH.white, frame: { color: '#9a6b4c', metalness: 0.6, roughness: 0.3 }, front: { color: '#1e1f21', roughness: 0.45 }, side: { kind: 'ribs', bg: '#f1f1ee', fg: '#b9b9b4' }, upright: true, knobs: 2, knobColour: { color: '#ece6d4', roughness: 0.35 } })),
  'heating-water-sigma': build(() => quartzHeater('sigma')),
  'heating-water-sun-heater-sunshine-14': build(() => sunHeater('sun-heater')),
  'heating-water-pearl-immersion-rod-1000-w': build(() => immersionRod('rod-1000', { handle: 'black' })),
  'heating-water-pearl-immersion-rod-1500-w': build(() => immersionRod('rod-1500', { handle: 'lime' })),
  'heating-water-pearl-immersion-rod-2000-w': build(() => immersionRod('rod-2000', { handle: 'lime' })),
  'heating-water-croma': build(() => cromaHeater('croma')),
  'heating-water-croma2': build(() => croma2Heater('croma2')),
  'heating-water-kettle-element': build(() => kettleElement('kettle-element')),
};
