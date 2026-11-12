// The rest of the Aparna ceiling-fan range (Signature, Silver, Ultra Gold and the new premium range), built
// procedurally in three.js from one shared builder. Each fan is a set of choices read off its own studio photo
// (TransferNow 2026, one three-quarter view from below per product): canopy (cup, cone or five-sided), motor
// shape and its rings (a thin line at the waist, a broad or textured band round the rim, a ring on the base,
// stripes, swirls or chevrons), blade shape and tip, the clip or trim where the blade meets the motor (teardrop,
// oval loop, copper mesh, leaves, shell, disc, button, bar, stripes, flames, hexagon, square, U, ornate insert),
// how many blades (four on the 24" fans), and the colour it is shown in. Colours follow the product data (White,
// Ivory, Smoke Brown, Metallic Brown, Glossy Brown, Metallic Blue) and the studio photos' own (Golden, Grey,
// Brown, Champagne), so the product page's colour picker repaints the model; a fan whose trim changes with the
// colour (Coras: gold, steel-blue or copper) carries its own finish overrides. Parts the photos don't show
// (the top of the motor, the back of the blades) follow the visible design.
//
// Same parts as the Aeroflow (aeroflow-model.js): still canopy and downrod, turning motor and blades.

import * as THREE from 'three';
import { lathe, makeBlurTexture } from './aeroflow-model.js';
import { brandMark, MARK_ASPECT } from './brand-mark.js';

const TOP = 0.5; // canopy top; these fans hang on a short drop, as in their photos

// The Aparna logo (brand-mark.js) laid on a turned surface (axis y) whose outline is `points`, as given to
// lathe(): it follows the slope and curve of a cup or cone canopy instead of standing off it like a cylinder
// decal. Centred at height y and facing `angle` (0 = +z, growing towards +x), lifted `lift` off the surface;
// width is measured across the surface. `sides` > 0 is a faceted (e.g. five-sided) surface made by lathe(points,
// sides): the decal then lies flat on the facet whose middle is nearest `angle`.
export function latheLogo({ colour, width, points, y, angle = 0, sides = 0, lift = 0.002 }) {
  const mark = brandMark({ colour, width });
  const h = width * MARK_ASPECT;
  const prof = new THREE.SplineCurve(points.map(([r, yy]) => new THREE.Vector2(r, yy))).getPoints(240);
  const len = [0];
  for (let i = 1; i < prof.length; i++) len.push(len[i - 1] + prof[i].distanceTo(prof[i - 1]));
  // the outline point (and its outward normal) at a distance s along the outline
  const at = (s) => {
    let i = 1;
    while (i < prof.length - 1 && len[i] < s) i++;
    const a = prof[i - 1], b = prof[i], f = THREE.MathUtils.clamp((s - len[i - 1]) / (len[i] - len[i - 1] || 1), 0, 1);
    const t = b.clone().sub(a).normalize();
    let n = new THREE.Vector2(t.y, -t.x);
    if (n.x < 0) n.negate();
    return { r: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, n };
  };
  // where the centre height falls along the outline
  let s0 = 0;
  for (let i = 1; i < prof.length; i++) {
    const a = prof[i - 1], b = prof[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) { s0 = len[i - 1] + (len[i] - len[i - 1]) * ((y - a.y) / (b.y - a.y)); if (a.x > 0.01 || b.x > 0.01) break; }
  }
  const cols = 32, rows = 14, pos = [], uv = [], index = [];
  const facet = sides ? Math.PI / sides + Math.round((angle - Math.PI / sides) / ((2 * Math.PI) / sides)) * ((2 * Math.PI) / sides) : angle;
  for (let j = 0; j <= rows; j++) {
    const v = 1 - j / rows; // the top row first
    const p = at(s0 + (j / rows - 0.5) * h);
    const R = p.r + p.n.x * lift, Y = p.y + p.n.y * lift;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, t = (u - 0.5) * width;
      if (sides) { // flat on the facet: out along its middle, across along it
        const apo = R * Math.cos(Math.PI / sides);
        pos.push(Math.sin(facet) * apo + Math.cos(facet) * t, Y, Math.cos(facet) * apo - Math.sin(facet) * t);
      } else {
        const a = facet + t / R;
        pos.push(Math.sin(a) * R, Y, Math.cos(a) * R);
      }
      uv.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  mark.geometry.dispose();
  mark.geometry = geo;
  return mark;
}

// The canopy logo in both colours: red on the light finishes, white on the rest (the studio photos print white
// on gold and champagne too). setFinish shows one.
const LIGHT_CANOPIES = new Set(['white', 'ivory', 'pearl-white', 'titanium-silver']);
function canopyLogos(stator, spec) {
  const red = latheLogo({ ...spec, colour: 'red' });
  const white = latheLogo({ ...spec, colour: 'white' });
  stator.add(red, white);
  return (finishKey) => { const light = LIGHT_CANOPIES.has(finishKey); red.visible = light; white.visible = !light; };
}
// the canopy outlines (also used to lay the logo on them)
const CUP_CANOPY = [[0, TOP], [0.084, TOP], [0.088, TOP - 0.014], [0.082, TOP - 0.06], [0.058, TOP - 0.1], [0.032, TOP - 0.122], [0.028, TOP - 0.14], [0.022, TOP - 0.15]];
const CONE_CANOPY = [[0, TOP], [0.1, TOP], [0.102, TOP - 0.014], [0.06, TOP - 0.08], [0.03, TOP - 0.14], [0.022, TOP - 0.16]];
const LOGO_ANGLE = 0.6; // facing the viewer's opening view (viewerPose azimuth), as the photos show it

// Body and blade colours for every colour name in the product data and in the studio photos.
export const CEILING_FINISHES = {
  'white': { body: '#f1f1ef', blade: '#f3f3f1', metal: 0.05, gloss: true },
  'ivory': { body: '#ece4cf', blade: '#efe8d5', metal: 0.05, gloss: true },
  'smoke-brown': { body: '#545254', blade: '#5a5859', metal: 0.4 }, // the slate grey-brown of the photos
  'metallic-brown': { body: '#5e3628', blade: '#66392a', metal: 0.5 },
  'glossy-brown': { body: '#4b2a1f', blade: '#512e22', metal: 0.2, gloss: true },
  'metallic-blue': { body: '#4a5d7e', blade: '#526788', metal: 0.5 },
  'rose-gold': { body: '#c99782', blade: '#cf9f8a', metal: 0.7 },
  'golden': { body: '#d5ac70', blade: '#dcb57c', metal: 0.45 },
  'grey': { body: '#626368', blade: '#6c6d72', metal: 0.5 },
  'brown': { body: '#3d2624', blade: '#432a27', metal: 0.4 },
  'champagne': { body: '#c8bba6', blade: '#d0c4b1', metal: 0.5 },
  'pearl-white': { body: '#f3f1ec', blade: '#f5f3ee', metal: 0.25, gloss: true },
  'titanium-silver': { body: '#b9bcc0', blade: '#c3c6ca', metal: 0.75 },
  'honey-gold': { body: '#d8b06a', blade: '#ddb874', metal: 0.6 },
  'coffee-brown': { body: '#4a3326', blade: '#523a2c', metal: 0.3 },
};
const ACCENTS = {
  copper: { color: '#bb6a45', metalness: 1, roughness: 0.26 },
  rose: { color: '#d39a86', metalness: 1, roughness: 0.25 },
  chrome: { color: '#e6e8ea', metalness: 1, roughness: 0.16 },
  gold: { color: '#d9a94f', metalness: 1, roughness: 0.22 },
  'gold-gloss': { color: '#e2b04c', metalness: 1, roughness: 0.12 },
  champagne: { color: '#d8c29a', metalness: 1, roughness: 0.2 },
  steel: { color: '#a9b9cc', metalness: 1, roughness: 0.18 },
  maroon: { color: '#7a2024', metalness: 0.3, roughness: 0.12 },
};

const physical = (spec = {}) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.45, ...spec });

