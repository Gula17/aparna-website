// Aparna kitchen, heating and ironing appliances, built procedurally in three.js. Each product is a set of
// choices read off its own Catalogue 2026 picture:
//   G-COIL HOT PLATES  square body in steel, nickel or powder coat (grey, white or black), a chrome dish with a
//                      black spiral coil, a knob and a red nameplate; Magnum has a steel top on a black frame,
//                      Rustam a wire pan stand
//   INFRARED COOKTOPS  black glass top with a printed ring and touch panel; Prince has a grill grid
//   FAN HEATERS        box body with a front grille and knobs; the inner fan turns (the scene spins it)
//   QUARTZ (Silky) and SUN HEATER (14"), IMMERSION RODS, INSTANT WATER HEATERS (Croma, Croma2), KETTLE ELEMENT
//   DRY IRONS          chrome soleplate, shaped body, handle and dial
//   CABIN FAN 12"      white round housing with swirl vanes; the fan inside turns
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
  chrome: { color: '#eceef0', metalness: 1, roughness: 0.12 },
};

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
function hotplate(name, { finish, frame, stand = false, dome = false }) {
  const g = new THREE.Group();
  const body = mat(FINISH[frame ?? finish]);
  const top = mat(FINISH[finish]);
  const chrome = mat(FINISH.chrome);
  const black = mat({ color: '#111214', roughness: 0.5 });
  const coilMat = mat({ color: '#2c2d30', metalness: 0.65, roughness: 0.32 });
  const ceramic = mat({ color: '#f1eee6', roughness: 0.55 });
  const H = dome ? 0.27 : 0.24;
  const y0 = -0.2;
  const base = slab(1.0, 0.95, H, 0.1, body);
  base.position.y = y0;
  g.add(base);
  if (frame) { // a steel top over a different frame (Magnum)
    const lid = slab(0.96, 0.91, 0.03, 0.09, top);
    lid.position.y = y0 + H;
    g.add(lid);
  }
  const yTop = y0 + H + (frame ? 0.03 : 0);
  // the raised rim round the top edge, so the top reads as a shallow tray
  const rimShape = new THREE.Shape();
  const rr = (s, w, d, r) => {
    s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    return s;
  };
  rr(rimShape, 1.0, 0.95, 0.1);
  rimShape.holes.push(rr(new THREE.Path(), 0.9, 0.85, 0.07));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
  rimGeo.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, top);
  rim.position.y = yTop - 0.004;
  g.add(rim);
  // chrome dish, white ceramic ring, and the dark G-coil sitting proud on it
  const cx = -0.04, cz = -0.04;
  const dish = new THREE.Mesh(lathe([[0, yTop - 0.02], [0.33, yTop - 0.018], [0.37, yTop - 0.004], [0.39, yTop + 0.006]]), chrome);
  const bed = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.335, 64), ceramic);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = yTop - 0.012;
  const coil = spiral(0.06, 0.31, 5.5, yTop + 0.006, 0.018, coilMat);
  const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), coilMat);
  terminal.position.y = yTop - 0.004;
  for (const part of [dish, bed, coil, terminal]) { part.position.x += cx; part.position.z += cz; g.add(part); }
  // the knob and red nameplate stand out from the front face (the body's bevel puts it at z ~ 0.5)
  g.add(knob(black, 0.34, y0 + H * 0.5, 0.52, 0.065));
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.012), mat({ color: '#c8232c', roughness: 0.35, clearcoat: 0.8 }));
  plate.position.set(-0.02, y0 + H * 0.45, 0.502);
  g.add(plate);
  // vent slots down both sides
  const slotMat = mat({ color: '#1a1b1d', roughness: 0.7 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.1), slotMat);
      slot.position.set(side * 0.506, y0 + H * 0.5, -0.3 + i * 0.15);
      g.add(slot);
    }
  }
  // four short black feet showing below the body
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 16), black);
    foot.position.set(x * 0.38, y0 - 0.025, z * 0.35);
    g.add(foot);
  }
  if (stand) { // Rustam: a wire pan stand over the coil
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 48), chrome);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, yTop + 0.12, cz);
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 6), chrome);
      leg.position.set(cx + Math.cos(a) * 0.3, yTop + 0.06, cz + Math.sin(a) * 0.3);
      g.add(leg);
    }
  }
  return shell(name, g);
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
  x.strokeStyle = kind === 'swirl' ? '#7a7c80' : '#c4262e';
  x.lineWidth = 6;
  x.beginPath(); x.arc(200, 256, 150, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#c4262e';
  x.beginPath(); x.arc(200, 256, 10, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#d9dadc'; // touch buttons
  for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(400 + (i % 2) * 50, 150 + Math.floor(i / 2) * 60, 13, 0, Math.PI * 2); x.fill(); }
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
  const handleMat = mat(FINISH.chrome);
  for (const sx of [-1, 1]) { // flat U-shaped carry handles standing out from the sides
    const path = new THREE.CatmullRomCurve3([[0.53, -0.17], [0.6, -0.15], [0.635, -0.06], [0.635, 0.06], [0.6, 0.15], [0.53, 0.17]]
      .map(([x, z]) => new THREE.Vector3(sx * x, -0.05, z)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.014, 8), handleMat));
  }
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
  return shell(name, g);
}

