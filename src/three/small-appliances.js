// Aparna dry irons, the Cabin Fan 12", cooler motors and cooler pumps, built procedurally in three.js from their
// studio photos (src/content/studio-photos.json: irons 125-136, Cabin Fan 79, motors 148-155, pumps 156-161).
//   DRY IRONS      three builds, as the photos show them:
//                  'modern'  one moulded shell whose grip arches over an open hole, on a thin soleplate
//                            (BMW and the new white/grey, white/blue, white/pink and black irons)
//                  'classic' a chrome soleplate and hood with a plastic handle frame on top: a rear tower, the
//                            grip and a front post (Regular, Grand, Bold and the new blue iron)
//                  'plancha' a chrome hood under a tall rounded rear body and a looped grip (Plancha, in white
//                            or cream, and the new heavyweight black iron)
//   CABIN FAN 12"  a deep white drum with a swirl-vane front grille and a badge; the fan inside turns
//   COOLER MOTORS  a dark round can on studs with a brass shaft (it turns), the rating label, and each one's
//                  own mounting: fins, a ring, side clamps, a flange, a capacitor
//   COOLER PUMPS   small two-tone submersible pumps with an inlet grille and a barbed outlet on top
// Irons point their nose to -x with the heel at +x, motors stand with the shaft up (+y), and pumps have their
// inlet on the -x end: the sides each photo shows. Sides the photos don't show follow the visible side.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeBlurTexture } from './aeroflow-model.js';

const mat = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.4, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};
const plastic = (color, extra = {}) => ({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, ...extra });
const CHROME = { color: '#eef0f2', metalness: 1, roughness: 0.07 };
const BRASS = { color: '#c49a4a', metalness: 1, roughness: 0.3 };
const ZINC = { color: '#c9ccd0', metalness: 1, roughness: 0.25 };

// What the scene needs from every model: the still parts, a rotor it turns about its own y axis (empty when
// nothing turns), an invisible blur disc and hit area, a starting view, and an optional finish switch.
function shell(name, stator, { rotor = new THREE.Group(), axis = null, pose = {}, setFinish = () => {} } = {}) {
  const fan = new THREE.Group();
  fan.name = name;
  rotor.name = 'rotor';
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.02, 8), new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, visible: false }));
  const hitArea = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  fan.add(stator, axis ?? rotor, blurDisc, hitArea);
  return {
    fan, rotor, stator, blades: [], blurDisc, hitArea, setFinish,
    viewerPose: { elevation: 0.3, azimuth: 0.4, screenX: 0.5, screenY: 0.5, fill: 0.9, zoom: 1, ...pose },
    shadows(on) { fan.traverse((o) => { if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

function rbox(w, h, d, r, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), material);
  m.position.set(x, y, z);
  return m;
}
function cyl(rTop, rBottom, h, material, segs = 32) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segs), material);
}
// a round tube along the points, closed with a rounded cap at each end (children, so they follow its scale)
function tube(points, radius, material, segs = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 24), material);
  for (const t of [0, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), material);
    cap.position.copy(curve.getPoint(t));
    m.add(cap);
  }
  return m;
}
const smooth = (a, b, t) => { const k = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

// A smooth body swept along x. fn(u), u from 0 (the -x end) to 1, gives each cross-section:
// { x, w: half-width, y0: bottom, h: height, e: squareness (2 round, larger boxier), taper: how much narrower the
// top is }. The section is flat underneath and arched over the top; both ends are capped. With 'arc' only that
// part of the arch is swept (t from 0 at one side to 1 at the other), as an open skin: a second colour laid over
// the top of a body.
function loft(fn, material, { rings = 56, around = 30, arc = null } = {}) {
  const pos = [];
  const idx = [];
  let P = 0;
  const sections = [];
  const [t0, t1] = arc ?? [0, 1];
  for (let i = 0; i <= rings; i++) {
    const s = fn(i / rings);
    const pts = [];
    for (let j = 0; j <= around; j++) {
      const t = (t0 + (t1 - t0) * (j / around)) * Math.PI;
      const q = Math.abs(Math.sin(t)) ** (2 / s.e);
      const c = Math.cos(t);
      pts.push([s.w * Math.sign(c) * Math.abs(c) ** (2 / s.e) * (1 - (s.taper ?? 0) * q), s.y0 + s.h * q]);
    }
    if (!arc) for (let j = 1; j < 6; j++) pts.push([-s.w + (2 * s.w * j) / 6, s.y0]);
    P = pts.length;
    sections.push(s);
    for (const [z, y] of pts) pos.push(s.x, y, z);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < (arc ? P - 1 : P); j++) {
      const a = i * P + j, b = i * P + ((j + 1) % P), c = (i + 1) * P + j, d = (i + 1) * P + ((j + 1) % P);
      idx.push(a, b, c, b, d, c);
    }
  }
  for (const [ring, flip] of arc ? [] : [[0, true], [rings, false]]) { // end caps
    const s = sections[ring];
    const centre = pos.length / 3;
    pos.push(s.x, s.y0 + s.h * 0.4, 0);
    for (let j = 0; j < P; j++) {
      const a = ring * P + j, b = ring * P + ((j + 1) % P);
      if (flip) idx.push(centre, b, a); else idx.push(centre, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}
// how far out the side of a loft section is at height y (for setting a part onto it)
function sideZ(s, y) {
  const q = THREE.MathUtils.clamp((y - s.y0) / s.h, 0, 1);
  return s.w * (1 - q ** s.e) ** (1 / s.e) * (1 - (s.taper ?? 0) * q);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ================================================================ dry irons
const IRON_L = 1.9; // nose to heel
const IRON_W = 0.42; // half the width at the heel
const ix = (u) => -IRON_L / 2 + IRON_L * u;
// the soleplate's outline: a pointed nose with full, rounded sides and slightly rounded heel corners
const outline = (u) => {
  const k = Math.min(u / 0.62, 1);
  const heel = u > 0.95 ? Math.sqrt(1 - ((u - 0.95) / 0.05) ** 2 * 0.3) : 1;
  return Math.max(0.004, (1 - (1 - k) ** 2.2) ** 0.55 * heel);
};

function soleplate(g, { finish, y0 = -0.44, h = 0.06, under }) {
  g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u), y0, h, e: 10 }), mat(finish)));
  if (under) g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u) * 0.995, y0: y0 - 0.025, h: 0.03, e: 10 }), mat(under)));
}
function cord(g, from, { relief, reliefColour = '#3b3d40', spring = false }) {
  const [x, y] = from;
  const reliefMat = mat(plastic(reliefColour, { roughness: 0.45 }));
  g.add(tube([[x - 0.03, y - 0.06], [x + 0.03, y + 0.06], [x + 0.1, y + 0.17], [x + 0.17, y + 0.24]], relief, reliefMat, 24));
  if (spring) { // a coiled spring guard round the strain relief
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(relief * 1.15, relief * 0.28, 8, 20), reliefMat);
      ring.position.set(x + 0.02 + t * 0.14, y + 0.04 + t * 0.19, 0);
      ring.rotation.set(Math.PI / 2, 0, -0.85);
      g.add(ring);
    }
  }
  g.add(tube([[x + 0.15, y + 0.22], [x + 0.24, y + 0.3], [x + 0.32, y + 0.33]], 0.022, mat({ color: '#18191b', roughness: 0.6 }), 12));
}
function lens(g, colour, x, y, z, r = 0.035, facing = 'side') {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: colour, emissive: colour, emissiveIntensity: 0.45, roughness: 0.15, clearcoat: 1 }));
  m.scale.y = 0.55;
  if (facing === 'side') m.rotation.x = Math.PI / 2; // dome facing +z
  m.position.set(x, y, z);
  g.add(m);
}
function dialTexture(face, print) {
  return canvasTexture(256, 256, (x, w) => {
    x.fillStyle = face;
    x.fillRect(0, 0, w, w);
    x.strokeStyle = print;
    x.fillStyle = print;
    x.lineWidth = 6;
    x.beginPath(); x.arc(128, 128, 96, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 24; i++) { // the scale round the edge
      const a = (i / 24) * Math.PI * 2;
      x.lineWidth = i % 6 ? 3 : 7;
      x.beginPath(); x.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116); x.stroke();
    }
    x.fillRect(122, 40, 12, 60); // the pointer
    x.font = 'bold 30px Arial';
    x.textAlign = 'center';
    x.fillText('O  •  ••', 128, 160);
  });
}
// a temperature dial set into a surface that slopes by 'slope' (dy/dx)
function dial(g, { x, y, r = 0.085, slope = 0, face = '#f2f2ef', print = '#444', bezel }) {
  const d = new THREE.Group();
  const top = mat({ map: dialTexture(face, print), roughness: 0.35, clearcoat: 0.6 });
  const side = mat(plastic(face));
  d.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.05, 40), [side, top, side]));
  const grip = rbox(r * 1.5, 0.04, 0.035, 0.012, side, 0, 0.04, 0); // the ridge you turn it by
  d.add(grip);
  if (bezel) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, 0.018, 10, 40), mat(bezel));
    ring.rotation.x = Math.PI / 2;
    d.add(ring);
  }
  d.position.set(x, y, 0);
  d.rotation.z = Math.atan(slope);
  g.add(d);
}