// A flat plate from an outline in (x along the radius, y across the chord), lying in the blade plane.
function plate(outline, { thickness = 0.012, pitch = -0.1, y = 0, curve = 12 } = {}) {
  const shape = Array.isArray(outline) ? new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z))) : outline;
  const bevel = Math.min(0.004, thickness * 0.4);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(pitch));
  geo.translate(0, y, 0);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- outlines (x along the radius, y across)
const loop = (fn, n = 56) => Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2));
const toShape = (pts, holes = []) => {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
};
const sgnPow = (v, p) => Math.sign(v) * Math.abs(v) ** p;
// rounded rectangle / pill (e = 2 is an ellipse, larger is squarer)
const pill = (cx, a, b, e = 4) => (t) => [cx + a * sgnPow(Math.cos(t), 2 / e), b * sgnPow(Math.sin(t), 2 / e)];
// teardrop: round at the outer end, narrowing towards the motor
const drop = (cx, a, b) => (t) => [cx + a * Math.cos(t), b * Math.sin(t) * (0.18 + 0.95 * Math.sqrt((1 + Math.cos(t)) / 2))];
// almond / lens, pointed at both ends
const lens = (cx, a, b) => (t) => [cx + a * Math.cos(t), b * Math.sin(t) * Math.abs(Math.sin(t)) ** 0.25];
// hexagon stretched along the radius
const hexa = (cx, a, b) => (t) => { // corners every 60 degrees, straight sides between
  const seg = Math.PI / 3, local = ((t % seg) + seg) % seg - seg / 2;
  const rad = Math.cos(seg / 2) / Math.cos(local);
  return [cx + a * rad * Math.cos(t), b * rad * Math.sin(t)];
};
// a frame: the outline with the same outline, inset by d, cut out of it
const frame = (mk, cx, a, b, d) => toShape(loop(mk(cx, a, b)), [loop(mk(cx, a - d, b - d))]);
const solid = (mk, cx, a, b) => toShape(loop(mk(cx, a, b)));
// a ribbon of width wd along a polyline
function ribbon(pts, wd) {
  const left = [], right = [];
  const width = typeof wd === 'function' ? wd : () => wd;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
    const tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l, ny = tx / l, h = width(i / (pts.length - 1)) / 2;
    left.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    right.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  return toShape([...left, ...right.reverse()]);
}
const arc = (cx, cy, rad, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
// a crescent cap over the outer end of a clip
const crescent = (cx, a, b, inset) => toShape([
  ...Array.from({ length: 25 }, (_, i) => { const t = -Math.PI / 2 + (Math.PI * i) / 24; return [cx + a * Math.cos(t), b * Math.sin(t)]; }),
  ...Array.from({ length: 25 }, (_, i) => { const t = Math.PI / 2 - (Math.PI * i) / 24; return [cx + inset + (a - inset) * 0.75 * Math.cos(t), b * 0.86 * Math.sin(t)]; }),
]);

// Blade outlines. root is the radius where the blade starts; w is the chord.
function bladeShape(kind, root, w) {
  const s = new THREE.Shape();
  const h = w / 2;
  if (kind === 'swept') { // Signature: a gently curved blade, a little wider near the tip
    s.moveTo(root, -h * 0.85);
    s.bezierCurveTo(0.5, -h * 1.0, 0.8, -h * 1.1 + 0.03, 0.985, -h * 0.85 + 0.05);
    s.quadraticCurveTo(1.025, 0.04, 0.985, h * 0.95 + 0.05);
    s.bezierCurveTo(0.8, h * 1.2 + 0.03, 0.5, h * 1.1, root, h * 0.85);
    s.closePath();
  } else if (kind === 'leaf') { // Luster Shine: broad in the middle, curving to a rounded point
    s.moveTo(root, -h * 0.55);
    s.bezierCurveTo(0.42, -h * 1.5, 0.75, -h * 1.45, 1.0, -h * 0.05 + 0.06);
    s.bezierCurveTo(0.8, h * 1.0 + 0.05, 0.5, h * 1.15, root, h * 0.55);
    s.closePath();
  } else if (kind === 'round') { // 24" paddles: short, wide, rounded tip
    s.moveTo(root, -h * 0.8);
    s.lineTo(0.8, -h * 1.05);
    s.quadraticCurveTo(1.0, -h * 1.05, 1.0, 0);
    s.quadraticCurveTo(1.0, h * 1.05, 0.8, h * 1.05);
    s.lineTo(root, h * 0.8);
    s.closePath();
  } else if (kind === 'oval') { // New Josh: an oval paddle
    s.moveTo(root, -h * 0.7);
    s.bezierCurveTo(0.55, -h * 1.25, 1.0, -h * 1.1, 1.0, 0);
    s.bezierCurveTo(1.0, h * 1.1, 0.55, h * 1.25, root, h * 0.7);
    s.closePath();
  } else { // straight, square tip with softened corners ('square') or cut at a slant ('angled')
    const t = 0.94;
    s.moveTo(root, -h);
    s.lineTo(0.975, -h * t);
    s.quadraticCurveTo(1.0, -h * t, 1.0, -h * t + 0.02);
    if (kind === 'angled') { s.lineTo(0.99, h * t - 0.02); s.lineTo(0.955, h * t); } else { s.lineTo(1.0, h * t - 0.02); s.quadraticCurveTo(1.0, h * t, 0.975, h * t); }
    s.lineTo(root, h);
    s.closePath();
  }
  return s;
}

// Small canvas textures: copper mesh dots, and the ornate floral insert of the Art Pro.
let meshTex = null;
function meshTexture() {
  if (meshTex) return meshTex;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#6b6b6b';
  for (const [x, y] of [[4, 4], [12, 12]]) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
  meshTex = new THREE.CanvasTexture(c);
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  meshTex.repeat.set(70, 70);
  meshTex.colorSpace = THREE.SRGBColorSpace;
  return meshTex;
}
function ornateTexture(base, ink) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 2.4;
  const flower = (x, y, r) => { // a round flower with petals, as on the insert
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42, r * 0.2, a, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
  };
  flower(150, 64, 40);
  flower(60, 30, 18); flower(62, 98, 18); flower(225, 30, 14); flower(225, 100, 14);
  for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(20 + i * 13, i % 2 ? 8 : 120, 3, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The clip or trim where the blade meets the motor, on the underside of the blade (seen from below).
// Returns [geometry, material name] pairs; x0 is where the blade starts, w its chord.
function trimParts(kind, x0, w, pitch, size = 1) {
  const out = [];
  const yClip = -0.024, yTop = -0.032; // a raised clip, and decoration on it
  const flat = (shape, y, thickness = 0.006) => plate(shape, { thickness, pitch, y, curve: 24 });
  const L = 0.085 * size, b = w * 0.36; // half-length along the radius, half-width across the chord
  const cx = x0 + 0.015 + L;
  switch (kind) {
    case 'teardrop': // Sonet Deco, Vista Deco, Raftaar: a copper-edged teardrop clip
      out.push([flat(solid(drop, cx, L, b), yClip, 0.008), 'body'], [flat(frame(drop, cx, L, b, 0.011), yTop), 'accent']);
      break;
    case 'loop': // an oval clip edged in copper
      out.push([flat(solid(pill, cx, L, b * 1.05), yClip, 0.008), 'body'], [flat(frame((c, a, bb) => pill(c, a, bb, 2.6), cx, L, b * 1.05, 0.011), yTop), 'accent']);
      break;
    case 'window': // Coral: a thick glossy gold loop
      out.push([flat(frame((c, a, bb) => pill(c, a, bb, 3), cx, L * 1.05, b * 1.15, 0.02), yClip, 0.01), 'accent']);
      break;
    case 'mesh': // Croma: a copper pill with a fine raised mesh
      out.push([flat(solid((c, a, bb) => pill(c, a, bb, 3.2), cx, L, b), yClip, 0.012), 'mesh']);
      break;
    case 'mesh-point': // copper mesh clip, pointed towards the motor
      out.push([flat(toShape([[cx - L, 0], [cx - L * 0.55, -b], [cx + L, -b], [cx + L, b], [cx - L * 0.55, b]]), yClip, 0.012), 'mesh']);
      break;
    case 'leaf': { // Apsara, Smart Deco: two copper leaves sweeping out from the root
      for (const s of [-1, 1]) {
        const pts = Array.from({ length: 21 }, (_, i) => { const u = i / 20; return [x0 + 0.01 + u * L * 2.2, s * b * (0.12 + 1.1 * u - 0.45 * u * u)]; });
        out.push([flat(ribbon(pts, (u) => 0.002 + 0.05 * Math.sin(Math.PI * u) ** 0.8), yClip, 0.008), 'accent']);
      }
      break;
    }
    case 'shell': // Crystal Pro, Platinium, Orchid Deco: a rounded clip with a copper cap on its outer end
      out.push([flat(solid((c, a, bb) => pill(c, a, bb, 3), cx, L, b * 1.1), yClip, 0.016), 'body'],
        [flat(crescent(cx, L + 0.004, b * 1.1 + 0.004, L * 0.25), yTop - 0.004, 0.01), 'accent']);
      break;
    case 'disc': // Stunner, Runner: a round clip ringed in copper
      out.push([flat(solid(pill, cx, b * 1.05, b * 1.05, 2), yClip, 0.01), 'body'], [flat(frame((c, a, bb) => pill(c, a, bb, 2), cx, b * 1.05, b * 1.05, 0.012), yTop), 'accent']);
      break;
    case 'button': // Electra, New Josh, Orina: an oval clip with a small copper ring on it
      out.push([flat(solid(pill, cx, L * 1.1, b * 1.1, 2.4), yClip, 0.014), 'body'],
        [flat(frame((c, a, bb) => pill(c, a, bb, 2), cx + L * 0.25, b * 0.42, b * 0.42, 0.008), yTop - 0.002), 'accent']);
      break;
    case 'bar': // Unicorn, Fortune Pro: a square-cut clip with a copper bar across it
      out.push([flat(solid((c, a, bb) => pill(c, a, bb, 6), cx, L, b * 1.1), yClip, 0.014), 'body'],
        [flat(solid((c, a, bb) => pill(c, a, bb, 8), cx - L * 0.55, L * 0.32, b * 1.1 + 0.004), yTop - 0.002, 0.01), 'accent']);
      break;
    case 'stripes': // Rosa, Rosa Pro, Rolex, Sayonara: slanted copper bars on a raised clip
      out.push([flat(solid((c, a, bb) => pill(c, a, bb, 6), cx, L, b * 1.15), yClip, 0.01), 'body']);
      for (let i = 0; i < 4; i++) {
        const x = cx - L * 0.7 + i * L * 0.45;
        out.push([flat(ribbon([[x - 0.02, -b * 0.95], [x + 0.02, b * 0.95]], 0.011), yTop), 'accent']);
      }
      break;
    case 'flame': // Senorita: three copper flames fanning out from the root
      for (const s of [-1, 0, 1]) {
        const pts = Array.from({ length: 16 }, (_, i) => { const u = i / 15; return [x0 + 0.02 + u * L * 1.9, s * b * 0.55 * u + s * 0.01]; });
        out.push([flat(ribbon(pts, 0.014), yClip, 0.008), 'accent']);
      }
      out.push([flat(ribbon([[x0 + 0.02, -b * 0.7], [x0 + 0.02, b * 0.7]], 0.016), yClip, 0.008), 'accent']);
      break;
    case 'square': // a square copper frame
      out.push([flat(solid((c, a, bb) => pill(c, a, bb, 8), cx, L * 0.9, b * 1.15), yClip, 0.01), 'body'], [flat(frame((c, a, bb) => pill(c, a, bb, 8), cx, L * 0.9, b * 1.15, 0.012), yTop), 'accent']);
      break;
    case 'hex': // Mini Smart: a hexagon clip edged in copper
      out.push([flat(solid(hexa, cx, L * 1.05, b), yClip, 0.01), 'body'], [flat(frame(hexa, cx, L * 1.05, b, 0.012), yTop), 'accent']);
      break;
    case 'u': { // Irus: a copper U round the blade root, open towards the motor
      const pts = [[x0 + 0.01, -b], ...arc(cx + L * 0.2, 0, b, -Math.PI / 2, Math.PI / 2, 20).map(([x, y]) => [x + L * 0.5, y]), [x0 + 0.01, b]];
      out.push([flat(ribbon(pts, 0.012), yClip, 0.008), 'accent']);
      break;
    }
    case 'ornate': // Art Pro: an ornate floral insert framed in copper
      out.push([flat(frame((c, a, bb) => pill(c, a, bb, 5), cx + L * 0.2, L * 1.25, b * 1.4, 0.012), yTop), 'accent'],
        [flat(solid((c, a, bb) => pill(c, a, bb, 5), cx + L * 0.2, L * 1.25 - 0.01, b * 1.4 - 0.01), yClip, 0.006), 'insert']);
      break;
    case 'band': // Coras: a glossy band wrapped round the blade root
      out.push([plate(toShape([[x0 - 0.01, -w * 0.56], [x0 + 0.05, -w * 0.56], [x0 + 0.05, w * 0.56], [x0 - 0.01, w * 0.56]]), { thickness: 0.03, pitch, y: -0.006 }), 'accent']);
      break;
    case 'petal': // Luster Shine: a big copper almond round the blade root
      out.push([flat(frame(lens, x0 + 0.1, 0.13, w * 0.4, 0.016), yClip, 0.01), 'accent']);
      break;
    default:
      break;
  }
  return out;
}

function createCeiling(name, cfg) {
  const small = cfg.size === 24, mid = cfg.size === 36;
  const k = (cfg.motorScale ?? 1) * (small ? 1.45 : mid ? 1.15 : 1); // motor scale: smaller sweeps have a relatively bigger motor
  const count = cfg.blades ?? (small ? 4 : 3);
  const m = {
    body: physical(), blade: physical(), canopy: physical(),
    accent: physical(), mesh: physical({ map: meshTexture() }), insert: physical({ roughness: 0.4, clearcoat: 0.5 }),
    arm: physical({ color: '#3a3b3e', metalness: 0.6, roughness: 0.35 }),
    hole: physical({ color: '#1a1a1b', roughness: 0.8 }),
  };
  const fan = new THREE.Group();
  fan.name = name;

  // ---- still: canopy (cup, cone or five-sided cone) and the downrod with its cone cover over the motor
  const cone = cfg.canopy === 'cone' || cfg.canopy === 'penta';
  const canopyGeo = cone ? lathe(CONE_CANOPY, cfg.canopy === 'penta' ? 5 : 64) : lathe(CUP_CANOPY);
  if (cfg.canopy === 'penta') { const g = canopyGeo.toNonIndexed(); g.computeVertexNormals(); canopyGeo.copy(g); }
  const stator = new THREE.Group();
  stator.add(new THREE.Mesh(canopyGeo, m.canopy));
  // the Aparna logo on the front of the canopy, as in every studio photo (about half the canopy across, a
  // third to a half of the way down)
  const showLogo = cfg.logo === false ? () => {} : canopyLogos(stator, cone
    ? { points: CONE_CANOPY, width: 0.066, y: TOP - 0.046, angle: LOGO_ANGLE, sides: cfg.canopy === 'penta' ? 5 : 0 }
    : { points: CUP_CANOPY, width: 0.07, y: TOP - 0.042, angle: LOGO_ANGLE });
  if (cfg.canopyRim) { // Irus, Art Pro, Flora: a copper rim round the top of the canopy
    const rim = new THREE.Mesh(new THREE.TorusGeometry(cone ? 0.101 : 0.087, 0.007, 10, 64), m.accent);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TOP - 0.008;
    stator.add(rim);
  }
  if (!cone) { // the collar where the cup meets the rod
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 32), m.canopy);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = TOP - 0.135;
    stator.add(collar);
  }
  const topY = 0.075 * k;
  stator.add(new THREE.Mesh(lathe([[0.019, TOP - 0.15], [0.018, 0.17], [0.022, 0.14], [0.04 * k, topY + 0.02 * k], [0.062 * k, topY]], 32), cfg.rod === 'accent' ? m.accent : m.body));

  // ---- turning: the motor (upper dome, rim, lower bowl, flat base) with its rings, and the blades
  const r = 0.2 * k;
  const dz = cfg.motor === 'deep' ? 1.25 : cfg.motor === 'flat' ? 0.8 : 1;
  const yRim = -0.016 * k * dz, yLow = -0.058 * k * dz, yBase = -0.07 * k * dz;
  const upper = new THREE.Mesh(lathe([[0.06 * k, topY], [0.1 * k, 0.07 * k], [0.16 * k, 0.05 * k], [r * 0.97, 0.022 * k], [r, 0.004 * k]]), m.body);
  const lower = new THREE.Mesh(lathe([[r, 0.004 * k], [r * 1.005, yRim], [r * 0.97, yRim - 0.024 * k * dz], [r * 0.87, yLow], [r * 0.8, yBase + 0.004 * k]]), m.body);
  const base = new THREE.Mesh(lathe([[r * 0.8, yBase + 0.004 * k], [r * 0.77, yBase], [r * 0.4, yBase - 0.002 * k], [0, yBase - 0.002 * k]]), m.body);
  const rotorParts = [upper, lower, base];
  const ring = (rad, y, tube, mat = m.accent, radial = 10) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, radial, 96), mat);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    rotorParts.push(t);
    return t;
  };
  if (cfg.band) ring(r * 1.003, 0.004 * k, 0.004 * k); // a thin line round the waist
  if (cfg.rim) { // a broad band round the rim (copper, or copper mesh), seen from below as the outer ring
    const band = new THREE.Mesh(lathe([[r * 1.012, 0.002 * k], [r * 1.018, yRim], [r * 0.985, yRim - 0.024 * k * dz], [r * 0.93, yRim - 0.036 * k * dz]], 96), cfg.rim === 'mesh' ? m.mesh : m.accent);
    rotorParts.push(band);
  }
  if (cfg.rimLine) ring(r * 0.99, yRim - 0.02 * k * dz, 0.003 * k); // a fine line on the lower bowl
  const baseR = cfg.baseRing === true ? 0.6 : cfg.baseRing;
  if (baseR) ring(r * baseR, yBase - 0.003 * k, (cfg.baseRingTube ?? 0.006) * k, m.accent, cfg.deco === 'diamond' ? 4 : 10);
  if (cfg.deco === 'steps') { // Major, Virat, Prince, Nikon: a stepped base with fine rings
    ring(r * 0.7, yBase - 0.002 * k, 0.007 * k, m.body);
    ring(r * 0.5, yBase - 0.003 * k, 0.005 * k, m.body);
    ring(r * 0.78, yBase + 0.002 * k, 0.0025 * k, m.accent);
  }
  if (cfg.deco === 'diamond') { // a faceted copper ring on the base, as cut on a lathe
    const d = rotorParts.at(-1);
    d.material = m.accent;
    d.geometry = new THREE.TorusGeometry(r * baseR, 0.012 * k, 4, 48);
    d.rotation.z = Math.PI / 48;
  }
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.add(...rotorParts);

  // ---- blades: the blade, its arm from the motor, ribs along the edges, screw holes, and the root clip
  const pitch = -0.1;
  const w = cfg.chord ?? (small ? 0.3 : mid ? 0.18 : 0.165);
  const x0 = r + (cfg.gap ?? (small ? 0.05 : 0.07));
  const tip = cfg.tip ?? (small ? 'round' : 'square');
  const bladeGeo = plate(bladeShape(tip, x0, w), { pitch, y: -0.006 });
  const armGeo = plate([[r * 0.75, -w * 0.15], [x0 + 0.1, -w * 0.2], [x0 + 0.1, w * 0.2], [r * 0.75, w * 0.15]], { thickness: 0.012, pitch, y: 0.008 });
  const ribs = cfg.ribs ?? (!small && (tip === 'square' || tip === 'angled'));
  const ribGeos = ribs ? [-1, 1].map((s) => plate([[x0 + 0.02, s * w * 0.5], [0.97, s * w * 0.47], [0.97, s * w * 0.4], [x0 + 0.02, s * w * 0.43]], { thickness: 0.005, pitch, y: -0.021 })) : [];
  const holeGeo = cfg.holes ? plate(toShape(loop((t) => [Math.cos(t) * 0.007, Math.sin(t) * 0.007], 12)), { thickness: 0.002, pitch, y: -0.0185 }) : null;
  const trims = trimParts(cfg.trim ?? 'none', x0, w, pitch, cfg.trimSize ?? (small ? 1.2 : 1));
  const decoParts = motorDeco(cfg, r, k, yBase, yRim, dz);
  // The top of each blade repeats the underside design the photos show (ribs, trims, holes), mirrored through
  // the blade's own tilted plane.
  const toTop = (geo) => {
    const mirror = new THREE.Matrix4().makeTranslation(0, -0.006, 0)
      .multiply(new THREE.Matrix4().makeRotationX(pitch))
      .multiply(new THREE.Matrix4().makeScale(1, -1, 1))
      .multiply(new THREE.Matrix4().makeRotationX(-pitch))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0.006, 0));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(mirror);
    for (const attr of Object.values(g.attributes)) { // mirroring turns the faces inside out: flip them back
      const a = attr.array, n = attr.itemSize;
      for (let t = 0; t < attr.count; t += 3) for (let c = 0; c < n; c++) {
        const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c;
        [a[i1], a[i2]] = [a[i2], a[i1]];
      }
    }
    g.computeVertexNormals();
    return g;
  };
  const ribTop = ribGeos.map(toTop);
  const holeTop = holeGeo ? toTop(holeGeo) : null;
  const trimTop = trims.map(([g, mat]) => [toTop(g), mat]);
  const blades = [];
  for (let i = 0; i < count; i++) {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(bladeGeo, m.blade), new THREE.Mesh(armGeo, cfg.arm === 'body' ? m.body : m.arm));
    for (const g of [...ribGeos, ...ribTop]) pivot.add(new THREE.Mesh(g, m.blade));
    for (let j = 0; j < (cfg.holes ?? 0); j++) {
      const along = x0 + 0.03 + (j % 2) * 0.04, across = (cfg.holes === 2 ? (j ? 1 : -1) * 0.3 : (j - 1) * 0.3) * w;
      for (const geo of [holeGeo, holeTop]) {
        const h = new THREE.Mesh(geo, m.hole);
        h.position.set(along, Math.sin(pitch) * across * -1, across * Math.cos(pitch));
        pivot.add(h);
      }
    }
    for (const [g, mat] of [...trims, ...trimTop]) pivot.add(new THREE.Mesh(g, m[mat] ?? m.accent));
    for (const [g, mat] of decoParts) pivot.add(new THREE.Mesh(g, m[mat] ?? m.accent));
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

  const inserts = {};
  function setFinish(key) {
    const known = CEILING_FINISHES[key] ? key : cfg.colour;
    const f = { ...CEILING_FINISHES[known], ...(cfg.finishes?.[known] ?? {}) };
    showLogo(known);
    for (const [mat, color] of [[m.body, f.body], [m.blade, f.blade], [m.canopy, f.canopy ?? f.body]]) {
      mat.color.set(color);
      mat.metalness = f.metal;
      mat.roughness = f.gloss ? 0.2 : 0.36;
      mat.clearcoat = f.gloss ? 1 : 0.4;
      mat.clearcoatRoughness = f.gloss ? 0.06 : 0.22;
      mat.envMapIntensity = 1 + mat.metalness * 1.2;
      mat.needsUpdate = true;
    }
    const a = ACCENTS[f.accent ?? cfg.accent ?? 'copper'] ?? ACCENTS.copper;
    for (const mat of [m.accent, m.mesh]) {
      mat.color.set(a.color);
      mat.metalness = a.metalness;
      mat.roughness = a.roughness;
      mat.clearcoat = a.metalness < 1 ? 1 : 0;
      mat.envMapIntensity = 1 + a.metalness * 1.4;
      mat.needsUpdate = true;
    }
    // the blade arms on top are painted in the fan's body colour (or chrome where the fan has chrome arms)
    m.arm.color.set(cfg.arm === 'chrome' ? '#cfd2d6' : f.body);
    m.arm.metalness = cfg.arm === 'chrome' ? 0.9 : f.metal;
    m.arm.roughness = cfg.arm === 'chrome' ? 0.25 : f.gloss ? 0.22 : 0.38;
    m.arm.envMapIntensity = 1 + m.arm.metalness * 1.2;
    m.arm.needsUpdate = true;
    if (cfg.trim === 'ornate') {
      const [baseC, ink] = f.insert ?? ['#e9d6b2', '#7a2a24'];
      inserts[baseC + ink] ??= ornateTexture(baseC, ink);
      const t = inserts[baseC + ink];
      const L = 0.085 * 1.25 * 2, cx = x0 + 0.015 + 0.085 + 0.017, b2 = w * 0.36 * 1.4 * 2; // texture across the insert
      t.repeat.set(1 / L, 1 / b2);
      t.offset.set(-(cx - L / 2) / L, 0.5);
      m.insert.map = t;
      m.insert.color.set('#ffffff');
      m.insert.needsUpdate = true;
    }
  }
  setFinish(cfg.colour);
  return {
    fan, rotor, stator, blades, blurDisc, hitArea, setFinish,
    // as in the studio photos: from a little below, three-quarters round, the fan filling the view
    viewerPose: { elevation: -0.5, azimuth: 0.6, screenX: 0.5, screenY: 0.54, fill: 0.84, zoom: 1.16 },
    shadows(on) { fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = on; o.receiveShadow = on; } }); },
  };
}