// ---------------------------------------------------------------- heaters
function fanHeater(name, { w, h, d, body, front, upright = false, knobs = 2, knobColour }) {
  const g = new THREE.Group();
  const bodyMat = mat(body);
  const frontMat = mat(front);
  g.add(box(w, h, d, upright ? 0.1 : 0.17, bodyMat)); // the low models are softly rounded all over
  const gw = w * 0.82, gh = upright ? h * 0.62 : h * 0.5;
  const gy = upright ? -h * 0.06 : -h * 0.14;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat({ color: '#111214', roughness: 0.6 }));
  panel.position.set(0, gy, d / 2 + 0.003);
  g.add(panel);
  const n = upright ? 11 : 7;
  for (let i = 0; i < n; i++) { // the front grille slats
    const slat = new THREE.Mesh(new THREE.BoxGeometry(gw, gh / n * 0.45, 0.02), frontMat);
    slat.position.set(0, gy - gh / 2 + (i + 0.5) * (gh / n), d / 2 + 0.012);
    g.add(slat);
  }
  // the control knobs on top, at the right (light grey with a pointer ridge, as pictured)
  const knobMat = mat(knobColour ?? { color: '#dcdcd8', roughness: 0.35, clearcoat: 0.5 });
  const ridgeMat = mat({ color: '#9a9b9d', roughness: 0.4 });
  for (let i = 0; i < knobs; i++) {
    const k = new THREE.Group();
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.05, 28), knobMat));
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.022), ridgeMat);
    ridge.position.y = 0.035;
    k.add(ridge);
    const kx = upright ? (i - (knobs - 1) / 2) * 0.2 : w * 0.26 + (i - (knobs - 1) / 2) * 0.19;
    k.position.set(kx, h / 2 + 0.025, upright ? 0 : d * 0.05);
    g.add(k);
  }
  if (!upright) { // the warm-air vent grille on the top
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.36, d * 0.5), mat({ color: '#1a1b1d', roughness: 0.6 }));
    vent.rotation.x = -Math.PI / 2;
    vent.position.set(-w * 0.12, h / 2 + 0.004, 0);
    g.add(vent);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, 0.012, d * 0.5 / 6 * 0.45), bodyMat);
      bar.position.set(-w * 0.12, h / 2 + 0.01, -d * 0.25 + (i + 0.5) * (d * 0.5 / 6));
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

function quartzHeater(name) { // Silky: a chrome reflector trough with two quartz rods, on blue end stands
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const blue = mat({ color: '#2f63b8', roughness: 0.35, clearcoat: 0.6 });
  const trough = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 32, 1, true, Math.PI * 0.15, Math.PI * 1.1), chrome);
  trough.rotation.z = Math.PI / 2;
  trough.rotation.x = -0.5;
  g.add(trough);
  for (const y of [-0.06, 0.08]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 12), mat({ color: '#ffb36b', emissive: '#ff6a1f', emissiveIntensity: 0.9, roughness: 0.3 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, y, 0.08);
    g.add(rod);
  }
  for (let i = 0; i < 9; i++) { // front guard wires
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6), chrome);
    wire.position.set(-0.5 + i * 0.125, 0.01, 0.24);
    g.add(wire);
  }
  for (const sx of [-1, 1]) {
    const end = box(0.06, 0.62, 0.4, 0.03, blue);
    end.position.set(sx * 0.63, -0.08, 0);
    const foot = box(0.08, 0.04, 0.5, 0.02, blue);
    foot.position.set(sx * 0.63, -0.4, 0);
    g.add(end, foot);
  }
  return shell(name, g, { pose: { elevation: 0.25, zoom: 1.0 } });
}