// 'modern' irons: one moulded shell, the grip arching from the nose to a tall heel over an open hole
// (Regular is built this way too, on a tall chrome soleplate and skirt)
const IRON_POSE = { elevation: 0.26, azimuth: -0.5, zoom: 1.06 }; // from the nose side, as photographed
const HEEL_TOP = 0.34;
function modernIron(name, { body, grip, deck, deckRange = [0.05, 0.8], sole, rim, soleH = 0.04, rimH = 0.07, mid = 0.25, gripY = [0.14, 0.29, 0.36, 0.38, 0.36, 0.3], gripR = 0.09,
  dialR = 0.085, dialFace = '#f2f2ef', dialPrint = '#555', bezel, lamp = '#ff3b2f', relief = '#c9cacc', spring = false, gripWidth = 1.5 }) {
  const g = new THREE.Group();
  const bodyMat = mat(body);
  soleplate(g, { finish: sole, y0: -0.44, h: soleH });
  g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u) * 0.995, y0: -0.45 + soleH, h: rimH, e: 8, taper: rimH > 0.1 ? 0.12 : 0 }), mat(rim ?? body))); // the skirt
  const base = -0.47 + soleH + rimH;
  const height = (u) => 0.07 + mid * smooth(0, 0.38, u) + (HEEL_TOP - base - 0.07 - mid) * smooth(0.64, 0.88, u);
  const section = (u) => ({ x: ix(u), w: IRON_W * outline(u) * 0.955, y0: base, h: height(u), e: 2.3, taper: 0.42 });
  g.add(loft(section, bodyMat));
  if (deck) { // a second colour over the top (the pink middle of the white-and-pink iron, the blue nose of the white-and-blue)
    g.add(loft((v) => {
      const s = section(deckRange[0] + v * (deckRange[1] - deckRange[0]));
      return { ...s, w: s.w * 1.01, h: s.h + 0.005 };
    }, mat(deck), { arc: [0.1, 0.9] }));
  }
  const top = (u) => base + height(u);
  const gripMesh = tube([[ix(0.12), top(0.12) - 0.05], [ix(0.22), top(0.22) + 0.02], ...[0.34, 0.48, 0.63, 0.78, 0.9, 0.98].map((u, i) => [ix(u), gripY[i]])], gripR, mat(grip ?? body), 72);
  gripMesh.scale.z = gripWidth;
  g.add(gripMesh);
  const u = 0.5;
  dial(g, { x: ix(u), y: top(u) + 0.01, r: dialR, slope: (top(u + 0.01) - top(u - 0.01)) / (IRON_L * 0.02), face: dialFace, print: dialPrint, bezel });
  const s = section(0.93);
  const yl = base + 0.23;
  lens(g, lamp, ix(0.93), yl, sideZ(s, yl) - 0.004, 0.032);
  cord(g, [ix(0.97), top(0.97) - 0.02], { relief: 0.042, reliefColour: relief, spring });
  return shell(name, g, { pose: IRON_POSE });
}