// Decorations on the motor that repeat once per blade (so they sit in each blade's own frame): stripes on the
// side, swirls and chevrons on the base.
function motorDeco(cfg, r, k, yBase, yRim, dz) {
  const out = [];
  const onBase = (shape) => plate(shape, { thickness: 0.003, pitch: 0, y: yBase - 0.004 * k });
  if (cfg.deco === 'stripes') { // short copper bars on the side of the motor, either side of the blade
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const a = s * (0.32 + i * 0.09);
      const g = new THREE.BoxGeometry(0.006 * k, 0.026 * k * dz, 0.006 * k);
      g.translate(r * 0.985, yRim - 0.012 * k * dz, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(a));
      out.push([g, 'accent']);
    }
  }
  if (cfg.deco === 'swirl') { // Electra, Orina: a copper swirl on the base
    const pts = Array.from({ length: 30 }, (_, i) => { const u = i / 29, a = u * 2.2, rad = r * (0.2 + 0.45 * u); return [Math.cos(a) * rad, Math.sin(a) * rad]; });
    out.push([onBase(ribbon(pts, 0.008 * k)), 'accent']);
  }
  if (cfg.deco === 'chevron') { // Glaze, Irus: a copper V on the base pointing at each blade
    const tipX = r * 0.72;
    out.push([onBase(ribbon([[r * 0.3, -r * 0.42], [tipX, 0], [r * 0.3, r * 0.42]], 0.008 * k)), 'accent']);
  }
  if (cfg.deco === 'leaf') { // Apsara: copper leaf lines on the motor side, towards each blade
    for (const s of [-1, 1]) {
      const g = new THREE.TorusGeometry(r * 0.99, 0.003 * k, 6, 24, 0.5);
      g.rotateX(Math.PI / 2);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(s > 0 ? 0.15 : -0.65));
      g.translate(0, yRim - 0.008 * k, 0);
      out.push([g, 'accent']);
    }
  }
  return out;
}