function sunHeater(name) { // 14" sun heater: a round chrome reflector with a spiral element on a yellow pedestal
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const yellow = mat({ color: '#f2c12e', roughness: 0.35, clearcoat: 0.6 });
  const dish = new THREE.Mesh(lathe([[0, -0.12], [0.18, -0.1], [0.32, -0.04], [0.4, 0.04]]), chrome);
  dish.rotation.x = Math.PI / 2;
  dish.position.y = 0.3;
  const element = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20), mat({ color: '#ffb36b', emissive: '#ff5a14', emissiveIntensity: 0.8 }));
  element.rotation.x = Math.PI / 2;
  element.position.set(0, 0.3, -0.04);
  g.add(dish, element);
  for (let i = 0; i < 16; i++) { // the front guard: radial wires and a ring
    const a = (i / 16) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), chrome);
    wire.position.set(Math.cos(a) * 0.2, 0.3 + Math.sin(a) * 0.2, 0.05);
    wire.rotation.z = a - Math.PI / 2;
    g.add(wire);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 8, 64), yellow);
  rim.position.set(0, 0.3, 0.05);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.36, 20), yellow);
  neck.position.y = -0.2;
  const base = new THREE.Mesh(lathe([[0.06, -0.36], [0.2, -0.4], [0.3, -0.46], [0.31, -0.5], [0, -0.5]]), yellow);
  g.add(rim, neck, base);
  return shell(name, g, { pose: { elevation: 0.15, zoom: 1.05 } });
}

// ---------------------------------------------------------------- water heating
function immersionRod(name) { // Pearl immersion rod: teal-capped dark handle, chrome rod and coil
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  const handle = new THREE.Mesh(lathe([[0, 0.92], [0.05, 0.9], [0.075, 0.78], [0.07, 0.5], [0.05, 0.36], [0.03, 0.32]]), mat({ color: '#2d3033', roughness: 0.35, clearcoat: 0.6 }));
  const cap = new THREE.Mesh(lathe([[0, 0.96], [0.04, 0.95], [0.08, 0.86], [0.078, 0.8]]), mat({ color: '#3cb6b0', roughness: 0.3, clearcoat: 0.7 }));
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), mat({ color: '#111', roughness: 0.6 }));
  cord.position.y = 1.04;
  // the heating element is one tube: down from the handle, bending out into the coil, five turns down,
  // then back up through the middle of the coil to the handle (the way a real immersion rod is made)
  const pts = [];
  for (let y = 0.33; y > -0.1; y -= 0.06) pts.push(new THREE.Vector3(0.012, y, 0));
  pts.push(new THREE.Vector3(0.03, -0.15, 0), new THREE.Vector3(0.08, -0.19, 0));
  for (let i = 0; i <= 200; i++) { const t = i / 200, a = t * 5 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.1, -0.21 - t * 0.54, Math.sin(a) * 0.1)); }
  pts.push(new THREE.Vector3(0.07, -0.79, 0), new THREE.Vector3(0.02, -0.78, 0));
  for (let y = -0.74; y < 0.33; y += 0.06) pts.push(new THREE.Vector3(-0.012, y, 0));
  pts.push(new THREE.Vector3(-0.012, 0.33, 0));
  const element = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 420, 0.016, 8), chrome);
  g.add(handle, cap, cord, element);
  g.position.y = -0.12;
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
  lamp.position.set(-0.15, 0.25, 0.212);
  g.add(lamp);
  return shell(name, g, { pose: { elevation: 0.12, zoom: 1.05 } });
}

function kettleElement(name) { // two chrome loops on a black base
  const g = new THREE.Group();
  const chrome = mat(FINISH.chrome);
  for (const x of [-0.14, 0.14]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 10, 40), chrome);
    loop.position.set(x, 0.22, 0);
    const loop2 = loop.clone();
    loop2.position.y = 0.45;
    g.add(loop, loop2);
  }
  for (const x of [-0.06, 0.06]) { // the two legs joining the loops to the base
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10), chrome);
    leg.position.set(x, 0.1, 0);
    g.add(leg);
  }
  const base = new THREE.Mesh(lathe([[0, -0.3], [0.17, -0.3], [0.19, -0.2], [0.16, -0.05], [0.12, 0.05]]), mat({ color: '#1a1b1d', roughness: 0.45 }));
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 32), mat({ color: '#b8653f', metalness: 1, roughness: 0.3 }));
  flange.position.y = 0.06;
  g.add(base, flange);
  return shell(name, g, { pose: { elevation: 0.2, zoom: 1.2 } });
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