// 'classic' irons: chrome soleplate and hood, a plastic handle frame on top
function classicIron(name, { handle, hood = CHROME, hoodHeight = 0.26, sole = CHROME, slim = false, switchPlate = false, noseLens, knobDial, amberLens, labelOnBase = false, lamp, cap }) {
  const g = new THREE.Group();
  const handleMat = mat(handle);
  soleplate(g, { finish: sole, y0: -0.44, h: 0.1 });
  const hoodTop = (u) => -0.35 + hoodHeight * (0.5 + 0.38 * smooth(0, 0.55, u) + 0.12 * u); // up from the nose, then nearly level
  g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u) * 0.93, y0: -0.35, h: hoodTop(u) + 0.35, e: 2.3, taper: 0.28 }), mat(hood)));
  // the base the handle stands on, following the hood's slope
  g.add(loft((v) => {
    const u = 0.2 + v * 0.78;
    return { x: ix(u), w: (slim ? 0.11 : 0.21) * Math.sqrt(Math.sin(Math.PI * Math.min(1, v * 1.6 + 0.05)) + 0.05), y0: hoodTop(u) - 0.05, h: 0.08, e: 4 };
  }, handleMat));
  const gripTop = slim ? 0.36 : 0.48;
  const gh = slim ? 0.11 : 0.2;
  const gd = slim ? 0.16 : 0.26;
  const x0 = ix(slim ? 0.24 : 0.15), x1 = ix(0.95);
  g.add(rbox(x1 - x0, gh, gd, 0.06, handleMat, (x0 + x1) / 2, gripTop - gh / 2)); // the grip
  const tower = { x: ix(0.86), w: slim ? 0.2 : 0.26, d: slim ? 0.22 : 0.3 };
  const tb = hoodTop(0.86) - 0.03;
  g.add(rbox(tower.w, gripTop - tb, tower.d, 0.05, handleMat, tower.x, (gripTop + tb) / 2)); // the rear tower
  const fb = hoodTop(0.33) - 0.03;
  const post = rbox(0.12, gripTop - gh / 2 - fb + 0.06, gd * 0.85, 0.04, handleMat, ix(slim ? 0.3 : 0.27), (gripTop - gh / 2 + fb) / 2); // the front post
  post.rotation.z = 0.32; // leaning forward, under the front of the grip
  g.add(post);
  if (cap) g.add(rbox(0.17, 0.05, tower.d * 0.8, 0.02, mat(cap), tower.x + 0.02, gripTop + 0.01)); // a dark cap where the cord enters
  if (switchPlate) { // a white rocker switch on the side of the tower
    const plate = rbox(0.13, 0.2, 0.02, 0.008, mat(plastic('#f4f4f1')), tower.x - 0.01, gripTop - 0.17, tower.d / 2 + 0.005);
    const rocker = rbox(0.06, 0.12, 0.03, 0.01, mat(plastic('#ffffff')), tower.x - 0.01, gripTop - 0.17, tower.d / 2 + 0.018);
    rocker.rotation.x = 0.12;
    g.add(plate, rocker);
    for (const dy of [0.085, -0.085]) {
      const screw = cyl(0.012, 0.012, 0.01, mat(ZINC), 12);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(tower.x - 0.01, gripTop - 0.17 + dy, tower.d / 2 + 0.017);
      g.add(screw);
    }
  }
  if (noseLens) { // the orange reflector in the front end of the grip
    const l = cyl(0.055, 0.055, 0.02, mat({ color: noseLens, emissive: noseLens, emissiveIntensity: 0.35, roughness: 0.2, clearcoat: 1 }), 24);
    l.rotation.z = Math.PI / 2;
    l.position.set(x0 - 0.002, gripTop - gh / 2, 0);
    g.add(l);
  }
  if (knobDial) dial(g, { x: ix(0.52), y: hoodTop(0.52) + 0.04, r: slim ? 0.09 : 0.1, slope: (hoodTop(0.53) - hoodTop(0.51)) / (IRON_L * 0.02), ...knobDial });
  if (amberLens) lens(g, amberLens, ix(0.52), hoodTop(0.52) + 0.025, 0, 0.09, 'top');
  if (labelOnBase) { // the rating label on the base under the grip
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), mat({ map: ratingLabel(), roughness: 0.4 }));
    label.position.set(ix(0.56), hoodTop(0.56) + 0.03, 0.2);
    label.rotation.set(-0.35, 0, Math.atan((hoodTop(0.6) - hoodTop(0.52)) / (IRON_L * 0.08)));
    g.add(label);
  }
  if (lamp) lens(g, lamp, tower.x + 0.02, gripTop - 0.1, tower.d / 2 + 0.002, 0.028);
  cord(g, [tower.x + 0.1, gripTop - 0.02], { relief: 0.035, reliefColour: '#202124' });
  return shell(name, g, { pose: IRON_POSE });
}
let ratingLabelTexture;
function ratingLabel() {
  ratingLabelTexture ??= canvasTexture(256, 96, (x, w, h) => {
    x.fillStyle = '#f6f6f2';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#333';
    for (let i = 0; i < 6; i++) x.fillRect(12, 10 + i * 13, 140 + (i % 3) * 30, 5);
    x.strokeStyle = '#333';
    x.lineWidth = 2;
    x.strokeRect(4, 4, w - 8, h - 8);
  });
  return ratingLabelTexture;
}

// 'plancha' irons: a chrome hood, a tall rounded rear body and a looped grip
function planchaIron(name, { body, sole = CHROME, under, band, hood = CHROME, lamp = '#ff7a1f', label = true, lever = false, ribs = false }) {
  const g = new THREE.Group();
  const bodyMat = mat(body);
  if (band) { // the heavyweight iron: a dark soleplate, a chrome band, then the body colour
    soleplate(g, { finish: sole, y0: -0.45, h: 0.035 });
    g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u) * 0.985, y0: -0.42, h: 0.08, e: 10 }), mat(band)));
  } else {
    soleplate(g, { finish: sole, y0: -0.43, h: 0.09, under });
  }
  const hoodTop = (u) => -0.33 + (band ? 0.24 : 0.17) * (0.6 + 0.4 * u);
  g.add(loft((u) => ({ x: ix(u), w: IRON_W * outline(u) * (band ? 0.95 : 0.92), y0: -0.34, h: hoodTop(u) + 0.34, e: 2.4, taper: 0.25 }), mat(hood)));
  const rear = (v) => {
    const u = 0.32 + v * 0.66;
    return { x: ix(u), w: IRON_W * outline(u) * (0.72 + 0.12 * v), y0: hoodTop(u) - 0.04, h: 0.2 + 0.4 * smooth(0, 0.5, v), e: 2.6, taper: 0.38 };
  };
  g.add(loft(rear, bodyMat));
  if (band) { // the heavyweight iron's body rises from the nose too, so the handle is a window through it
    g.add(loft((v) => {
      const u = 0.1 + v * 0.26;
      return { x: ix(u), w: IRON_W * outline(u) * 0.86, y0: hoodTop(u) - 0.04, h: 0.12 + 0.36 * smooth(0, 0.8, v), e: 2.6, taper: 0.4 };
    }, bodyMat));
  }
  const grip = tube([[ix(0.2), hoodTop(0.2) - 0.03], [ix(0.22), 0.08], [ix(0.28), 0.27], [ix(0.39), 0.36], [ix(0.55), 0.38], [ix(0.7), 0.36], [ix(0.82), 0.3]], band ? 0.095 : 0.09, bodyMat, 64);
  grip.scale.z = 1.15;
  g.add(grip);
  // the temperature ring round the front of the grip
  const ringSide = mat(plastic(band ? '#1f2023' : '#f6f6f3'));
  const ring = cyl(0.105, 0.105, 0.07, [ringSide, mat({ map: dialTexture(band ? '#1f2023' : '#f6f6f3', band ? '#ddd' : '#333') }), ringSide], 32);
  ring.position.set(ix(0.225), 0.12, 0);
  ring.rotation.z = 0.45;
  g.add(ring);
  if (ribs) { // the ribbed temperature strip along the bottom of the hole under the grip
    const ribMat = mat(plastic('#e8e8e4'));
    for (let i = 0; i < 6; i++) {
      const s = rear((0.4 + i * 0.035 - 0.32) / 0.66);
      g.add(rbox(0.045, 0.04, 0.16, 0.012, ribMat, s.x, s.y0 + s.h + 0.01, 0));
    }
  }
  if (lever) g.add(rbox(0.07, 0.05, 0.12, 0.015, bodyMat, ix(0.16), hoodTop(0.16) + 0.03, 0.12));
  const s = rear(0.85);
  lens(g, lamp, s.x, 0.04, sideZ(s, 0.04) - 0.004, 0.04);
  if (label) {
    const sl = rear(0.45);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.15), mat({ map: ratingLabel(), color: '#d9dadc', metalness: 0.6, roughness: 0.3 }));
    const yl = sl.y0 + 0.07;
    plate.position.set(sl.x, yl, sideZ(sl, yl) + 0.004);
    plate.rotation.x = -0.3;
    g.add(plate);
  }
  const sr = rear(1);
  cord(g, [ix(0.96), sr.y0 + sr.h - 0.04], { relief: 0.04, reliefColour: band ? '#1c1d1f' : '#d9dad8', spring: !band });
  return { g, bodyMat };
}