// ---------------------------------------------------------------- the range, as in the studio photos
// colour: the colour in its photo · trim: the clip at the blade root · tip: blade end · band: a thin line at the
// waist · rim: a broad band round the rim ('mesh' for copper mesh) · baseRing: a ring on the base (its radius as a
// share of the motor's) · deco: other motor decoration · holes: screw holes on a plain blade
const SILVER = { size: 48, colour: 'smoke-brown', accent: 'copper' };
const MINI = { size: 24, colour: 'smoke-brown', accent: 'copper' };
const SIGNATURE = { size: 48, accent: 'copper', tip: 'swept', chord: 0.16, canopy: 'cone' };

export const CEILING = {
  // Signature Series and the new premium range
  'art-pro-48': { ...SIGNATURE, colour: 'golden', trim: 'ornate', canopyRim: true, rimLine: true, baseRing: 0.68, finishes: { brown: { insert: ['#3d2420', '#efe6d6'] } } },
  'coral-48': { ...SIGNATURE, canopy: 'cup', colour: 'golden', accent: 'gold-gloss', trim: 'window', rim: true, rod: 'accent' },
  'coras-48': {
    ...SIGNATURE, canopy: 'penta', colour: 'golden', accent: 'gold-gloss', trim: 'band', rim: true,
    finishes: { golden: { accent: 'gold-gloss' }, grey: { accent: 'steel' }, brown: { accent: 'copper' } },
  },
  'irus-48': { ...SIGNATURE, colour: 'brown', trim: 'u', canopyRim: true, rim: true, deco: 'chevron', finishes: { golden: { accent: 'copper' } } },
  'luster-shine-golden-48': { size: 48, colour: 'glossy-brown', accent: 'copper', tip: 'leaf', chord: 0.2, trim: 'petal', rim: true, canopy: 'cone', ribs: false, gap: 0.03, motorScale: 1.2, finishes: { brown: { body: '#43231a', blade: '#4a271c', metal: 0.25, gloss: true } } },
  'luster-shine-silver-48': { size: 48, colour: 'champagne', accent: 'copper', tip: 'leaf', chord: 0.2, trim: 'petal', rim: true, canopy: 'cone', ribs: false, gap: 0.03, motorScale: 1.2 },
  'heritage-48': { size: 48, colour: 'honey-gold', accent: 'chrome', tip: 'swept', trim: 'loop', chord: 0.17, motor: 'deep' },
  'pazero-48': { size: 48, colour: 'titanium-silver', accent: 'rose', tip: 'swept', trim: 'loop', chord: 0.16, motor: 'deep' },
  // Silver Series, 24" and 36"
  'mini-dlx-24': { ...MINI, tip: 'square', chord: 0.27, holes: 3, band: true, rim: true },
  // its photo (named Smoke Brown) shows a deep chocolate brown
  'mini-smart-24': { ...MINI, tip: 'square', chord: 0.27, trim: 'hex', band: true, rimLine: true, finishes: { 'smoke-brown': { body: '#3a2b26', blade: '#3e2e28', metal: 0.4 } } },
  'mini-star-24': { ...MINI, holes: 2, baseRing: 0.72, deco: 'steps', accent: 'chrome' },
  'new-josh-24': { ...MINI, colour: 'ivory', tip: 'oval', trim: 'button', baseRing: 0.45, band: true },
  'diplomat-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'loop' },
  'major-36': { size: 36, colour: 'metallic-brown', accent: 'gold', holes: 3, deco: 'steps', band: true },
  'orbit-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'teardrop' },
  // Silver Series, 48"
  'apsara-48': { ...SILVER, accent: 'rose', trim: 'leaf', deco: 'leaf', rimLine: true },
  'areta-48': { ...SILVER, colour: 'white', trim: 'loop', accent: 'champagne', band: true, baseRing: 0.85 },
  'croma-48': { ...SILVER, trim: 'mesh', rim: true, baseRing: 0.72, baseRingTube: 0.008 },
  'crystal-pro-48': { ...SILVER, trim: 'shell', rim: true, baseRing: 0.62 },
  'electra-48': { ...SILVER, colour: 'white', trim: 'button', deco: 'swirl', band: true },
  'festiva-48': { ...SILVER, rimLine: true }, // no studio photo yet: as in its catalogue picture
  'florence-48': { ...SILVER, trim: 'loop', band: true },
  'luster-48': { ...SILVER, trim: 'loop', band: true, rimLine: true },
  'glaze-48': { ...SILVER, trim: 'teardrop', deco: 'chevron', rimLine: true },
  'ikon-48': { ...SILVER, colour: 'white', accent: 'champagne', holes: 3, arm: 'chrome', band: true, baseRing: 0.7, baseRingTube: 0.003 },
  'phantom-48': { ...SILVER, trim: 'loop', rim: true },
  'prince-48': { ...SILVER, colour: 'metallic-brown', holes: 3, deco: 'steps', accent: 'gold', ribs: false },
  'rosa-48': { ...SILVER, colour: 'ivory', trim: 'stripes', deco: 'stripes', band: true },
  'rosa-pro-48': { ...SILVER, colour: 'ivory', trim: 'stripes', deco: 'stripes', band: true, trimSize: 1.15 },
  'senorita-48': { ...SILVER, trim: 'flame', rim: true },
  'sonet-deco-48': { ...SILVER, trim: 'teardrop', rimLine: true },
  'sparsh-48': { ...SILVER, colour: 'metallic-blue', holes: 3, deco: 'steps', accent: 'steel', ribs: false },
  'stunner-48': { ...SILVER, colour: 'metallic-brown', trim: 'disc', baseRing: 0.5, baseRingTube: 0.008 },
  'unicorn-48': { ...SILVER, colour: 'white', trim: 'bar', rim: true },
  // Ultra Gold Series, 24" and 36"
  'little-star-24': { ...MINI, holes: 2, baseRing: 0.72, deco: 'steps', accent: 'chrome' },
  'mini-copper-24': { ...MINI, tip: 'square', chord: 0.27, holes: 3, band: true, rim: true },
  'new-josh-copper-24': { ...MINI, colour: 'ivory', tip: 'oval', trim: 'button', baseRing: 0.45, band: true },
  'tejas-24': { ...MINI, colour: 'glossy-brown', trim: 'loop' },
  'nova-dlx-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'loop' },
  'saphire-36': { size: 36, colour: 'ivory', accent: 'copper', trim: 'loop' },
  'virat-36': { size: 36, colour: 'metallic-brown', accent: 'gold', holes: 3, deco: 'steps', band: true },
  // Ultra Gold Series, 48"
  'aroma-deco-48': { ...SILVER, trim: 'loop', rim: true, canopyRim: true },
  'aspire-48': { ...SILVER, trim: 'loop', accent: 'rose' },
  'croma-pro-48': { ...SILVER, trim: 'mesh', rim: true, baseRing: 0.72, baseRingTube: 0.008 },
  'flora-48': { ...SILVER, trim: 'loop', rim: true, canopyRim: true }, // shares its photo with Aroma Deco
  'fortune-pro-48': { ...SILVER, trim: 'bar', rim: true },
  'kiara-48': { ...SILVER, holes: 3, ribs: false, rimLine: true, finishes: { 'smoke-brown': { body: '#333234', blade: '#3a393b', metal: 0.45 } } }, // near-black in its photo
  'lotus-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
  'lumero-48': { ...SILVER, colour: 'ivory', trim: 'ornate', accent: 'copper', tip: 'swept', chord: 0.16 },
  'nikon-48': { ...SILVER, colour: 'metallic-blue', holes: 3, deco: 'steps', accent: 'steel', ribs: false, baseRing: 0.6, baseRingTube: 0.004 },
  'orchid-deco-48': { ...SILVER, trim: 'shell', rim: true },
  'orina-48': { ...SILVER, trim: 'button', deco: 'swirl', band: true, logo: false }, // its photo shows a plain canopy
  'platinium-48': { ...SILVER, colour: 'ivory', trim: 'shell', rim: true, baseRing: 0.62 },
  'porsche-48': { ...SILVER, trim: 'loop', rim: true },
  'rafale-48': { ...SILVER, holes: 3, band: true, ribs: false },
  'raftaar-48': { ...SILVER, trim: 'teardrop', rim: true },
  'rolex-48': { ...SILVER, trim: 'stripes', deco: 'stripes', rimLine: true },
  'runner-48': { ...SILVER, trim: 'disc', baseRing: 0.5 },
  'sayonara-48': { ...SILVER, trim: 'stripes', deco: 'stripes', rim: true },
  'smart-deco-48': { ...SILVER, accent: 'rose', trim: 'leaf', deco: 'leaf', rimLine: true },
  'venus-deco-48': { ...SILVER, trim: 'loop', accent: 'rose' },
  'viraj-deco-48': { ...SILVER, trim: 'teardrop', accent: 'rose' },
  'viraz-48': { ...SILVER, holes: 3, ribs: false },
  'vista-deco-48': { ...SILVER, trim: 'teardrop', rimLine: true },
  // New ceiling fans (names to be confirmed by Aparna), from their studio photos
  'new-gold-line-48': { ...SILVER, colour: 'ivory', accent: 'gold', holes: 3, deco: 'steps', band: true, ribs: false },
  'new-diamond-ring-48': { ...SILVER, trim: 'bar', baseRing: 0.66, deco: 'diamond', rimLine: true },
  'new-copper-mesh-48': { ...SILVER, colour: 'metallic-brown', trim: 'mesh-point', rim: 'mesh' },
  'new-square-clips-48': { ...SILVER, trim: 'square', baseRing: 0.62, baseRingTube: 0.008, band: true },
  'new-copper-edge': { ...SILVER, trim: 'shell', rim: true },
  'new-ivory-copper-ring-48': { ...SILVER, colour: 'ivory', rim: true, ribs: false },
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
  const canopyOutline = [[0, TOP], [0.11, TOP], [0.112, TOP - 0.012], [0.07, TOP - 0.08], [0.03, TOP - 0.15], [0.022, TOP - 0.165]];
  const canopy = new THREE.Mesh(lathe(canopyOutline), m.body);
  // the logo on the front of the canopy, white in both finishes (studio photos 15 and 16)
  const logo = latheLogo({ colour: 'white', width: 0.072, points: canopyOutline, y: TOP - 0.046, angle: LOGO_ANGLE });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.009, 10, 64), m.maroon);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TOP - 0.008;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, TOP - 0.165 - 0.13, 20), m.body);
  rod.position.y = (TOP - 0.165 + 0.13) / 2;
  const shank = new THREE.Mesh(lathe([[0.019, 0.14], [0.03, 0.11], [0.05, 0.085], [0.075, 0.068]], 40), m.body);
  const stator = new THREE.Group();
  stator.add(canopy, rim, rod, shank, logo);

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