// ---------------------------------------------------------------- dry irons
function iron(name, { body, accent, handle }) {
  const g = new THREE.Group();
  const outline = (scale) => {
    const s = new THREE.Shape();
    s.moveTo(-0.5 * scale, -0.26 * scale);
    s.lineTo(0.15 * scale, -0.26 * scale);
    s.quadraticCurveTo(0.5 * scale, -0.2 * scale, 0.62 * scale, 0);
    s.quadraticCurveTo(0.5 * scale, 0.2 * scale, 0.15 * scale, 0.26 * scale);
    s.lineTo(-0.5 * scale, 0.26 * scale);
    s.closePath();
    return s;
  };
  const plateGeo = new THREE.ExtrudeGeometry(outline(1), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  plateGeo.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(plateGeo, mat(FINISH.chrome));
  plate.position.y = -0.3;
  const shellGeo = new THREE.ExtrudeGeometry(outline(0.93), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5 });
  shellGeo.rotateX(-Math.PI / 2);
  // the cover rises from the nose to a tall heel, as on a dry iron
  const rise = (x) => THREE.MathUtils.clamp(1.4 - 0.9 * ((x + 0.5) / 1.12), 0.45, 1.4);
  const pos = shellGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * rise(pos.getX(i)));
  shellGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(shellGeo, mat(body));
  bodyMesh.position.y = -0.24;
  g.add(plate, bodyMesh);
  // the handle: a closed loop, an upright post at the heel, the grip on top, and a strut down to the front
  const pts = [[-0.43, 0.02], [-0.44, 0.2], [-0.32, 0.33], [-0.05, 0.34], [0.16, 0.24], [0.27, 0.04], [0.3, -0.08]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.055, 14), mat(handle));
  arch.scale.z = 0.85;
  g.add(arch);
  // the temperature dial, set into the sloping cover in front of the handle
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.04, 28), mat(accent));
  dial.position.set(0.4, -0.06, 0);
  dial.rotation.z = -0.25;
  g.add(dial);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.45, 0, 0), new THREE.Vector3(-0.62, -0.05, 0), new THREE.Vector3(-0.8, -0.25, 0)]), 16, 0.016, 8), mat({ color: '#111', roughness: 0.6 }));
  g.add(cord);
  return shell(name, g, { pose: { elevation: 0.3, azimuth: 0.9, zoom: 1.25 } });
}

// ---------------------------------------------------------------- cabin fan
function cabinFan(name) { // Cabin Fan 12": a white round housing with curved swirl vanes over a turning fan
  const g = new THREE.Group();
  const white = mat({ color: '#f1f1ee', roughness: 0.35, clearcoat: 0.6 });
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.6, 0.32, 64, 1, true), white);
  housing.rotation.x = Math.PI / 2;
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.6, 64), white);
  back.position.z = -0.16;
  back.rotation.y = Math.PI;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 12, 64), white);
  rim.position.z = 0.16;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 40), white);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.17;
  g.add(housing, back, rim, hub);
  for (let i = 0; i < 22; i++) { // the swirl vanes
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, r = 0.15 + 0.45 * t, a = (i / 22) * Math.PI * 2 + t * 0.9;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.16 - t * 0.02));
    }
    const vane = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.013, 5), white);
    vane.scale.z = 2.2;
    g.add(vane);
  }
  const bracket = box(0.18, 0.5, 0.12, 0.05, white);
  bracket.position.set(0, -0.62, -0.06);
  g.add(bracket);
  const axis = new THREE.Group();
  axis.position.z = 0.02;
  axis.rotation.x = Math.PI / 2;
  const rotor = new THREE.Group();
  const bladeMat = mat({ color: '#e6e6e2', roughness: 0.4 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.008, 0.16), bladeMat);
    b.position.x = 0.32;
    b.rotation.x = -0.4;
    const p = new THREE.Group();
    p.rotation.y = (i / 5) * Math.PI * 2;
    p.add(b);
    rotor.add(p);
  }
  axis.add(rotor);
  return shell(name, g, { rotor, axis, pose: { elevation: 0.12, azimuth: 0.45, zoom: 1.0 } });
}