const CREAM = '#ece5d2';
const IRONS = {
  // BMW (photo 129): red grip over a black shell, a bronze soleplate, black dial, sprung cord guard
  'electric-irons-bmw': () => modernIron('bmw', { body: plastic('#1c1d20'), grip: plastic('#e3261f', { clearcoat: 1 }), sole: { color: '#8a6a2e', metalness: 0.9, roughness: 0.3 }, rim: plastic('#232427'), mid: 0.36, gripY: [0.06, 0.2, 0.28, 0.31, 0.32, 0.3], gripR: 0.1, gripWidth: 2.6, dialFace: '#1b1c1e', dialPrint: '#c9a24a', bezel: { color: '#2b2c2f', roughness: 0.3 }, lamp: '#ff2a2a', relief: '#202124', spring: true }),
  'electric-irons-new-white-grey': () => modernIron('white-grey', { body: plastic('#f3f3f0'), grip: plastic('#6b6d70'), sole: { color: '#1a1b1d', roughness: 0.4 }, dialFace: '#8d8f92', dialPrint: '#2a2b2d', bezel: plastic('#d9d9d6'), lamp: '#f0a03a', relief: '#d7d8d6' }),
  'electric-irons-new-white-blue': () => modernIron('white-blue', { body: plastic('#f3f3f0'), grip: plastic('#2fa7e6'), deck: plastic('#2fa7e6'), deckRange: [0.03, 0.4], sole: { color: '#1a1b1d', roughness: 0.4 }, dialFace: '#f4f1e8', dialPrint: '#666', lamp: '#e0141e', relief: '#d7d8d6' }),
  'electric-irons-new-white-pink': () => modernIron('white-pink', { body: plastic('#f4f4f1'), deck: plastic('#e8195c'), sole: { color: '#1a1b1d', roughness: 0.4 }, dialFace: '#f1f1ee', dialPrint: '#666', bezel: { color: '#c9cbce', metalness: 0.8, roughness: 0.25 }, lamp: '#ff3b2f', relief: '#cfd0ce', spring: true }),
  'electric-irons-new-black': () => modernIron('black', { body: plastic('#3a3c40', { metalness: 0.2 }), grip: plastic('#2a2b2e'), sole: { color: '#1a1b1d', roughness: 0.4 }, rim: plastic('#2a2b2e'), dialFace: '#1d1e20', dialPrint: '#bbb', bezel: { color: '#a9abae', metalness: 0.9, roughness: 0.25 }, lamp: '#d81e2a', relief: '#1d1e20' }),
  // Regular (photo 126): a charcoal hood and handle on a chrome soleplate, a big black dial, red lamp
  'electric-irons-regular': () => modernIron('regular', { body: plastic('#4d5055', { metalness: 0.2 }), grip: plastic('#3f4247', { metalness: 0.2 }), sole: CHROME, rim: CHROME, soleH: 0.09, rimH: 0.15, mid: 0.08, gripY: [0.1, 0.25, 0.32, 0.34, 0.33, 0.3], gripWidth: 1.5, dialR: 0.12, dialFace: '#141517', dialPrint: '#d6d6d6', lamp: '#e8202a', relief: '#202124' }),
  // Grand (photo 132): blue handle with a rocker switch and an orange nose reflector, chrome all over
  'electric-irons-grand': () => classicIron('grand', { handle: plastic('#2f8fd8'), hoodHeight: 0.42, switchPlate: true, noseLens: '#f26a1b', labelOnBase: true }),
  // Bold (photo 133): the same build in yellow, with an amber lens in the base
  'electric-irons-bold': () => classicIron('bold', { handle: plastic('#f3b12a'), hoodHeight: 0.42, switchPlate: true, amberLens: '#d9680f' }),
  // the light blue iron (photo 125): a slim blue handle frame, a black dial and a black cord cap
  'electric-irons-new-blue': () => classicIron('new-blue', { handle: plastic('#2a7fd6'), hoodHeight: 0.32, slim: true, knobDial: { face: '#18191b', print: '#bbb', bezel: { color: '#9a9ca0', metalness: 0.8 } }, cap: plastic('#1c1d1f') }),
  // Plancha (photos 134 white, 136 cream): the finish switch shows both
  'electric-irons-plancha': () => {
    const { g, bodyMat } = planchaIron('plancha', { body: plastic('#f4f4f1'), under: { color: '#b8774b', metalness: 0.9, roughness: 0.35 }, ribs: true });
    return shell('plancha', g, {
      pose: IRON_POSE,
      setFinish(key) { bodyMat.color.set(key === 'cream' ? CREAM : '#f4f4f1'); },
    });
  },
  // the heavyweight black iron (photo 135): black body, a chrome band over a dark soleplate
  'electric-irons-new-heavy-black': () => {
    const { g } = planchaIron('heavy-black', { body: plastic('#1e1f22'), hood: plastic('#1e1f22'), sole: { color: '#2a2b2e', roughness: 0.4 }, band: CHROME, lamp: '#ff5a14', label: false, lever: true, ribs: true });
    return shell('heavy-black', g, { pose: IRON_POSE });
  },
};

// ================================================================ Cabin Fan 12" (photo 79)
function cabinFan() {
  const g = new THREE.Group();
  const white = mat(plastic('#f1f1ee', { roughness: 0.35 }));
  const shade = mat(plastic('#e4e4e0', { roughness: 0.45 }));
  // the drum: a thick-walled cup, open at the front, its lip rolled; lathed round y then turned to face +z
  const profile = [[0.16, -0.42], [0.6, -0.42], [0.76, -0.36], [0.8, -0.24], [0.8, 0.12], [0.795, 0.18], [0.77, 0.215], [0.73, 0.215], [0.71, 0.19], [0.705, 0.12], [0.705, -0.3], [0.2, -0.32]];
  const drum = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 96), white);
  drum.geometry.rotateX(Math.PI / 2);
  g.add(drum);
  // the swirl vanes of the front grille, from the badge out to the lip
  for (let i = 0; i < 24; i++) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, r = 0.2 + 0.51 * t, a = (i / 24) * Math.PI * 2 + t * 1.05 + t * t * 0.25;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -t * 0.012));
    }
    const vane = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.011, 6), white);
    vane.scale.z = 2.6; // deep, thin blades (drawn at z = 0 so the scale doesn't move them)
    vane.position.z = 0.16;
    g.add(vane);
  }
  const support = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.008, 6, 72), white); // a thin ring behind the vanes
  support.position.z = 0.12;
  g.add(support);
  const badgeTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#f4f4f1';
    x.fillRect(0, 0, w, w);
    x.fillStyle = '#3a3a3a';
    x.font = 'bold 34px Arial';
    x.textAlign = 'center';
    x.fillText('APARNA', 140, 138);
    x.lineWidth = 3;
    x.strokeStyle = '#3a3a3a';
    x.beginPath(); x.arc(60, 126, 12, 0, Math.PI * 2); x.stroke();
  });
  const badge = cyl(0.21, 0.215, 0.05, white, 64);
  badge.rotation.x = Math.PI / 2;
  badge.position.z = 0.165;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.205, 64), mat({ map: badgeTex, roughness: 0.3, clearcoat: 0.6 }));
  face.position.z = 0.191;
  g.add(badge, face);
  // the stand: a short neck from under the drum to a round foot
  const neck = rbox(0.16, 0.16, 0.14, 0.05, white, 0, -0.84, -0.14);
  const foot = cyl(0.2, 0.23, 0.06, white, 48);
  foot.position.set(0, -0.93, -0.14);
  g.add(neck, foot);
  // the fan inside: five white blades on a hub, turning about the drum's axis
  const axis = new THREE.Group();
  axis.position.z = 0.0;
  axis.rotation.x = Math.PI / 2;
  const rotor = new THREE.Group();
  rotor.add(cyl(0.12, 0.12, 0.1, shade, 28));
  for (let i = 0; i < 5; i++) {
    const b = rbox(0.46, 0.01, 0.2, 0.004, shade, 0.38, 0, 0);
    b.rotation.x = -0.45;
    const p = new THREE.Group();
    p.rotation.y = (i / 5) * Math.PI * 2;
    p.add(b);
    rotor.add(p);
  }
  axis.add(rotor);
  return shell('cabin-fan', g, { rotor, axis, pose: { elevation: 0.12, azimuth: 0.85, zoom: 0.98 } });
}