// ---------------------------------------------------------------- the range, as pictured
const build = (fn) => ({ shadows = false } = {}) => { const a = fn(); a.shadows(shadows); return a; };
const PLATES = {
  bng: { finish: 'powder-dark' }, calvin: { finish: 'steel' }, comfort: { finish: 'powder' }, crescent: { finish: 'nickel' },
  excel: { finish: 'white' }, hudsun: { finish: 'powder' }, 'jhn-1250': { finish: 'powder' }, 'jhn-2000': { finish: 'powder' },
  magnum: { finish: 'steel', frame: 'black' }, nelson: { finish: 'nickel' }, phantom: { finish: 'nickel' }, regent: { finish: 'white' },
  rustam: { finish: 'steel', stand: true }, 'ss-jumbo': { finish: 'steel', dome: true }, 'ss-2000': { finish: 'steel' },
  simson: { finish: 'steel' }, smart: { finish: 'powder-dark' }, ultima: { finish: 'black' },
};

export const APPLIANCES = {
  ...Object.fromEntries(Object.entries(PLATES).map(([k, cfg]) => [`kitchen-appliances-${k}`, build(() => hotplate(k, cfg))])),
  'kitchen-appliances-presto': build(() => cooktop('presto', { print: 'ring', frameFinish: 'steel' })),
  'kitchen-appliances-prime': build(() => cooktop('prime', { print: 'swirl', frameFinish: 'abs' })),
  'kitchen-appliances-prince': build(() => cooktop('prince', { print: 'ring', grill: true, frameFinish: 'abs' })),
  'heating-water-alexa': build(() => fanHeater('alexa', { w: 0.95, h: 0.5, d: 0.68, body: FINISH.white, front: FINISH.black })),
  'heating-water-alineo': build(() => fanHeater('alineo', { w: 1.05, h: 0.56, d: 0.74, body: FINISH.white, front: FINISH.black })),
  'heating-water-pearl': build(() => fanHeater('pearl', { w: 1.0, h: 0.52, d: 0.66, body: FINISH.white, front: { color: '#55575b', roughness: 0.4 } })),
  'heating-water-pox': build(() => fanHeater('pox', { w: 0.6, h: 0.9, d: 0.45, body: FINISH.white, front: FINISH.black, upright: true, knobs: 2 })),
  'heating-water-roxx': build(() => fanHeater('roxx', { w: 0.6, h: 0.9, d: 0.45, body: { color: '#e9e3d3', roughness: 0.45 }, front: { color: '#9a958a', roughness: 0.45 }, upright: true, knobs: 1 })),
  'heating-water-rozer': build(() => fanHeater('rozer', { w: 0.62, h: 0.92, d: 0.45, body: FINISH.black, front: { color: '#e6672a', roughness: 0.35, clearcoat: 0.6 }, upright: true, knobs: 2, knobColour: { color: '#232427', roughness: 0.35 } })),
  'heating-water-silky': build(() => quartzHeater('silky')),
  'heating-water-sun-heater-sunshine-14': build(() => sunHeater('sun-heater')),
  'heating-water-pearl-immersion-rod-1000-w': build(() => immersionRod('rod-1000')),
  'heating-water-pearl-immersion-rod-1500-w': build(() => immersionRod('rod-1500')),
  'heating-water-pearl-immersion-rod-2000-w': build(() => immersionRod('rod-2000')),
  'heating-water-croma': build(() => cromaHeater('croma')),
  'heating-water-croma2': build(() => croma2Heater('croma2')),
  'heating-water-kettle-element': build(() => kettleElement('kettle-element')),
  'all-purpose-cabin-fans-cabin-fan-12': build(() => cabinFan('cabin-fan')),
  'electric-irons-bmw': build(() => iron('bmw', { body: FINISH.black, accent: { color: '#d8262d', roughness: 0.3, clearcoat: 0.8 }, handle: { color: '#d8262d', roughness: 0.3, clearcoat: 0.8 } })),
  'electric-irons-grand': build(() => iron('grand', { body: { color: '#2f6fd1', roughness: 0.3, clearcoat: 0.8 }, accent: FINISH.chrome, handle: { color: '#2f6fd1', roughness: 0.3, clearcoat: 0.8 } })),
  'electric-irons-plancha': build(() => iron('plancha', { body: FINISH.white, accent: { color: '#9bb2d6', roughness: 0.35 }, handle: FINISH.white })),
  'electric-irons-regular': build(() => iron('regular', { body: FINISH.chrome, accent: FINISH.black, handle: FINISH.black })),
};