// ================================================================ cooler motors (photos 148-155)
const MOTOR_PAINT = { color: '#3a3f46', metalness: 0.55, roughness: 0.38, clearcoat: 0.3 }; // dark grey enamel
let motorLabelTexture;
function motorLabel() {
  motorLabelTexture ??= canvasTexture(512, 200, (x, w, h) => {
    x.fillStyle = '#f7f7f4';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#d52027';
    x.fillRect(0, h - 34, w, 34);
    x.fillStyle = '#ffffff';
    x.font = 'bold 18px Arial';
    x.fillText('MADE BY: APARNA ENTERPRISES, NEW DELHI, INDIA', 14, h - 11);
    x.fillStyle = '#222';
    x.font = 'bold 20px Arial';
    x.fillText('CAPACITOR Start & Run 1-Ph. Motor', 92, 30);
    x.font = '15px Arial';
    for (let i = 0; i < 5; i++) x.fillRect(92, 48 + i * 22, 230 - (i % 2) * 50, 7);
    x.fillStyle = '#d52027'; // the "energy efficient motor" seal
    x.beginPath(); x.arc(420, 82, 50, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 15px Arial';
    x.textAlign = 'center';
    x.fillText('ENERGY', 420, 72); x.fillText('EFFICIENT', 420, 90); x.fillText('MOTOR', 420, 108);
    x.fillStyle = '#d52027';
    x.font = 'bold 22px Arial';
    x.fillText('APARNA', 46, 98);
  });
  return motorLabelTexture;
}
function bolt(material, x, y, z, r = 0.03, h = 0.03) {
  const b = cyl(r, r, h, material, 6);
  b.position.set(x, y, z);
  return b;
}
function motor(name, { r, h, top = 'flat', fins, ring, clamps, wings, capacitor = false, holes = false, labelY = 0.15, labelAround = 0, topBolts = 6, shaft = 0.5, studs = 0.12 }) {
  const g = new THREE.Group();
  const paint = mat(MOTOR_PAINT);
  const zinc = mat(ZINC);
  const y0 = -h / 2 - 0.1; // the can's bottom
  const y1 = y0 + h; // its top
  // the can, with softly rounded edges top and bottom
  const prof = top === 'dome'
    ? [[0, y0], [r - 0.03, y0], [r, y0 + 0.03], [r, y1 - 0.12], [r * 0.95, y1 - 0.04], [r * 0.7, y1], [0.1, y1 + 0.02], [0, y1 + 0.02]]
    : [[0, y0], [r - 0.03, y0], [r, y0 + 0.03], [r, y1 - 0.03], [r - 0.03, y1], [0, y1]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 72), paint));
  for (const t of [0.22, 0.78]) { // the joints between the end shields and the body
    const seam = new THREE.Mesh(new THREE.TorusGeometry(r + 0.002, 0.006, 6, 72), mat({ color: '#18191b', roughness: 0.6 }));
    seam.rotation.x = Math.PI / 2;
    seam.position.y = y0 + h * t;
    g.add(seam);
  }
  // the boss round the shaft, and the bolts round the top cover
  const boss = cyl(0.12, 0.15, 0.07, paint, 32);
  boss.position.y = y1 + (top === 'dome' ? 0.05 : 0.03);
  g.add(boss);
  for (let i = 0; i < topBolts; i++) {
    const a = (i / topBolts) * Math.PI * 2 + 0.3;
    g.add(bolt(zinc, Math.cos(a) * r * 0.72, y1 + 0.012, Math.sin(a) * r * 0.72, 0.028, 0.025));
  }
  if (fins) { // cooling fins round the body, leaving a flat for the label where it overlaps them
    const labelLow = (0.5 + labelY / h) - 0.1 / h, labelHigh = (0.5 + labelY / h) + 0.1 / h;
    const overlaps = labelLow < fins[1] && labelHigh > fins[0];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      if (overlaps && Math.abs(Math.atan2(Math.cos(a), Math.sin(a)) - labelAround) < 0.72) continue;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * (fins[1] - fins[0]), 0.028), paint);
      fin.position.set(Math.cos(a) * (r + 0.03), y0 + h * (fins[0] + fins[1]) / 2, Math.sin(a) * (r + 0.03));
      fin.rotation.y = -a;
      g.add(fin);
    }
  }
  if (ring) { // a mounting ring round the upper body, with lugs
    const yr = y0 + h * ring;
    const band = cyl(r * 1.1, r * 1.1, 0.12, paint, 72);
    band.position.y = yr;
    g.add(band);
    for (const a of [0.2, Math.PI / 2 + 0.2, Math.PI + 0.2, -Math.PI / 2 + 0.2]) {
      g.add(rbox(0.1, 0.1, 0.1, 0.02, paint, Math.cos(a) * r * 1.15, yr, Math.sin(a) * r * 1.15));
      g.add(bolt(zinc, Math.cos(a) * r * 1.15, yr + 0.06, Math.sin(a) * r * 1.15, 0.022, 0.03));
    }
  }
  if (clamps) { // clamp lugs on either side, with bolts standing out
    const yc = y0 + h * clamps.at;
    if (clamps.tall) { // the clamp band they hang from
      const band = cyl(r + 0.03, r + 0.03, 0.24, paint, 72);
      band.position.y = yc;
      g.add(band);
    }
    for (const sx of [-1, 1]) {
      g.add(rbox(0.14, clamps.tall ? 0.2 : 0.12, 0.26, 0.02, paint, sx * (r + 0.05), yc, 0));
      for (const dz of clamps.tall ? [-0.07, 0.07] : [0]) {
        const b = cyl(0.03, 0.03, 0.12, zinc, 6);
        b.rotation.z = Math.PI / 2;
        b.position.set(sx * (r + 0.15), yc, dz);
        g.add(b);
        const nut = cyl(0.045, 0.045, 0.04, zinc, 6);
        nut.rotation.z = Math.PI / 2;
        nut.position.set(sx * (r + 0.13), yc, dz);
        g.add(nut);
      }
    }
  }
  if (wings) { // a flat flange with two pointed tabs to bolt it down
    const s = new THREE.Shape();
    const R = r * 1.06, T = r * (wings.wide ? 1.55 : 1.4);
    s.moveTo(T, 0.09);
    s.absarc(0, 0, R, 0.25, Math.PI - 0.25, false);
    s.lineTo(-T, 0.09); s.lineTo(-T, -0.09);
    s.absarc(0, 0, R, Math.PI + 0.25, -0.25, false);
    s.lineTo(T, -0.09); s.closePath();
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false, curveSegments: 36 }), paint);
    plate.geometry.rotateX(Math.PI / 2);
    plate.position.y = y0 + h * wings.at + 0.02;
    g.add(plate);
    for (const sx of [-1, 1]) g.add(bolt(zinc, sx * (T - 0.07), y0 + h * wings.at + 0.035, 0, 0.032, 0.05));
  }
  // the rating label, wrapped round the side facing the camera
  const label = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.004, r + 0.004, 0.2, 48, 1, true, -0.62 + labelAround, 1.24), mat({ map: motorLabel(), roughness: 0.45 }));
  label.position.y = y0 + h * 0.5 + labelY;
  g.add(label);
  if (holes) for (const [a, yy] of [[-0.9, 0.32], [-0.95, -0.32]]) { // the two drain holes
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), mat({ color: '#f4f4f0', roughness: 0.6 }));
    d.position.set(Math.sin(a) * (r + 0.005), y0 + h * 0.5 + yy, Math.cos(a) * (r + 0.005));
    d.rotation.y = a;
    g.add(d);
  }
  // studs underneath
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const s = cyl(0.022, 0.022, studs, zinc, 8);
    s.position.set(Math.cos(a) * r * 0.62, y0 - studs / 2, Math.sin(a) * r * 0.62);
    g.add(s, bolt(zinc, s.position.x, y0 - studs * 0.35, s.position.z, 0.04, 0.03));
  }
  if (capacitor) { // the run capacitor standing beside it, wired in
    const cap = cyl(0.13, 0.13, 0.42, mat(plastic('#f4f4f1')), 32);
    cap.position.set(r + 0.32, y0 + 0.24, 0.12);
    g.add(cap);
    g.add(tube([[r + 0.2, y0 + 0.2, 0.1], [r + 0.08, y0 + 0.18, 0.04], [r - 0.02, y0 + 0.2, 0]], 0.03, mat({ color: '#2a2b2e', roughness: 0.6 }), 12));
  }
  // the shaft turns (a keyway shows it going round)
  const rotor = new THREE.Group();
  const brass = mat(BRASS);
  const sh = cyl(0.05, 0.05, shaft, brass, 24);
  sh.position.y = y1 + 0.06 + shaft / 2;
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.02, shaft * 0.5, 0.05), mat({ color: '#6b5426', metalness: 0.8, roughness: 0.4 }));
  key.position.set(0.05, y1 + 0.06 + shaft * 0.7, 0);
  rotor.add(sh, key);
  return shell(name, g, { rotor, pose: { elevation: 0.22, azimuth: 0.15, zoom: 1.15, fill: 0.8 } });
}
const MOTORS = {
  'motors-cooler-motor-1': () => motor('cooler-motor-1', { r: 0.4, h: 1.1, fins: [0.36, 0.74], labelY: 0.4, shaft: 0.48, topBolts: 4 }),
  'motors-cooler-motor-2': () => motor('cooler-motor-2', { r: 0.46, h: 1.0, ring: 0.66, labelY: 0.19, shaft: 0.36 }),
  'motors-cooler-motor-3': () => motor('cooler-motor-3', { r: 0.56, h: 0.68, fins: [0.08, 0.42], clamps: { at: 0.5 }, capacitor: true, labelY: 0.1, shaft: 0.42, studs: 0.18, topBolts: 8 }),
  'motors-cooler-motor-4': () => motor('cooler-motor-4', { r: 0.58, h: 0.92, holes: true, labelY: -0.02, labelAround: 0.25, shaft: 0.5 }),
  'motors-cooler-motor-5': () => motor('cooler-motor-5', { r: 0.55, h: 0.98, clamps: { at: 0.36, tall: true }, labelY: 0.17, shaft: 0.45, topBolts: 8 }),
  'motors-cooler-motor-6': () => motor('cooler-motor-6', { r: 0.54, h: 0.98, labelY: -0.12, labelAround: 0.3, shaft: 0.45, topBolts: 8 }),
  'motors-cooler-motor-7': () => motor('cooler-motor-7', { r: 0.48, h: 1.0, wings: { at: 0.5 }, labelY: 0.18, shaft: 0.34 }),
  'motors-cooler-motor-8': () => motor('cooler-motor-8', { r: 0.53, h: 0.92, top: 'dome', wings: { at: 0.42, wide: true }, labelY: 0.12, shaft: 0.5, topBolts: 0 }),
};

// ================================================================ cooler pumps (photos 156-161)
function nozzle(g, material, x, y, z = 0, scale = 1) { // the barbed hose outlet on top
  const n = new THREE.Group();
  const base = cyl(0.1, 0.11, 0.08, material, 28);
  base.position.y = 0.04;
  const neck = cyl(0.07, 0.075, 0.12, material, 24);
  neck.position.y = 0.14;
  n.add(base, neck);
  for (let i = 0; i < 3; i++) { // barbs
    const barb = cyl(0.055, 0.075, 0.06, material, 24);
    barb.position.y = 0.22 + i * 0.06;
    n.add(barb);
  }
  const lip = cyl(0.05, 0.05, 0.03, material, 24);
  lip.position.y = 0.4;
  n.add(lip);
  n.scale.setScalar(scale);
  n.position.set(x, y, z);
  g.add(n);
}
// a grille of bars on a face: 'face' is '-x' or '+z'; c is the face centre, w x h its size
function slots(g, material, back, { face, c, w, h, n, vertical = true, round = false, depth = 0.02 }) {
  const holder = new THREE.Group();
  const recess = new THREE.Mesh(round ? new THREE.CircleGeometry(Math.min(w, h) / 2, 40) : new THREE.PlaneGeometry(w, h), back);
  holder.add(recess);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    let len = vertical ? h : w;
    if (round) len = Math.min(w, h) * Math.sqrt(Math.max(0, 0.25 - t * t)) * 2 * 0.92;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(vertical ? (w / n) * 0.45 : len, vertical ? len : (h / n) * 0.45, depth), material);
    if (vertical) bar.position.x = t * w; else bar.position.y = t * h;
    bar.position.z = depth / 2;
    holder.add(bar);
  }
  holder.position.set(...c);
  if (face === '-x') holder.rotation.y = -Math.PI / 2;
  g.add(holder);
}
function studGrid(g, material, back, { face, c, w, h, cols, rows }) { // a grid of square openings (pump 2)
  const holder = new THREE.Group();
  holder.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), back));
  for (let i = 0; i <= cols; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.022, h, 0.03), material);
    bar.position.set((i / cols - 0.5) * w, 0, 0.015);
    holder.add(bar);
  }
  for (let j = 0; j <= rows; j++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.03), material);
    bar.position.set(0, (j / rows - 0.5) * h, 0.015);
    holder.add(bar);
  }
  holder.position.set(...c);
  if (face === '-x') holder.rotation.y = -Math.PI / 2;
  g.add(holder);
}
const PUMP_POSE = { elevation: 0.32, azimuth: -0.6, zoom: 1.0, fill: 0.82 };
const MATTE = { roughness: 0.62, clearcoat: 0 }; // pump bodies are matt moulded plastic
const pumpDark = () => mat(plastic('#4b4e53', MATTE));
const pumpWhite = () => mat(plastic('#eeeeea', MATTE));
const hole = () => mat({ color: '#2a2b2d', roughness: 0.8 });

const PUMPS = {
  // pump 1 (156): white front block with a round slotted grille, dark grey rear, a white end cap
  'pumps-cooler-pump-1': () => {
    const g = new THREE.Group();
    const white = pumpWhite(), dark = pumpDark();
    g.add(rbox(0.72, 0.95, 0.85, 0.16, white, -0.32, -0.02, 0));
    g.add(rbox(0.62, 0.92, 0.82, 0.1, dark, 0.3, 0, 0));
    g.add(rbox(0.08, 0.9, 0.8, 0.04, white, 0.62, 0, 0));
    slots(g, white, hole(), { face: '-x', c: [-0.685, -0.12, 0], w: 0.5, h: 0.5, n: 9, round: true });
    nozzle(g, dark, -0.1, 0.43, 0, 1.1);
    g.add(rbox(0.3, 0.12, 0.05, 0.03, mat(plastic('#e2e2de')), 0.3, -0.26, 0.42)); // the cable slot
    for (const x of [0.15, 0.42]) g.add(rbox(0.12, 0.07, 0.7, 0.02, dark, x, -0.5, 0)); // feet
    return shell('cooler-pump-1', g, { pose: PUMP_POSE });
  },
  // pump 2 (157): light grey gridded inlet block, a white band, dark grey body
  'pumps-cooler-pump-2': () => {
    const g = new THREE.Group();
    const grey = mat(plastic('#d9dad8', { roughness: 0.5 })), white = pumpWhite(), dark = pumpDark();
    g.add(rbox(0.4, 0.9, 0.8, 0.06, grey, -0.5, -0.02, 0));
    studGrid(g, grey, hole(), { face: '-x', c: [-0.705, -0.02, 0], w: 0.68, h: 0.78, cols: 6, rows: 7 });
    studGrid(g, grey, hole(), { face: '+z', c: [-0.5, -0.02, 0.405], w: 0.34, h: 0.78, cols: 3, rows: 7 });
    g.add(rbox(0.26, 0.92, 0.82, 0.06, white, -0.17, 0, 0));
    g.add(rbox(0.66, 0.92, 0.82, 0.08, dark, 0.28, 0, 0));
    nozzle(g, dark, -0.17, 0.44, 0, 1.0);
    return shell('cooler-pump-2', g, { pose: PUMP_POSE });
  },
  // pump 3 (158): a dark slotted box with a lighter grey rear half and a big outlet
  'pumps-cooler-pump-3': () => {
    const g = new THREE.Group();
    const dark = mat(plastic('#41444a', MATTE)), light = mat(plastic('#7d8189', MATTE));
    g.add(rbox(0.88, 0.8, 0.92, 0.08, dark, -0.26, 0, 0));
    g.add(rbox(0.62, 0.78, 0.9, 0.08, light, 0.42, 0, 0));
    slots(g, dark, hole(), { face: '-x', c: [-0.705, -0.05, 0], w: 0.72, h: 0.5, n: 8, vertical: false });
    slots(g, dark, hole(), { face: '+z', c: [-0.36, -0.05, 0.462], w: 0.56, h: 0.5, n: 8, vertical: false });
    for (let i = 0; i < 5; i++) g.add(rbox(0.025, 0.14, 0.02, 0.008, hole(), 0.32 + i * 0.07, -0.28, 0.452));
    nozzle(g, mat(plastic('#33363b')), -0.32, 0.4, 0, 1.35);
    return shell('cooler-pump-3', g, { pose: PUMP_POSE });
  },
  // pump 4 (159): an upright finned body with a cream cap, a slotted cream filter out front, on a foot plate
  'pumps-cooler-pump-4': () => {
    const g = new THREE.Group();
    const dark = mat(plastic('#4a5058', { roughness: 0.45 })), cream = mat(plastic('#e8e4d6', { roughness: 0.5 }));
    g.add(rbox(0.5, 0.95, 0.6, 0.05, dark, 0.05, 0.02, 0));
    for (let i = 0; i < 5; i++) g.add(rbox(0.5, 0.03, 0.64, 0.01, dark, 0.05, -0.32 + i * 0.12, 0));
    g.add(rbox(0.32, 0.9, 0.62, 0.06, cream, 0.42, 0.04, 0));
    g.add(rbox(1.0, 0.1, 0.7, 0.04, dark, 0.05, -0.5, 0)); // the foot plate
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.36), mat({ map: motorLabel(), roughness: 0.4 }));
    label.position.set(0.05, 0.26, 0.322);
    g.add(label);
    const filter = cyl(0.25, 0.25, 0.42, cream, 40); // the inlet filter, pointing out to -x
    filter.rotation.z = Math.PI / 2;
    filter.position.set(-0.42, -0.18, 0);
    const collar = cyl(0.3, 0.3, 0.1, cream, 40);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(-0.22, -0.18, 0);
    g.add(filter, collar);
    for (let i = 0; i < 3; i++) {
      const slot = new THREE.Mesh(new THREE.TorusGeometry(0.252, 0.012, 6, 40, Math.PI * 1.2), hole());
      slot.rotation.y = Math.PI / 2;
      slot.rotation.z = Math.PI * 0.15;
      slot.position.set(-0.5 + i * 0.09, -0.18, 0);
      g.add(slot);
    }
    nozzle(g, dark, -0.1, 0.48, 0, 1.0);
    return shell('cooler-pump-4', g, { pose: PUMP_POSE });
  },
  // pump 5 (160): a round body lying on its side, a perforated grey end, a darker ribbed rear, on suction feet
  'pumps-cooler-pump-5': () => {
    const g = new THREE.Group();
    const light = mat(plastic('#b9bcc0', { roughness: 0.5 })), dark = mat(plastic('#6a6e75', { roughness: 0.45 }));
    const front = cyl(0.46, 0.46, 0.55, light, 48);
    front.rotation.z = Math.PI / 2;
    front.position.x = -0.3;
    const rear = cyl(0.42, 0.42, 0.55, dark, 48);
    rear.rotation.z = Math.PI / 2;
    rear.position.x = 0.24;
    g.add(front, rear);
    for (let i = 0; i < 8; i++) { // ribs round the rear
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.014, 6, 48), dark);
      rib.rotation.y = Math.PI / 2;
      rib.position.x = 0.02 + i * 0.065;
      g.add(rib);
    }
    const perf = canvasTexture(256, 256, (x, w) => {
      x.fillStyle = '#c2c5c9';
      x.fillRect(0, 0, w, w);
      x.fillStyle = '#4a4c50';
      for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) if (i * i + j * j < 72) { x.beginPath(); x.arc(128 + i * 12, 128 + j * 12, 3.6, 0, Math.PI * 2); x.fill(); }
    });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), mat({ map: perf, roughness: 0.5 }));
    face.rotation.y = -Math.PI / 2;
    face.position.x = -0.578;
    g.add(face);
    g.add(rbox(0.36, 0.16, 0.6, 0.05, light, -0.3, 0.42, 0));
    nozzle(g, light, -0.3, 0.48, 0, 0.9);
    const black = mat({ color: '#1b1c1e', roughness: 0.5 });
    for (const [x, z] of [[-0.35, 0.3], [-0.35, -0.3], [0.3, 0.3], [0.3, -0.3]]) {
      const leg = rbox(0.08, 0.24, 0.07, 0.025, light, x, -0.46, z); // up into the body
      const cup = cyl(0.06, 0.09, 0.05, black, 20);
      cup.position.set(x, -0.6, z);
      g.add(leg, cup);
    }
    return shell('cooler-pump-5', g, { pose: PUMP_POSE });
  },
  // pump 6 (161): a white slotted inlet box, a dark grey finned block with wavy fins on top
  'pumps-cooler-pump-6': () => {
    const g = new THREE.Group();
    const white = pumpWhite(), dark = pumpDark();
    g.add(rbox(0.6, 0.78, 0.74, 0.05, white, -0.38, -0.08, 0.04));
    slots(g, white, hole(), { face: '+z', c: [-0.38, -0.12, 0.412], w: 0.46, h: 0.56, n: 9, vertical: false });
    slots(g, white, hole(), { face: '-x', c: [-0.682, -0.12, 0.04], w: 0.58, h: 0.56, n: 9, vertical: false });
    g.add(rbox(0.82, 0.84, 0.85, 0.05, dark, 0.22, 0.0, -0.06)); // behind the inlet box, overlapping it
    for (let i = 0; i < 6; i++) { // the wavy fins along the top
      const pts = [];
      for (let k = 0; k <= 12; k++) pts.push([-0.04 + k * 0.058, 0, -0.39 + i * 0.14 + 0.02 * Math.sin(k * 1.4)]);
      const fin = tube(pts, 0.022, dark, 24);
      fin.scale.y = 1.8; // taller than thick
      fin.position.y = 0.43;
      g.add(fin);
    }
    nozzle(g, dark, -0.42, 0.31, 0.04, 1.05);
    return shell('cooler-pump-6', g, { pose: PUMP_POSE });
  },
};

// ---------------------------------------------------------------- the range, by product id
const build = (fn) => ({ shadows = false } = {}) => { const a = fn(); a.shadows(shadows); return a; };
export const SMALL_APPLIANCES = Object.fromEntries(Object.entries({
  ...IRONS,
  'all-purpose-cabin-fans-cabin-fan-12': cabinFan,
  ...MOTORS,
  ...PUMPS,
}).map(([id, fn]) => [id, build(fn)]));
