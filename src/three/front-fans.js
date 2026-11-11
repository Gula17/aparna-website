// Aparna front-facing fans (pedestal, table, wall, all-purpose and exhaust), built procedurally in three.js from
// one shared builder. Each fan below is a set of measurements and colours read off that product's studio photo
// (TransferNow NN.png, named next to each config): proportions from the photo's silhouette, then blade count and
// outline, guard wire pattern (straight radial, criss-cross, plastic grille), rim, hub badge, motor, control
// pod or base buttons, stand, wall body and pull cords.
// The backs (motor housing, rear guard), which the photos hide, follow the visible front. Printed logos are
// suggested by a small plain mark on the hub: the brand rules forbid retyping the name in a font.
//
// Same parts as the ceiling models (aeroflow-model.js), so the scene drives them unchanged: the rotor turns about
// its own y axis, which is pointed at the viewer here. All the wires of a guard are merged into one mesh.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe, makeBlurTexture } from './aeroflow-model.js';
import { brandMark } from './brand-mark.js';

const R = 0.5; // guard radius

const physical = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.45, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};
const CHROME = { color: '#e8eaec', metalness: 1, roughness: 0.16 };

function mergedMesh(geos, material) {
  const mesh = new THREE.Mesh(mergeGeometries(geos), material);
  for (const g of geos) g.dispose();
  return mesh;
}

// One guard (front or back): radial wires and rings on a shallow dome, facing +z (front) or -z (back).
//   twist:  how far (radians) each wire turns as it goes out, from twistFrom (fraction of the radius) to the rim;
//           the back guard turns the other way, so the two read as the criss-cross mesh of the photos
//   thick:  wire thickness (plastic grilles are thicker); band: a flat plastic rim band this deep instead of a wire rim
//   cross:  'net' splits each wire at twistFrom into two that turn opposite ways (a diamond net), 'loop' into two
//           that bow apart and meet again at the rim (eye-shaped loops)
//   outer:  [from, count]: the wires from 'from' (fraction of the radius) out are this many, spaced wider (Tesla)
function guard(material, rimMaterial, { side = 1, depth = 0.1, offset = 0.06, wires = 90, rings = [0.85], inner = 0.13, twist = 0, twistFrom = 0.45, thick = 1, rim = 1, band = 0, cross = 0, outer = null, outerThick = 1 } = {}) {
  const g = new THREE.Group();
  const z = (r) => side * (offset + depth * (1 - (r / R) ** 2)); // deepest in the middle
  const tOf = (r) => Math.min(1, Math.max(0, (r / R - twistFrom) / (1 - twistFrom)));
  const turn = (r) => { const t = tOf(r); return cross === 'loop' ? twist * Math.sin(Math.PI * t) : twist * t * t; };
  const geos = [];
  const wire = (a, from, to, n, dir, w = 1) => {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const r = from + ((to - from) * k) / n;
      const b = a + dir * turn(r);
      pts.push(new THREE.Vector3(Math.cos(b) * r, Math.sin(b) * r, z(r)));
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.0022 * thick * w, 4));
  };
  const split = R * (outer ? outer[0] : twistFrom);
  for (let i = 0; i < wires; i++) {
    const a = (i / wires) * Math.PI * 2;
    if (cross || outer) {
      wire(a, inner, split, outer && twist ? 10 : 4, 1); // (a swirl inside the outer bars: Safari)
      if (!outer) { wire(a, split, R, 12, 1); wire(a, split, R, 12, -1); }
    } else wire(a, inner, R, twist ? 14 : 6, 1);
  }
  if (outer) for (let i = 0; i < outer[1]; i++) wire((i / outer[1]) * Math.PI * 2, split, R, 3, 0, outerThick);
  for (const f of rings) geos.push(new THREE.TorusGeometry(R * f, 0.0026 * thick, 6, 96).translate(0, 0, z(R * f)));
  g.add(mergedMesh(geos, material));
  if (band) {
    const b = [
      new THREE.CylinderGeometry(R + 0.006, R + 0.006, band, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, z(R) - (side * band) / 2),
      new THREE.TorusGeometry(R + 0.002, 0.008, 8, 96).translate(0, 0, z(R)),
    ];
    g.add(mergedMesh(b, rimMaterial));
  } else {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.0075 * rim, 8, 128).translate(0, 0, z(R)), rimMaterial));
  }
  return g;
}

// Blade outlines, as width and sweep along the blade, or as its two edges (lead, trail) and a round tip (cap);
// t = 0 at the root, 1 at the tip.
const BLADE_SHAPES = {
  // swept "scimitar": widest a third of the way out, narrowing to a curved tip
  scimitar: { width: (t) => 0.075 + 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - 0.35 * t), sweep: (t) => 0.16 * t * t },
  // wide classic table/wall-fan blade: it widens well out from the hub and ends in a broad rounded tip
  broad: { width: (t) => 0.18 + 0.26 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.75)), sweep: (t) => 0.13 * t * t, round: 0.16 },
  // the Champion's very wide clover blade, bulging to a big round tip
  clover: { lead: (t) => -(0.05 + 0.25 * Math.sin((Math.PI / 2) * Math.min(1, t * 1.15))), trail: (t) => 0.05 + 0.19 * t ** 1.6, cap: 0.8 },
  // the fresh-air fan's three curved scoops: narrow, widening a little to a rounded tip
  scoop: { lead: (t) => -(0.035 + 0.06 * Math.sin((Math.PI / 2) * t)), trail: (t) => 0.035 + 0.06 * t ** 1.3, cap: 0.9 },
  // the ventilation fan's five round white petals
  vent: { lead: (t) => -(0.03 + 0.1 * Math.sin((Math.PI / 2) * Math.min(1, t * 1.2))), trail: (t) => 0.03 + 0.075 * t ** 1.4, cap: 0.85 },
  // the Glider's five curved crescents with rounded tips
  crescent: { lead: (t) => 0.2 * t * t - (0.035 + 0.055 * Math.sin(Math.PI * Math.min(1, t * 0.9))), trail: (t) => 0.2 * t * t + 0.035 + 0.06 * Math.sin(Math.PI * Math.min(1, t * 0.8)), cap: 0.9 },
  // the studio photos' three-blade table/wall/pedestal blade: narrow at the hub, a long convex leading edge, a
  // straighter trailing edge, widest at the broad rounded tip (lead and trail give each edge's offset directly)
  fan: { lead: (t) => -(0.045 + 0.2 * Math.sin((Math.PI / 2) * Math.min(1, t * 1.1))), trail: (t) => 0.045 + 0.145 * t ** 1.8, cap: 0.6 },
  // narrow, strongly swept blade (GoAir, Maxx)
  narrow: { width: (t) => 0.07 + 0.1 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.8)), sweep: (t) => 0.24 * t * t, round: 0.07 },
  // the Indus's long S-curved blade
  sickle: { width: (t) => 0.055 + 0.065 * Math.sin(Math.PI * t), sweep: (t) => 0.34 * t * t, round: 0.04 },
  // very wide round blade (Vento, heavy-duty exhaust)
  wide: { width: (t) => 0.2 + 0.3 * Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.7)), sweep: (t) => 0.06 * t * t, round: 0.2 },
  // narrow hockey-stick blade, widening to an angled straight-cut tip (Vistara)
  hockey: { width: (t) => 0.06 + 0.12 * Math.min(1, t * 1.25), sweep: (t) => 0.26 * t * t, round: 0.015, cut: 0.05 },
  // paddle: narrow at the root, widening to a broad rounded tip
  paddle: { width: (t) => 0.06 + 0.16 * Math.min(1, t * 1.6), sweep: (t) => 0.03 * t },
};

function bladeGeometry({ shape, tip, root, pitch }) {
  const s = BLADE_SHAPES[shape].lead ? edgeOutline(BLADE_SHAPES[shape], tip, root) : sweptOutline(BLADE_SHAPES[shape], shape, tip, root);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 3 }); // a spline's divisions are per point: 3 is smooth
  // a strongly swept blade can reach sideways out past the rim: shrink it to fit inside the guard
  const far = Math.max(...s.getPoints(4).map((p) => p.length()));
  if (far > R - 0.01) geo.scale((R - 0.025) / far, (R - 0.025) / far, 1);
  geo.translate(0, 0, -0.005);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-pitch));
  geo.computeVertexNormals();
  return geo;
}

// A blade from its two edges, closed by an elliptical arc across the tip that still ends at 'tip'.
function edgeOutline({ lead: leadY, trail: trailY, cap }, tip, root) {
  const half = (trailY(1) - leadY(1)) / 2;
  const reach = tip - cap * half;
  const lead = [], trail = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = root + (reach - root) * t;
    lead.push(new THREE.Vector2(x, leadY(t)));
    trail.push(new THREE.Vector2(x, trailY(t)));
  }
  const a = lead[steps], b = trail[steps];
  const c = a.clone().add(b).multiplyScalar(0.5);
  const u = b.clone().sub(a).normalize(), v = new THREE.Vector2(u.y, -u.x); // across the tip, and outwards
  const h = a.distanceTo(b) / 2;
  const arc = [];
  for (let k = 1; k < 12; k++) {
    const th = -Math.PI / 2 + (Math.PI * k) / 12;
    arc.push(c.clone().addScaledVector(u, h * Math.sin(th)).addScaledVector(v, cap * h * Math.cos(th)));
  }
  const s = new THREE.Shape();
  s.moveTo(lead[0].x, lead[0].y);
  s.splineThru([...lead.slice(1), ...arc, ...trail.slice().reverse()]);
  s.closePath();
  return s;
}

function sweptOutline({ width, sweep, round: roundTip, cut = 0 }, shape, tip, root) {
  const round = roundTip ?? (shape === 'paddle' ? 0.06 : 0.03);
  const reach = tip - 0.75 * Math.max(0, round - 0.03); // a big rounded tip still ends at 'tip', inside the guard
  const lead = [], trail = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = root + (reach - root) * t;
    const c = cut * t ** 8; // a cut tip: the leading corner reaches further out than the trailing one
    lead.push(new THREE.Vector2(x + c, sweep(t) - width(t) * 0.45));
    trail.push(new THREE.Vector2(x - c, sweep(t) + width(t) * 0.55));
  }
  const s = new THREE.Shape();
  s.moveTo(lead[0].x, lead[0].y);
  s.splineThru(lead.slice(1));
  const a = lead[steps], b = trail[steps];
  s.bezierCurveTo(a.x + round, a.y + 0.02, b.x + round, b.y - 0.02, b.x, b.y);
  s.splineThru(trail.slice(0, -1).reverse());
  s.closePath();
  return s;
}

// A rounded box (for bases, pods and wall bodies), centred on the origin.
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
  const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -Math.max(0.001, d - 2 * bevel) / 2);
  geo.computeVertexNormals();
  return geo;
}

// A rounded footprint w x d, h high, standing on y = 0, narrowing by 'taper' towards the top (table bases).
function taperedBox(w, d, h, r, taper = 0) {
  const geo = roundedBox(w, d, h, r);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = 1 - taper * Math.min(1, Math.max(0, p.getY(i) / h));
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return geo;
}

const placed = (g, geo, material, x, y, z) => { const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

// A row of buttons: piano keys (boxes) or round buttons, centred on x = 0.
function keyRow(g, m, { count, y, z, round = false, spacing = 0.065, face = false }) {
  for (let i = 0; i < count; i++) {
    const mat = i === 0 && m.get('key1') ? m.get('key1') : m.get('key', 'accent', 'body');
    const x = (i - (count - 1) / 2) * spacing;
    const geo = round
      ? new THREE.CylinderGeometry(0.019, 0.02, 0.025, 18)
      : new THREE.BoxGeometry(0.05, 0.03, 0.055);
    const k = placed(g, geo, mat, x, y, z);
    if (face) k.rotation.x = Math.PI / 2; // on an upright face, pointing forward
  }
}

// ---- the stands
// Pedestal: an optional control pod right under the head, a short upper pole (chrome or dark), a height-lock
// collar, the lower pole, a foot (boss or flared) and the base (dome with a rim, flat disc, ribbed dome or two-tier).
function pedestalStand(m, { headY, floorY, pod, upper = 0, collarH = 0.08, foot = 'boss', base = 'dome', baseR = 0.4, poleR = 0.034 }) {
  const g = new THREE.Group();
  const Z = -0.17;
  const cyl = (r1, r2, h, mat, y, seg = 24) => placed(g, new THREE.CylinderGeometry(r1, r2, h, seg), mat, 0, y, Z);
  const pole = m.get('pole', 'body');
  cyl(0.045, 0.05, 0.36, m.motor, headY - 0.28); // the neck under the motor, mostly hidden by the guard
  let y = headY - 0.36;
  if (pod) {
    const { w = 0.16, h = 0.36, d = 0.1, keys = 4, roundKeys = false, keysAt = 0.2, knob = null } = pod;
    const top = headY - 0.44;
    const front = Z + 0.02 + d / 2;
    placed(g, roundedBox(w, h, d, w * 0.45), m.get('pod', 'body'), 0, top - h / 2, Z + 0.02);
    if (m.get('podFace')) placed(g, roundedBox(w * 0.6, h * 0.82, 0.02, w * 0.26), m.get('podFace'), 0, top - h * 0.5, front);
    for (let i = 0; i < keys; i++) {
      const geo = roundKeys ? new THREE.CylinderGeometry(0.014, 0.014, 0.02, 14).rotateX(Math.PI / 2) : roundedBox(w * 0.36, 0.032, 0.025, 0.008);
      placed(g, geo, m.get('key', 'base', 'body'), 0, top - h * keysAt - i * (roundKeys ? 0.04 : 0.043), front + 0.01);
    }
    if (knob != null) placed(g, new THREE.CylinderGeometry(0.034, 0.036, 0.03, 24).rotateX(Math.PI / 2), m.get('knob', 'key', 'base', 'body'), 0, top - h * knob, front + 0.012);
    y = top - h + 0.03;
  }
  if (upper) { cyl(poleR * 0.78, poleR * 0.78, upper + 0.02, m.get('upper') ?? m.chrome, y - upper / 2, 20); y -= upper; }
  if (collarH) { cyl(poleR + 0.017, poleR + 0.019, collarH, m.get('collar', 'accent', 'body'), y - collarH / 2, 28); y -= collarH; }

  const f = floorY;
  const k = baseR / 0.41;
  let top;
  if (base === 'disc') {
    top = f + 0.075;
    placed(g, lathe([[0, top], [baseR * 0.85, top - 0.002], [baseR * 0.98, top - 0.015], [baseR, f + 0.03], [baseR * 0.98, f]]), m.base, 0, 0, Z);
    placed(g, new THREE.CircleGeometry(baseR * 0.98, 48).rotateX(Math.PI / 2), m.baseRim, 0, f, Z);
  } else if (base === 'step') {
    top = f + 0.11;
    placed(g, lathe([[0.06, top], [baseR * 0.6, top - 0.012], [baseR * 0.66, f + 0.065], [baseR * 0.97, f + 0.05], [baseR, f + 0.03], [baseR * 0.99, f + 0.01]]), m.base, 0, 0, Z);
    placed(g, lathe([[baseR * 0.99, f + 0.012], [baseR * 1.01, f + 0.006], [baseR, f], [0, f]]), m.baseRim, 0, 0, Z);
  } else {
    top = f + 0.12;
    placed(g, lathe([[0.06, f + 0.12], [0.16 * k, f + 0.1], [0.33 * k, f + 0.06], [0.4 * k, f + 0.04], [0.41 * k, f + 0.02]]), m.base, 0, 0, Z);
    placed(g, lathe([[0.41 * k, f + 0.025], [0.425 * k, f + 0.012], [0.42 * k, f], [0, f]]), m.baseRim, 0, 0, Z);
    if (base === 'ribbed') {
      // fine radial ribs over the dome (Windstar)
      const ribs = [];
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * Math.PI * 2;
        const rib = new THREE.BoxGeometry(0.012, 0.014, 0.25 * k);
        rib.rotateX(-0.2); // following the slope of the dome
        rib.translate(0, f + 0.075, 0.27 * k);
        rib.rotateY(a);
        ribs.push(rib);
      }
      placed(g, mergeGeometries(ribs), m.base, 0, 0, Z);
    }
  }
  if (foot === 'flare') {
    // a trumpet foot where the pole meets the base (Maxx, Indus)
    placed(g, lathe([[poleR * 1.02, top + 0.2], [poleR * 1.25, top + 0.12], [poleR * 2, top + 0.04], [poleR * 3.2, top + 0.005], [0, top]]), m.get('foot', 'collar', 'pole', 'body'), 0, 0, Z);
  } else {
    cyl(0.062, 0.075, 0.05, m.get('foot', 'base', 'body'), top + 0.02, 32);
  }
  cyl(poleR, poleR * 1.05, y - top, pole, (y + top) / 2);
  return g;
}

// Table fan on a rounded rectangular base: tapered oval column, optional raised plinth with keys or a knob,
// optional upright front face with round buttons (GoAir), optional bottom band in a second colour.
function tableStand(m, { headY, floorY, base = [0.78, 0.46, 0.13], taper = 0.12, column = [0.075, 0.13, 0.6], plinth = null, keys = null, knob = null, face = null, band = 0 }) {
  const g = new THREE.Group();
  const [bw, bd, bh] = base;
  const BZ = -0.1;
  const top = floorY + bh;
  const h = headY - 0.06 - top; // up into the motor housing, so the stand joins the head
  const col = placed(g, new THREE.CylinderGeometry(column[0], column[1], h, 32), m.get('column', 'body'), 0, top + h / 2, -0.13);
  col.scale.z = column[2];
  if (band) {
    placed(g, taperedBox(bw, bd, band + 0.01, Math.min(0.09, bd * 0.3), 0), m.get('band', 'baseRim', 'body'), 0, floorY, BZ);
    placed(g, taperedBox(bw * 0.995, bd * 0.995, bh - band, Math.min(0.09, bd * 0.3), taper), m.base, 0, floorY + band, BZ);
  } else {
    placed(g, taperedBox(bw, bd, bh, Math.min(0.09, bd * 0.3), taper), m.base, 0, floorY, BZ);
  }
  let keyY = top + 0.012, keyZ = BZ + bd * (1 - taper) / 2 - 0.05;
  if (plinth) {
    const { w, d, h: ph = 0.03, z = -0.06, oval = false } = plinth;
    const geo = oval ? new THREE.CylinderGeometry(0.5, 0.5, ph, 48).translate(0, ph / 2, 0).scale(w, 1, d) : taperedBox(w, d, ph, Math.min(0.05, d * 0.3), 0.06);
    placed(g, geo, m.get('plinth', 'column', 'body'), 0, top - 0.004, z);
    keyY = top + ph + 0.008;
    keyZ = z + d / 2 - 0.045;
  }
  if (keys) keyRow(g, m, { ...keys, y: keys.y ?? keyY, z: keys.z ?? keyZ });
  if (knob) {
    if (knob.ring) placed(g, new THREE.TorusGeometry(0.046, 0.009, 8, 32).rotateX(Math.PI / 2), m.chrome, 0, keyY + 0.004, keyZ - 0.01);
    else if (m.get('panel')) {
      const p = placed(g, new THREE.CylinderGeometry(0.5, 0.5, 0.012, 3).scale(knob.panel ?? 0.2, 1, (knob.panel ?? 0.2) * 0.7), m.get('panel'), 0, keyY, keyZ - 0.01);
      p.rotation.y = Math.PI / 2; // a soft triangle, point to the back
    }
    placed(g, new THREE.CylinderGeometry(0.036, 0.04, 0.04, 24), m.get('knob', 'key', 'accent', 'body'), 0, keyY + 0.02, keyZ - 0.01);
  }
  if (face) {
    // an upright panel on the front of a tall base, with round buttons
    const { w = 0.28, h: fh = 0.11, y = 0.55, buttons = 3 } = face;
    // the base's front, which its rounded bevel pushes out past bd / 2, and which leans in with the taper
    const bevelOut = Math.min(Math.min(0.09, bd * 0.3), bh / 2) * 0.48;
    const fz = BZ + (bd / 2 + bevelOut) * (1 - taper * y) + 0.002;
    placed(g, roundedBox(w, fh, 0.016, 0.04), m.get('panel', 'accent', 'body'), 0, floorY + bh * y, fz);
    keyRow(g, m, { count: buttons, y: floorY + bh * y - 0.012, z: fz + 0.012, round: true, spacing: 0.06, face: true });
  }
  return g;
}

// Table fan on a round base (Glider, Spider, Oreo): tapered column, a raised plinth with a knob, or keys.
function tableRoundStand(m, { headY, floorY, baseR = 0.36, depth = 0.8, column = [0.07, 0.11], knob = false, keys = 0, plinth = null }) {
  const g = new THREE.Group();
  const BZ = -0.15;
  const h = headY - 0.06 - (floorY + 0.1);
  const col = placed(g, new THREE.CylinderGeometry(column[0], column[1], h, 32), m.get('column', 'body'), 0, floorY + 0.1 + h / 2, BZ);
  col.scale.z = 0.7;
  const base = placed(g, lathe([[0.08, floorY + 0.12], [baseR * 0.56, floorY + 0.1], [baseR * 0.89, floorY + 0.06], [baseR, floorY + 0.03], [baseR * 0.99, floorY]]), m.base, 0, 0, BZ);
  const bottom = placed(g, new THREE.CircleGeometry(baseR * 0.99, 48).rotateX(Math.PI / 2), m.base, 0, floorY, BZ);
  base.scale.z = bottom.scale.z = depth;
  let y = floorY + 0.09, z = BZ + baseR * depth * 0.55;
  if (plinth) {
    const [pw, pd] = plinth;
    placed(g, taperedBox(pw, pd, 0.07, 0.03, 0.08), m.get('plinth', 'base', 'body'), 0, floorY + 0.06, BZ + pd / 2 - 0.02);
    y = floorY + 0.13;
    z = BZ + pd - 0.07;
  }
  if (knob) placed(g, new THREE.CylinderGeometry(0.032, 0.036, 0.035, 20), m.get('knob', 'accent', 'body'), 0, y + 0.01, z);
  if (keys) keyRow(g, m, { count: keys, y: y - 0.01, z });
  return g;
}

// Wall fan: the rounded body that hangs below the head against the wall, with a speed knob, a ring switch
// (optionally with a tail down to the bottom, Wendy), a plain dimple, or a swivel knob; and two pull cords.
// narrowTop: how much narrower the body is at its top than at its bottom (Jazz)
function wallStand(m, { headY, body = [0.27, 0.66], drop = 0.14, ring = false, ringTail = false, knob = false, detailAt = 0.62, cords = false, cord = 0.2, dimple: dimpleR = 0.07, narrowTop = 0 }) {
  const g = new THREE.Group();
  const [bw, bh] = body;
  const top = headY - drop; // drop: how far below the hub the body starts (its top tucks in behind the guard)
  const bodyGeo = roundedBox(bw, bh, 0.16, Math.min(0.12, bw / 2.2));
  if (narrowTop) {
    const p = bodyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - narrowTop * Math.min(1, Math.max(0, p.getY(i) / bh + 0.5))));
    bodyGeo.computeVertexNormals();
  }
  placed(g, bodyGeo, m.body, 0, top - bh / 2, -0.2);
  placed(g, new THREE.CylinderGeometry(0.045, 0.05, drop + 0.04, 20), m.motor, 0, headY - (drop + 0.04) / 2, -0.22);
  const detailY = top - bh * detailAt;
  if (knob) {
    const k = placed(g, new THREE.CylinderGeometry(0.05, 0.052, 0.04, 28), m.get('knob', 'accent', 'body'), 0, detailY, -0.11);
    k.rotation.x = Math.PI / 2;
  } else if (ring) {
    placed(g, new THREE.TorusGeometry(0.055, 0.018, 12, 40), m.accent, 0, detailY, -0.115);
    // the black band that runs from the ring down to the bottom of the body
    if (ringTail) placed(g, roundedBox(0.08, detailY - (top - bh) - 0.02, 0.012, 0.035), m.accent, 0.018, (detailY + top - bh) / 2 - 0.01, -0.118);
  } else {
    const dimple = placed(g, new THREE.SphereGeometry(dimpleR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.base, 0, detailY, -0.115);
    placed(g, new THREE.TorusGeometry(dimpleR * 1.02, 0.005, 8, 40), m.base, 0, detailY, -0.117); // its moulded rim
    dimple.rotation.x = Math.PI / 2;
    dimple.scale.set(1, 0.25, 1.2);
  }
  if (cords) {
    // two pull cords (speed and oscillation) with tassels
    for (const x of [-0.06, 0.06]) {
      placed(g, new THREE.CylinderGeometry(0.004, 0.004, cord, 6), m.get('cord', 'tassel', 'body'), x, top - bh - cord / 2 + 0.01, -0.16);
      placed(g, new THREE.CapsuleGeometry(0.024, 0.05, 6, 14), m.get('tassel', 'body'), x, top - bh - cord - 0.03, -0.16);
    }
  }
  return g;
}

// All-purpose fan on a C-shaped yoke round the bottom of the head, into a round puck or a rounded tray base.
function yokeStand(m, { headY, floorY, armR = 0.56, armDepth = 1, base = 'puck', baseR = 0.33, tray = [0.62, 0.42], baseH = 0.11, band = 0, keys = 0, knob = false }) {
  const g = new THREE.Group();
  const arm = placed(g, new THREE.TorusGeometry(armR, 0.028, 12, 64, Math.PI), m.get('arm', 'body'), 0, headY, -0.05);
  arm.rotation.z = Math.PI;
  arm.scale.z = armDepth; // a wider, flat band on the swivel model
  for (const x of [-armR, armR]) {
    const pivot = placed(g, new THREE.CylinderGeometry(0.038, 0.038, 0.06, 16), m.get('arm', 'body'), x, headY, -0.05);
    pivot.rotation.z = Math.PI / 2;
    const pin = placed(g, new THREE.CylinderGeometry(0.016, 0.016, 0.1, 10), m.get('pin', 'accent', 'body'), Math.sign(x) * (armR - 0.05), headY, -0.05);
    pin.rotation.z = Math.PI / 2;
  }
  const top = floorY + baseH;
  const post = headY - armR - top + 0.03;
  if (post > 0.01) placed(g, new THREE.CylinderGeometry(0.05, 0.07, post, 20), m.get('arm', 'body'), 0, top + post / 2 - 0.01, -0.05);
  let frontZ;
  if (base === 'tray') {
    const [w, d] = tray;
    if (band) placed(g, taperedBox(w, d, band + 0.01, 0.12, 0), m.get('band', 'baseRim', 'body'), 0, floorY, -0.05);
    placed(g, taperedBox(w * 0.99, d * 0.99, baseH - band, 0.12, 0.08), m.base, 0, floorY + band, -0.05);
    frontZ = -0.05 + d / 2 - 0.07;
  } else {
    // a round puck on a slightly wider bottom plate
    placed(g, lathe([[0.06, top], [baseR * 0.85, top - 0.004], [baseR, top - 0.03], [baseR * 1.01, floorY + 0.03]]), m.base, 0, 0, -0.05);
    placed(g, lathe([[baseR * 1.0, floorY + 0.032], [baseR * 1.1, floorY + 0.02], [baseR * 1.1, floorY], [0, floorY]]), m.baseRim, 0, 0, -0.05);
    frontZ = -0.05 + baseR * 0.82;
  }
  if (keys) {
    if (m.get('panel')) placed(g, new THREE.BoxGeometry(keys * 0.065 + 0.08, 0.008, 0.09), m.get('panel'), 0, top - 0.004, frontZ - 0.01);
    keyRow(g, m, { count: keys, y: top + 0.012, z: frontZ });
  }
  if (knob) placed(g, new THREE.CylinderGeometry(0.035, 0.04, 0.04, 20), m.get('knob', 'accent', 'body'), 0, top + 0.015, frontZ);
  return g;
}

const STANDS = { pedestal: pedestalStand, table: tableStand, tableRound: tableRoundStand, wall: wallStand, yoke: yokeStand };

// The hub: a flat cap or a low dome, with an optional raised ring round its face, an inner disc in a second
// colour, and a small plain mark where the printed logo sits.
function hubParts(m, h) {
  const hr = h.radius;
  const top = h.dome ? hr * 0.62 : hr * 0.45;
  const parts = [new THREE.Mesh(h.dome
    ? lathe([[0, top], [hr * 0.5, top * 0.95], [hr * 0.82, top * 0.78], [hr * 0.97, top * 0.45], [hr, top * 0.15], [hr * 0.94, 0]])
    : lathe([[0, top], [hr * 0.6, hr * 0.44], [hr * 0.92, hr * 0.38], [hr, hr * 0.26], [hr * 0.98, 0]]), m.hub)];
  if (m.hubRing) {
    const at = h.ringAt ?? 0.86;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(hr * at, hr * (h.ringWidth ?? 0.07), 10, 64), m.hubRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h.dome ? top * 0.62 : hr * 0.41;
    parts.push(ring);
  }
  if (m.hubCap) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(hr * (h.capR ?? 0.68), 48), m.hubCap);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = top + 0.002;
    parts.push(cap);
  }
  if (m.logo) {
    // the Aparna logo on the hub face (src/three/brand-mark.js): white on a dark hub, red on a light one
    parts.push(hubLogo(m.logo, hr * (h.logoScale ?? 1) * 0.8, top + 0.004));
  }
  return parts;
}

// The logo decal lying on a hub face (the rotor's +y), reading upright when the fan stands still.
function hubLogo(logoMaterial, width, y) {
  const light = logoMaterial.color.getHSL({}).l > 0.5;
  const mark = brandMark({ colour: light ? 'white' : 'red', width });
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = y;
  return mark;
}

function materials(colours) {
  const cache = {};
  const get = (...keys) => { for (const k of keys) if (colours[k]) return (cache[k] ??= physical(colours[k])); return null; };
  return {
    get,
    wire: get('wire'), rim: get('rim', 'wire'), blade: get('blade'), hub: get('hub'),
    body: get('body'), motor: get('motor', 'body'),
    base: get('base', 'body'), baseRim: get('baseRim', 'base', 'body'),
    accent: get('accent', 'body'), chrome: physical(CHROME),
    hubRing: get('hubRing'), hubCap: get('hubCap'), logo: get('logo'),
  };
}

function createFrontFan(name, cfg) {
  const m = materials(cfg.colours);
  const fan = new THREE.Group();
  fan.name = name;

  // ---- still parts: guards, motor housing, stand
  const stator = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = cfg.headY;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(cfg.motor, cfg.motor * 0.92, 0.2, 48), m.motor);
  motor.rotation.x = Math.PI / 2;
  motor.position.z = -0.17;
  const motorBack = new THREE.Mesh(new THREE.SphereGeometry(cfg.motor * 0.92, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.motor);
  motorBack.rotation.x = -Math.PI / 2;
  motorBack.position.z = -0.27;
  const g = { wires: 90, rings: [0.35, 0.62, 0.86], ...cfg.guard };
  head.add(
    // front and back guards far enough apart that the pitched blades sit fully between them
    guard(m.wire, m.rim, { side: 1, depth: 0.09, offset: 0.12, ...g }),
    // the back guard: plainer, and straight behind a criss-cross front
    guard(m.wire, m.rim, { side: -1, depth: 0.06, offset: 0.06, wires: Math.round(g.wires * (g.backWires ?? (g.cross ? 0.5 : 0.7))), rings: g.backRings ?? [0.45, 0.75], inner: 0.15, twist: g.cross ? 0 : -(g.twist ?? 0), twistFrom: g.twistFrom, thick: g.thick, rim: g.rim, band: 0 }),
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
  rotor.add(...hubParts(m, cfg.hub));
  const bladeGeo = bladeGeometry({ shape: cfg.blades.shape, tip: cfg.blades.tip ?? 0.45, root: hr * 0.8, pitch: cfg.blades.pitch ?? 0.38 });
  const blades = [];
  for (let i = 0; i < cfg.blades.count; i++) {
    const pivot = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, m.blade);
    blade.position.y = 0.03;
    pivot.add(blade);
    pivot.userData.restAngle = (i * Math.PI * 2) / cfg.blades.count + (cfg.blades.phase ?? 0);
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
const make = (name, cfg) => ({ shadows = false } = {}) => withShadows(createFrontFan(name, cfg), shadows);

// Layouts, from the height of the whole product in guard diameters (T) as measured on its photo:
// the head and the floor are placed so the product is centred on the origin, which the camera looks at.
const ped = (T) => ({ stand: 'pedestal', headY: T / 2 - 0.5, floorY: -T / 2, motor: 0.13, zoom: 1.8 / T });
const table = (T, stand = 'table') => ({ stand, headY: T / 2 - 0.5, floorY: -T / 2, motor: 0.12, zoom: 1.5 / T });
// a wall fan, from how far below the hub its lowest part (cord tassels or body) reaches
const wall = (below) => ({ stand: 'wall', headY: (below - 0.5) / 2, floorY: -(below + 0.5) / 2, motor: 0.12, zoom: 1.5 / (below + 0.5) });

// ---- colours
const SOFT = (color, extra = {}) => ({ color, roughness: 0.32, clearcoat: 0.7, ...extra });
const GLOSS = (color) => ({ color, metalness: 0.25, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
const BLADE = (color, opacity = 0.92) => ({ color, roughness: 0.3, clearcoat: 0.7, transparent: opacity < 1, opacity });
const WIRE = (color, metalness = 0.5) => ({ color, metalness, roughness: 0.35 });
const METAL_BLADE = { color: '#dfe3e7', metalness: 0.35, roughness: 0.25, clearcoat: 0.5 }; // bright brushed aluminium, as in the photos
const BLACK = GLOSS('#1c1d20');
const GUNMETAL = { color: '#4a4d52', metalness: 0.55, roughness: 0.3, clearcoat: 0.6 };
const WHITE = SOFT('#f2f2ef');
const CREAM = SOFT('#ece8da');
const BROAD3 = { count: 3, shape: 'fan', tip: 0.46, pitch: 0.32 };
const LOGO_DARK = { color: '#2a2622', roughness: 0.5 };
const LOGO_LIGHT = { color: '#f4f4f2', roughness: 0.5 };

// ---------------------------------------------------------------- high-speed pedestals

// Dark wire, dark body: the high-speed pedestal fans.
const HIGH_SPEED = {
  wire: WIRE('#3d4045', 0.7),
  blade: { color: '#62666c', metalness: 0.25, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 },
  hub: GLOSS('#26272a'), logo: LOGO_LIGHT,
  body: GLOSS('#2a2b2e'), pole: GUNMETAL,
  base: { color: '#6a6d72', metalness: 0.3, roughness: 0.38, clearcoat: 0.6 },
  baseRim: { color: '#18191b', roughness: 0.5 },
  foot: GLOSS('#1c1d20'),
};

// 106.png: square-mesh black guard (many rings), three dark swept blades, glossy black hub, gunmetal pole,
// grey domed base on a black rim
export const createSultan = make('sultan', {
  ...ped(2.1), standOptions: { collarH: 0, baseR: 0.4 },
  guard: { wires: 100, rings: [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.8, 0.88, 0.95], thick: 1.3 },
  hub: { radius: 0.13, dome: true },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: { ...HIGH_SPEED, wire: WIRE('#2a2b2e', 0.6) },
});

// 105.png: gunmetal wire, five black paddle blades, black hub, gunmetal pole, grey base on a black rim
export const createHexa = make('hexa', {
  ...ped(2.27), standOptions: { collarH: 0, baseR: 0.38 },
  guard: { wires: 96, rings: [0.42, 0.78], twist: 0.04, twistFrom: 0.78, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.12, dome: true, logoScale: 0.8 },
  blades: { count: 5, shape: 'paddle', tip: 0.44, pitch: 0.42 },
  colours: { ...HIGH_SPEED, blade: GLOSS('#202124'), hub: GLOSS('#1e1f22') },
});

export const createNexa = make('nexa', {
  ...ped(2.2), standOptions: { collarH: 0 },
  guard: { rings: [0.3, 0.86], wires: 90 },
  hub: { radius: 0.12 },
  blades: { count: 3, shape: 'paddle', tip: 0.45, pitch: 0.4 },
  colours: HIGH_SPEED,
});

// 109.png: bright silver wire on a dark rim, three very wide black blades, glossy black hub, dark grey pole,
// grey base on a black rim
export const createChampion = make('champion', {
  ...ped(2.1), standOptions: { collarH: 0, baseR: 0.4 },
  guard: { wires: 100, rings: [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.93], backRings: [0.6] }, // a fine square mesh
  hub: { radius: 0.11, dome: true, logoScale: 0.9 },
  blades: { count: 3, shape: 'clover', tip: 0.46, pitch: 0.32, phase: Math.PI / 6 },
  colours: { ...HIGH_SPEED, wire: WIRE('#c9ccd0', 0.35), rim: WIRE('#2a2b2e'), blade: GLOSS('#18191b'), hub: GLOSS('#141517') },
});

// 107.png: industrial guard (eight radial spokes, many rings), two S-curved dark blades, chrome-ringed hub,
// gunmetal pole that flares into a dark base
export const createIndus = make('indus', {
  ...ped(2.45), standOptions: { collarH: 0, foot: 'flare', baseR: 0.38, base: 'step' },
  guard: { wires: 8, thick: 3.5, inner: 0.17, rings: [0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.76, 0.82, 0.88, 0.94], rim: 1.6 },
  hub: { radius: 0.11, ringAt: 0.8, ringWidth: 0.16 },
  blades: { count: 2, shape: 'sickle', tip: 0.46, pitch: 0.4 },
  colours: { ...HIGH_SPEED, wire: WIRE('#55585d', 0.8), blade: GLOSS('#3a3c40'), hub: GLOSS('#1a1b1d'), hubRing: CHROME, logo: null, pole: { color: '#7d8187', metalness: 0.85, roughness: 0.25 }, base: GLOSS('#3a3c40'), baseRim: { color: '#1a1b1d' } },
});

// 108.png (new): silver-grey wire, four broad black blades, black hub with a silver ring, black pole,
// black base with fine radial ribs
export const createWindstar = make('windstar', {
  ...ped(2.35), standOptions: { collarH: 0, base: 'ribbed', baseR: 0.4 },
  guard: { wires: 100, rings: [0.55, 0.85], backRings: [0.6] },
  hub: { radius: 0.13, ringAt: 0.9, ringWidth: 0.08 },
  blades: { count: 4, shape: 'fan', tip: 0.45, pitch: 0.34, phase: Math.PI / 4 },
  colours: { ...HIGH_SPEED, wire: WIRE('#b9bcc0', 0.35), rim: WIRE('#2a2b2e'), blade: GLOSS('#1e1f22'), hub: GLOSS('#18191b'), hubRing: { color: '#b9bdc2', metalness: 0.9, roughness: 0.25 }, pole: BLACK, base: GLOSS('#26272a'), baseRim: { color: '#18191b' } },
});

// 101.png: dark grey wire, three narrow dark swept blades, grey ringed hub, a short chrome tube and a tilt
// collar, black pole, two-tier dark grey base
export const createBullet12 = make('bullet-12', {
  ...ped(2.05), standOptions: { upper: 0.1, collarH: 0.09, base: 'step', baseR: 0.47 },
  guard: { wires: 84, rings: [0.55, 0.82], twist: 0.05, twistFrom: 0.55, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.12, ringAt: 0.9 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: { ...HIGH_SPEED, hub: GLOSS('#3e4145'), hubRing: GLOSS('#2a2b2e'), pole: BLACK, collar: GLOSS('#2a2b2e'), base: GLOSS('#3e4145'), baseRim: { color: '#2a2b2e' }, foot: GLOSS('#2a2b2e') },
});

// 102.png: as the Bullet 12 on a taller pole: grey hub with a raised ring, chrome tube, dark collar
const BULLET_DARK = { ...HIGH_SPEED, hub: GLOSS('#3e4145'), hubRing: GLOSS('#2a2b2e'), pole: BLACK, collar: GLOSS('#2a2b2e'), base: GLOSS('#3e4145'), baseRim: { color: '#2a2b2e' }, foot: GLOSS('#2a2b2e') };
export const createBullet16 = make('bullet-16', {
  ...ped(2.55), standOptions: { upper: 0.08, collarH: 0.08, base: 'step', baseR: 0.45 },
  guard: { wires: 90, rings: [0.62, 0.86], twist: 0.04, twistFrom: 0.62, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.12, ringAt: 0.9 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: BULLET_DARK,
});
export const createBulletOsc16 = make('bullet-osc-16', {
  ...ped(2.55), standOptions: { upper: 0.1, collarH: 0.08, base: 'step', baseR: 0.4 },
  guard: { wires: 90, rings: [0.62, 0.86], twist: 0.04, twistFrom: 0.62, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.12, ringAt: 0.9 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: BULLET_DARK, // no photo: as the Bullet 16
});

// 103.png (new): black wire with many rings, four aluminium blades, small black hub with a silver ring,
// short chrome tube, black pole and domed black base
export const createBulletMetal16 = make('bullet-metal-16', {
  ...ped(2.55), standOptions: { upper: 0.12, collarH: 0.07, baseR: 0.4 },
  guard: { wires: 110, rings: [0.55, 0.8, 0.9], backRings: [0.6] },
  hub: { radius: 0.1, ringAt: 0.85, ringWidth: 0.1 },
  blades: { count: 4, shape: 'fan', tip: 0.45, pitch: 0.36, phase: Math.PI / 4 },
  colours: { ...HIGH_SPEED, wire: WIRE('#1f2022', 0.6), blade: METAL_BLADE, hub: GLOSS('#18191b'), hubRing: { color: '#c4c8cd', metalness: 0.9, roughness: 0.3 }, pole: BLACK, collar: BLACK, base: GLOSS('#1e1f22'), baseRim: { color: '#3a3b3e' }, foot: BLACK },
});

// 100.png: dark grey plastic grille with a deep rim band and criss-cross outer wires, three dark swept blades,
// dark grey hub, black pole, dark grey flat-domed base
export const createShine = make('shine', {
  ...ped(2.55), standOptions: { upper: 0.04, collarH: 0.12, baseR: 0.43 },
  guard: { wires: 72, rings: [0.32, 0.55], thick: 1.9, twist: 0.3, twistFrom: 0.55, cross: 'net', band: 0.07, backRings: [0.6] },
  hub: { radius: 0.11 },
  blades: { count: 3, shape: 'scimitar', pitch: 0.4 },
  colours: { ...HIGH_SPEED, wire: SOFT('#3a3c40'), blade: BLADE('#4a4d52', 0.96), hub: SOFT('#55585d'), pole: BLACK, collar: GLOSS('#2a2b2e'), base: GLOSS('#3a3c40'), baseRim: { color: '#2a2b2e' }, foot: GLOSS('#2a2b2e') },
});

// 99.png: light grey plastic grille (thick bars, a flat rim band), four dark grey blades, flat grey hub,
// chrome upper pole, dark grey collar, grey lower pole and domed grey base
export const createOrnet = make('ornet', {
  ...ped(2.35), motor: 0.12, standOptions: { upper: 0.22, collarH: 0.17, baseR: 0.37, poleR: 0.03 },
  guard: { wires: 56, rings: [0.38, 0.62, 0.82], thick: 2.3, band: 0.06 },
  hub: { radius: 0.145 },
  blades: { count: 4, shape: 'fan', tip: 0.43, pitch: 0.34 },
  colours: {
    wire: SOFT('#aeb1b5'), rim: SOFT('#a7aaae'), blade: BLADE('#6a6e74', 0.97), hub: SOFT('#5e6267'), logo: LOGO_LIGHT,
    body: SOFT('#55585d'), pole: SOFT('#5e6166', { metalness: 0.3 }), collar: SOFT('#4a4d52'),
    base: SOFT('#5e6166'), baseRim: { color: '#3a3c40' }, foot: SOFT('#4a4d52'),
  },
});

// 104.png (new): white wire with a blue rim, three narrow blue blades, blue hub, chrome upper pole, blue
// collar, white lower pole on a blue trumpet foot, white base on a dark rim
export const createMaxx = make('maxx', {
  ...ped(2.5), motor: 0.12, standOptions: { upper: 0.12, collarH: 0.11, foot: 'flare', base: 'step', baseR: 0.42 },
  guard: { wires: 100, rings: [0.45, 0.72], rim: 1.1, backRings: [0.6] },
  hub: { radius: 0.14 },
  blades: { count: 3, shape: 'narrow', tip: 0.45, pitch: 0.38 },
  colours: {
    wire: WIRE('#e9eaeb', 0.35), rim: SOFT('#2fa6e0'), blade: BLADE('#33a9e2', 0.95), hub: SOFT('#2fa6e0'), logo: LOGO_DARK,
    body: SOFT('#e6e8ea'), motor: SOFT('#d9dbde'), pole: WHITE, collar: SOFT('#2fa6e0'), foot: SOFT('#2fa6e0'),
    base: WHITE, baseRim: { color: '#3a3c40' },
  },
});

// ---------------------------------------------------------------- pedestals with a control pod

// 92.png: dark wire with an orange rim, three orange blades, orange hub, a black control pod with four keys
// under the head, black poles with an orange height-lock collar, flat black disc base
export const createStallion = make('stallion', {
  ...ped(2.65), motor: 0.12,
  standOptions: { pod: { w: 0.17, h: 0.36, keys: 4 }, upper: 0.17, collarH: 0.15, base: 'disc', baseR: 0.4 },
  guard: { wires: 110, rings: [0.58, 0.8], rim: 1.1, backRings: [0.6] },
  hub: { radius: 0.13 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#4a4c50', 0.5), rim: SOFT('#d98a4e'), blade: BLADE('#dc8c50', 0.97), hub: SOFT('#d98a4e'), logo: LOGO_DARK,
    body: BLACK, pod: GLOSS('#1f2124'), key: SOFT('#33363a'), upper: BLACK, collar: SOFT('#ee9a52'),
    base: GLOSS('#18191b'), baseRim: { color: '#111' }, foot: GLOSS('#26272a'),
  },
});

// 87.png: all white, a white pod with a grey face, a knob and four keys, black upper tube, grey collar,
// white pole, flat white disc base with a grey foot
export const createFiona = make('fiona', {
  ...ped(2.7), motor: 0.12,
  standOptions: { pod: { w: 0.18, h: 0.42, keys: 4, keysAt: 0.42, knob: 0.2 }, upper: 0.12, collarH: 0.15, base: 'disc', baseR: 0.43 },
  guard: { wires: 100, rings: [0.62], backRings: [0.6] },
  hub: { radius: 0.15, ringAt: 0.9 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#eceded', 0.3), blade: BLADE('#f4f5f6', 0.93), hub: SOFT('#f4f5f6'), hubRing: SOFT('#e2e4e6'), logo: LOGO_DARK,
    body: SOFT('#eeefef'), pod: SOFT('#eeefef'), podFace: SOFT('#a9adb3'), key: SOFT('#f2f2f2'), knob: SOFT('#f6f6f6'),
    upper: BLACK, collar: SOFT('#9da1a7'), pole: SOFT('#eceeee'), base: SOFT('#eceeee'), baseRim: { color: '#d9dbdd' }, foot: SOFT('#9da1a7'),
  },
});

// 97.png (new): white wire with a rose-pink rim, three pink blades and hub, a pink pod with white keys and
// knob, black upper tube, pink collar, white pole and flat white disc base
export const createIconic = make('iconic', {
  ...ped(2.75), motor: 0.12,
  standOptions: { pod: { w: 0.15, h: 0.46, keys: 3, roundKeys: true, keysAt: 0.2, knob: 0.68 }, upper: 0.1, collarH: 0.15, base: 'disc', baseR: 0.42 },
  guard: { wires: 100, rings: [0.55, 0.8], rim: 1.1, backRings: [0.6] },
  hub: { radius: 0.15 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#f1f1f0', 0.3), rim: SOFT('#d8857a'), blade: BLADE('#df8f84', 0.97), hub: SOFT('#d8857a'), logo: LOGO_DARK,
    body: SOFT('#d8857a'), pod: SOFT('#d8857a'), key: SOFT('#f7f7f5'), knob: SOFT('#f7f7f5'),
    upper: BLACK, collar: SOFT('#c9745f'), pole: WHITE, base: WHITE, baseRim: { color: '#dedfe0' }, foot: WHITE,
  },
});

// ---------------------------------------------------------------- table fans

// 89.png: cream wire with a teal rim, five narrow swept aqua blades, large cream hub, cream flared column,
// cream tapered base with an oval plinth and four round teal buttons
export const createVistara = make('vistara', {
  ...table(1.35), standOptions: { base: [0.66, 0.44, 0.16], taper: 0.24, column: [0.07, 0.17, 0.5], plinth: { w: 0.36, d: 0.24, h: 0.03, oval: true, z: -0.05 }, keys: { count: 4, round: true, spacing: 0.06 } },
  guard: { wires: 100, rings: [0.64], thick: 1, backRings: [0.6] },
  hub: { radius: 0.14, dome: true, logoScale: 0.7 },
  blades: { count: 5, shape: 'hockey', tip: 0.43, pitch: 0.34 },
  colours: {
    wire: WIRE('#e3ddc9', 0.4), rim: SOFT('#2bbcc6'), blade: BLADE('#3fd0d8', 0.95), hub: CREAM, logo: LOGO_DARK,
    body: CREAM, base: CREAM, key: SOFT('#2bbcc6'),
  },
});

// 88.png: white criss-cross wire with an aqua rim, three aqua blades, aqua hub with a white ring round a cream
// centre, cream column, aqua base with a cream insert and three cream keys
export const createVectra = make('vectra', {
  ...table(1.43), standOptions: { base: [0.74, 0.46, 0.12], taper: 0.1, column: [0.07, 0.14, 0.55], plinth: { w: 0.44, d: 0.34, h: 0.025, z: -0.06 }, keys: { count: 3 } },
  guard: { wires: 90, rings: [0.5], twist: 0.3, twistFrom: 0.5, cross: 'net', thick: 0.95, rim: 1.8, backRings: [0.6] },
  hub: { radius: 0.14, ringAt: 0.78, ringWidth: 0.07, capR: 0.7 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#eceeee', 0.35), rim: SOFT('#3cc8c8'), blade: BLADE('#5cd3d0', 0.9), hub: SOFT('#5cd3d0'), hubRing: WHITE, hubCap: CREAM, logo: LOGO_DARK,
    body: CREAM, base: SOFT('#47c9c9'), plinth: CREAM, key: CREAM,
  },
});

// 93.png: navy-black criss-cross wire with a copper rim, three translucent copper blades, copper hub, black
// column, copper tapered base with a black oval plinth and three black keys
export const createBlazo = make('blazo', {
  ...table(1.44), standOptions: { base: [0.78, 0.5, 0.12], taper: 0.12, column: [0.07, 0.15, 0.55], plinth: { w: 0.4, d: 0.32, h: 0.03, oval: true, z: -0.06 }, keys: { count: 3 } },
  guard: { wires: 90, rings: [0.55], twist: 0.28, twistFrom: 0.55, cross: 'net', thick: 0.95, rim: 0.9, backRings: [0.6] },
  hub: { radius: 0.14 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#283040', 0.5), rim: SOFT('#c98a6c', { metalness: 0.3 }), blade: BLADE('#d9906e', 0.9), hub: SOFT('#d48c6c'), logo: LOGO_DARK,
    body: GLOSS('#262a33'), base: SOFT('#d08a68', { metalness: 0.2 }), plinth: GLOSS('#262a33'), key: GLOSS('#2e323a'),
  },
});

// 94.png: cream criss-cross wire with a terracotta rim, three terracotta blades and hub, white column,
// terracotta base with a white insert and three white keys
export const createBlitz = make('blitz', {
  ...table(1.42), standOptions: { base: [0.74, 0.48, 0.12], taper: 0.1, column: [0.07, 0.13, 0.55], plinth: { w: 0.42, d: 0.36, h: 0.025, z: -0.05 }, keys: { count: 3 } },
  guard: { wires: 90, rings: [0.5], twist: 0.3, twistFrom: 0.5, cross: 'net', thick: 0.95, rim: 1.6, backRings: [0.6] },
  hub: { radius: 0.13 },
  blades: BROAD3,
  colours: {
    wire: WIRE('#ddd7ca', 0.35), rim: SOFT('#c06650'), blade: BLADE('#c96f5a', 0.98), hub: SOFT('#c06650'), logo: LOGO_DARK,
    body: WHITE, base: SOFT('#c06650'), plinth: WHITE, key: WHITE,
  },
});

// 80.png / 81.png (one photo, two sizes): fine white wire, five narrow white blades, grey hub, slim white column,
// a tall white battery base with a grey bottom band and a grey front panel with three black buttons
const GOAIR = {
  ...table(1.47), standOptions: { base: [0.5, 0.38, 0.33], taper: 0.06, column: [0.05, 0.08, 0.7], band: 0.035, face: { w: 0.3, h: 0.11, y: 0.62, buttons: 3 } },
  // fine straight wires crossed by many evenly spaced rings, as in the photo
  guard: { wires: 110, rings: [0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9], thick: 1, backRings: [0.6] },
  hub: { radius: 0.1, logoScale: 0.9 },
  blades: { count: 5, shape: 'narrow', tip: 0.45, pitch: 0.34 },
  colours: {
    wire: WIRE('#e6e8ea', 0.35), blade: BLADE('#dde1e6', 0.78), hub: SOFT('#686c72'), logo: LOGO_LIGHT,
    body: SOFT('#eeeff1'), base: SOFT('#eeeff1'), band: SOFT('#8e9298'), panel: SOFT('#8e9298'), key: GLOSS('#1c1d20'),
  },
};
export const createGoair12 = make('goair-12', GOAIR);
export const createGoair16 = make('goair-16', GOAIR);

// 86.png: all black: criss-cross outer wire, five narrow swept black blades, black hub, round base with a
// raised plinth and a timer knob
export const createGlider = make('glider', {
  ...table(1.29, 'tableRound'), motor: 0.13, standOptions: { baseR: 0.29, depth: 0.85, column: [0.075, 0.1], plinth: [0.3, 0.22], knob: true },
  guard: { wires: 80, rings: [0.62], twist: 0.045, twistFrom: 0.62, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.115 },
  blades: { count: 5, shape: 'crescent', tip: 0.44, pitch: 0.38 },
  colours: { wire: WIRE('#1f2022', 0.5), blade: GLOSS('#1d1e21'), hub: GLOSS('#18191b'), logo: LOGO_LIGHT, body: BLACK, knob: GLOSS('#2e3034') },
});

// 82.png (new): all black: straight wire, three broad black blades, large black hub with a raised ring,
// tall tapered column, round base with a raised plinth and a knob
export const createOreo = make('oreo', {
  ...table(1.53, 'tableRound'), motor: 0.13, standOptions: { baseR: 0.36, depth: 0.75, column: [0.07, 0.11], plinth: [0.3, 0.22], knob: true },
  guard: { wires: 90, rings: [0.4, 0.86] },
  hub: { radius: 0.19, ringAt: 0.88, ringWidth: 0.06 },
  blades: BROAD3,
  colours: { wire: WIRE('#1f2022', 0.5), blade: GLOSS('#1a1b1d'), hub: GLOSS('#18191b'), hubRing: GLOSS('#2a2b2e'), logo: LOGO_LIGHT, body: BLACK, knob: GLOSS('#2e3034') },
});

// 85.png: all black with grey translucent blades: criss-cross wire, dark hub with a raised ring, round base
// with three keys
export const createSpider = make('spider', {
  ...table(1.38, 'tableRound'), motor: 0.13, standOptions: { baseR: 0.3, depth: 0.85, column: [0.075, 0.12], keys: 3 },
  guard: { wires: 84, rings: [0.46, 0.76], twist: 0.32, twistFrom: 0.46, cross: 'net', thick: 0.95, backRings: [0.6] },
  hub: { radius: 0.145, ringAt: 0.88, ringWidth: 0.07 },
  blades: { count: 3, shape: 'scimitar', tip: 0.45, pitch: 0.36 }, // long swept grey blades
  colours: { wire: WIRE('#26272a', 0.5), blade: BLADE('#8a8f96', 0.9), hub: GLOSS('#26272a'), hubRing: GLOSS('#3a3c40'), logo: LOGO_LIGHT, body: BLACK, key: GLOSS('#2e3034') },
});

// ---------------------------------------------------------------- wall fans

// 83.png: dark straight wire, three grey translucent blades, large black hub, black body below with a round
// dimple, two pull cords with black tassels
export const createVento = make('vento', {
  ...wall(1.05), standOptions: { body: [0.33, 0.6], drop: 0.26, detailAt: 0.5, cords: true, cord: 0.13, dimple: 0.1 },
  // thin straight wires and one ring near the rim, as in the photo
  guard: { wires: 84, rings: [0.84], thick: 1.09 },
  hub: { radius: 0.2, dome: true },
  blades: { count: 3, shape: 'wide', tip: 0.455, pitch: 0.3 }, // three big pale petals that nearly fill the guard
  colours: { wire: WIRE('#2f3033', 0.6), blade: BLADE('#a9b2be', 0.82), hub: GLOSS('#18191b'), logo: LOGO_LIGHT, body: BLACK, base: GLOSS('#26272a') },
});

// 84.png: dark criss-cross wire, three grey translucent swept blades, glossy dark hub, dark grey body with a
// round knob, two pull cords with black tassels
export const createTornado = make('tornado', {
  ...wall(0.84), standOptions: { body: [0.25, 0.46], drop: 0.25, knob: true, cords: true, cord: 0.05 },
  // thin wires, straight to a ring at half the radius, then a diamond net out to the rim
  guard: { wires: 76, rings: [0.48], twist: 0.3, twistFrom: 0.48, cross: 'net', thick: 0.95, backRings: [0.6] },
  hub: { radius: 0.15, dome: true, logoScale: 0.6 },
  blades: { count: 3, shape: 'scimitar', tip: 0.45, pitch: 0.34 }, // long pale swept blades
  colours: { wire: WIRE('#3b3d41', 0.6), blade: BLADE('#a9b2be', 0.82), hub: GLOSS('#2e3034'), logo: LOGO_LIGHT, body: GLOSS('#34363a'), knob: GLOSS('#232427'), tassel: BLACK },
});

// 96.png: black wire with a copper rim, three copper blades, large copper hub, tall black body with a copper knob
export const createJazz = make('jazz', {
  ...wall(0.96), standOptions: { body: [0.22, 0.56], drop: 0.4, knob: true, detailAt: 0.6, narrowTop: 0.35 },
  guard: { wires: 96, rings: [0.55, 0.8, 0.9], rim: 0.8, backRings: [0.6] },
  hub: { radius: 0.19 },
  blades: BROAD3,
  colours: { wire: WIRE('#1f2022', 0.5), rim: SOFT('#c2703a', { metalness: 0.3 }), blade: BLADE('#cf7438', 0.98), hub: SOFT('#d27a40'), logo: LOGO_DARK, body: BLACK, knob: SOFT('#d27a40') },
});

// 95.png: black wire with a copper rim, three copper blades and hub, a short black body with a copper knob,
// two pull cords with black tassels
export const createVelora = make('velora', {
  ...wall(0.84), standOptions: { body: [0.21, 0.42], drop: 0.3, knob: true, detailAt: 0.55, cords: true, cord: 0.06 },
  guard: { wires: 110, rings: [0.62, 0.86], rim: 0.75, backRings: [0.6] },
  hub: { radius: 0.155 },
  blades: BROAD3,
  colours: { wire: WIRE('#1f2022', 0.5), rim: SOFT('#c27a45', { metalness: 0.3 }), blade: BLADE('#c8773e', 0.98), hub: SOFT('#c8773e'), logo: LOGO_DARK, body: BLACK, knob: SOFT('#c8773e'), tassel: BLACK },
});

// 91.png: all white: criss-cross wire, three white blades, white hub with a ring, a white body with a black
// ring switch and tail, two pull cords with white tassels
export const createWendy = make('wendy', {
  ...wall(1.17), standOptions: { body: [0.3, 0.55], drop: 0.35, ring: true, ringTail: true, detailAt: 0.5, cords: true, cord: 0.13 },
  // straight wires to a ring at 0.72 of the radius, then eye-shaped loops out to the rim
  guard: { wires: 72, rings: [0.72], twist: 0.05, twistFrom: 0.72, cross: 'loop', thick: 1, backRings: [0.6] },
  hub: { radius: 0.18, ringAt: 0.9, logoScale: 0.6 },
  blades: { ...BROAD3, tip: 0.45 },
  colours: { wire: WIRE('#e4e6e8', 0.35), blade: BLADE('#e8ebee', 0.9), hub: WHITE, hubRing: SOFT('#e2e4e6'), logo: LOGO_DARK, body: WHITE, accent: GLOSS('#1b1c1e'), tassel: WHITE, cord: SOFT('#d8d9db') },
});

// 90.png (new): all black: dense straight wire with a wide outer band of rings, three black blades, black hub
// with a raised ring, a short black body with a swivel knob, two long pull cords with black tassels
export const createTesla = make('tesla', {
  ...wall(0.96), standOptions: { body: [0.27, 0.28], drop: 0.37, knob: true, detailAt: 0.3, cords: true, cord: 0.24 },
  // fine wires inside, and an outer band of fewer, thicker bars between two rings
  guard: { wires: 120, rings: [0.58, 0.8, 0.9], thick: 0.75, outer: [0.8, 76], outerThick: 3.8, rim: 1.4, backRings: [0.6] },
  hub: { radius: 0.16, ringAt: 0.88, ringWidth: 0.08 },
  blades: BROAD3,
  colours: { wire: WIRE('#1c1d1f', 0.5), blade: GLOSS('#1a1b1d'), hub: GLOSS('#141517'), hubRing: GLOSS('#2a2b2e'), logo: LOGO_LIGHT, body: BLACK, knob: GLOSS('#2a2b2e'), tassel: BLACK },
});

export const createSpectra = make('spectra', {
  ...wall(1.12), standOptions: { body: [0.25, 0.36], drop: 0.44, ring: true, cords: true },
  guard: { rings: [0.3, 0.6, 0.86], wires: 90 },
  hub: { radius: 0.15, dome: true },
  blades: BROAD3,
  colours: { wire: WIRE('#e8e6e1', 0.35), blade: BLADE('#f2f2ef', 0.93), hub: WHITE, body: WHITE, base: SOFT('#d9d9d6'), accent: { color: '#9a9ea4', metalness: 0.3, roughness: 0.35 } },
});

// ---------------------------------------------------------------- all-purpose fans

const AP_WHITE = (rim) => ({
  ...table(1.42), standOptions: { keys: { count: 4 } },
  guard: { rings: [0.35, 0.62, 0.86], wires: 80 },
  hub: { radius: 0.14 },
  blades: BROAD3,
  colours: { wire: WIRE('#e4dccb', 0.35), rim, blade: BLADE('#f2f2ef', 0.93), hub: SOFT('#f4f4f2'), body: SOFT('#eeeeea'), base: SOFT('#eeeeea'), accent: SOFT('#1f8fc7') },
});
export const createJawa = make('jawa', AP_WHITE(SOFT('#2a8fb8')));
export const createRegal = make('regal', { ...AP_WHITE(SOFT('#7cc7d6')), colours: { ...AP_WHITE().colours, wire: { color: '#9fd3df', metalness: 0.3, roughness: 0.35, transparent: true, opacity: 0.85 }, rim: SOFT('#7cc7d6') } });

// 73.png: dark grey plastic cage (a deep drum rim, swirled inner bars round a small cap), three light grey
// blades, tapered dark column on a rounded square base with a chrome-ringed knob
export const createSafari = make('safari', {
  ...table(1.53), motor: 0.11, standOptions: { base: [0.56, 0.5, 0.14], taper: 0.12, column: [0.08, 0.14, 0.6], knob: { ring: true } },
  guard: { wires: 16, rings: [0.3, 0.6], thick: 3.5, twist: 3, twistFrom: 0, outer: [0.6, 48], outerThick: 1, band: 0.12, inner: 0.1, backRings: [0.6] },
  hub: { radius: 0.09, ringAt: 0.95, ringWidth: 0.05 },
  blades: { count: 3, shape: 'broad', tip: 0.44, pitch: 0.4 },
  colours: {
    wire: SOFT('#3a4045'), rim: SOFT('#343a3f'), blade: BLADE('#9aa1a7', 0.95), hub: SOFT('#4d5459'), hubRing: SOFT('#3a4045'),
    body: GLOSS('#30363b'), base: GLOSS('#30363b'), knob: GLOSS('#24282c'),
  },
});

// 71.png / 72.png: criss-cross wire, three blades (aluminium on the black, white on the white), large flat hub,
// a C-shaped yoke round the bottom into a round puck base on a wider bottom plate, with a row of keys
const PIANO = (dark) => ({
  stand: 'yoke', headY: 0.17, floorY: -0.67, motor: 0.13, zoom: 1.12,
  standOptions: { armR: 0.57, baseR: 0.3, baseH: 0.14, keys: 4 },
  // a dense diamond net from close to the hub (black) or from half way (white)
  guard: dark
    ? { wires: 56, rings: [0.42, 0.72], twist: 0.4, twistFrom: 0.42, cross: 'net', thick: 1.15, rim: 1.3, backRings: [0.6], backWires: 0.5 }
    : { wires: 60, rings: [0.55], twist: 0.32, twistFrom: 0.55, cross: 'net', thick: 1.15, rim: 1.3, backRings: [0.6], backWires: 0.5 },
  hub: { radius: 0.165, ringAt: 0.94, ringWidth: 0.05 },
  // four aluminium paddles on the black, three broad white blades on the white
  blades: dark ? { count: 4, shape: 'paddle', tip: 0.43, pitch: 0.4, phase: Math.PI / 4 } : { count: 3, shape: 'broad', tip: 0.44, pitch: 0.34 },
  colours: dark
    ? { wire: WIRE('#1f2022', 0.5), blade: METAL_BLADE, hub: SOFT('#3a3c40'), hubRing: GLOSS('#26272a'), logo: LOGO_LIGHT, body: BLACK, base: BLACK, baseRim: GLOSS('#26272a'), accent: { color: '#b39a5c', metalness: 0.9, roughness: 0.3 }, panel: SOFT('#c8323a'), key: WHITE, key1: SOFT('#e04848') }
    : { wire: WIRE('#eeeff0', 0.3), blade: BLADE('#f4f5f6', 0.95), hub: WHITE, hubRing: SOFT('#e6e7e9'), logo: LOGO_DARK, body: WHITE, base: WHITE, baseRim: GLOSS('#26272a'), accent: { color: '#b39a5c', metalness: 0.9, roughness: 0.3 }, key: SOFT('#e9e6e0'), key1: SOFT('#7a2a33') },
});
export const createPianoBlack = make('piano-black', PIANO(true));
export const createPianoWhite = make('piano-white', PIANO(false));

// 74.png (coming soon): white plastic grille with swirled bars, three sky-blue blades, large blue hub, a wide
// white yoke band from the sides, a white tray base on a blue bottom band, with a blue knob
export const createSwivel = make('swivel', {
  stand: 'yoke', headY: 0.1, floorY: -0.6, motor: 0.12, zoom: 1.2,
  standOptions: { armR: 0.56, armDepth: 2.2, base: 'tray', tray: [0.66, 0.42], baseH: 0.16, band: 0.06, knob: true },
  // curved bars from the hub to a ring at 0.72, straight bars outside it
  guard: { wires: 40, rings: [0.36, 0.55, 0.72], thick: 2.9, twist: 1.6, twistFrom: 0, outer: [0.72, 64], outerThick: 1, band: 0.05, backRings: [0.6] },
  hub: { radius: 0.14 },
  blades: BROAD3,
  colours: {
    wire: SOFT('#f3f3f1'), rim: SOFT('#eeeeec'), blade: BLADE('#3cb7e2', 0.97), hub: SOFT('#3cb7e2'), logo: LOGO_DARK,
    body: SOFT('#eeeeec'), arm: SOFT('#e8e8e6'), base: SOFT('#f3f3f1'), band: SOFT('#3cb7e2'), knob: SOFT('#3cb7e2'), accent: { color: '#b39a5c', metalness: 0.9, roughness: 0.3 },
  },
});

// 75.png (coming soon): white plastic grille with thick straight bars, three aqua blades, aqua hub, a short white
// column, a white rounded base on an aqua band, with an aqua panel and a white knob
export const createCompact = make('compact', {
  ...table(1.45), standOptions: { base: [0.6, 0.46, 0.22], taper: 0.14, column: [0.08, 0.14, 0.6], band: 0.05, knob: { panel: 0.22 } },
  guard: { wires: 60, rings: [0.3, 0.6, 0.85], thick: 2.75, band: 0.05 },
  hub: { radius: 0.12 },
  blades: BROAD3,
  colours: {
    wire: SOFT('#f1f1ef'), rim: SOFT('#ebebe9'), blade: BLADE('#86d9d6', 0.96), hub: SOFT('#86d9d6'), logo: LOGO_DARK,
    body: SOFT('#f1f1ef'), base: SOFT('#f1f1ef'), band: SOFT('#5cc9c9'), panel: SOFT('#86d9d6'), knob: WHITE,
  },
});

// ---------------------------------------------------------------- exhaust and ventilation fans
// FRESH AIR FAN HIGH SPEED 9"/12" (110.png): taupe metal frame with bowed sides, a round opening with a taupe
//   wire grille (straight spokes, four rings), three taupe blades, a black hub with a white ring, brass bolt
//   clusters in the corners and the motor carried at the back on four struts.
// VENTILATION FAN 6"/8"/10" (76-78.png, one design): white plastic square frame with a deep rounded surround
//   round the opening and a tab under it, five white blades, a white hub with a small centre boss, the rear
//   bracket bars showing through.
// HEAVY-DUTY EXHAUST (147.png, coming soon): dark grey steel frame with cut corners, a large open ring, four wide
//   metal blades on an open spider hub, the motor at the back on flat bars, silver bolts.

function frameShape(style, size, radius, pinch) {
  const h = size / 2, r = radius, p = pinch;
  const s = new THREE.Shape();
  if (style === 'octagon') {
    const c = size * 0.12; // the cut corners
    s.moveTo(-h + c, -h); s.lineTo(h - c, -h); s.lineTo(h, -h + c); s.lineTo(h, h - c);
    s.lineTo(h - c, h); s.lineTo(-h + c, h); s.lineTo(-h, h - c); s.lineTo(-h, -h + c); s.closePath();
    return s;
  }
  s.moveTo(-h + r, -h);
  s.quadraticCurveTo(0, -h + p, h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.quadraticCurveTo(h - p, 0, h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.quadraticCurveTo(0, h - p, -h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
  s.quadraticCurveTo(-h + p, 0, -h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

function squareFrame(style, size, hole, depth, radius, material, pinch = 0) {
  const s = frameShape(style, size, radius, pinch);
  const opening = new THREE.Path();
  opening.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(opening);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 48 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function wallFan(name, { style, frame, hole, blades, hub, grille, struts, colours, fresh = false }) {
  const m = materials({
    copper: { color: '#b8653f', metalness: 1, roughness: 0.28 },
    dark: { color: '#151516', roughness: 0.6 },
    brass: { color: '#b39a5c', metalness: 0.9, roughness: 0.32 },
    white: { color: '#f1f2f3', roughness: 0.3, clearcoat: 0.8 },
    bolt: { color: '#c9ccd0', metalness: 0.9, roughness: 0.3 },
    ...colours,
  });
  const M = (k, ...f) => m.get(k, ...f);
  const fan = new THREE.Group();
  fan.name = name;
  const stator = new THREE.Group();
  const frameM = M('frame');
  stator.add(squareFrame(style, frame, hole, style === 'octagon' ? 0.03 : 0.06, style === 'plain' ? 0.05 : 0.16, frameM, style === 'pinched' ? 0.035 : 0));
  if (style === 'pinched') { // a raised lip round the opening
    placed(stator, new THREE.TorusGeometry(hole + 0.015, 0.022, 12, 96), frameM, 0, 0, 0.035);
  } else if (style === 'plain') {
    // the deep rounded surround, and the tab under it
    placed(stator, new THREE.TorusGeometry(hole + 0.05, 0.055, 18, 96), frameM, 0, 0, 0.03).scale.z = 0.8;
    placed(stator, roundedBox(0.3, 0.07, 0.04, 0.015), frameM, 0, -(hole + 0.1), 0.05);
    // rear bracket bars behind the opening
    for (const x of [-0.16, 0.13]) placed(stator, new THREE.BoxGeometry(0.045, hole * 1.9, 0.03), frameM, x, 0, -0.13);
    for (const y of [-0.2, 0.15]) placed(stator, new THREE.BoxGeometry(hole * 1.9, 0.045, 0.03), frameM, 0, y, -0.14);
  } else if (style === 'octagon') {
    // a folded flange round the opening
    placed(stator, new THREE.CylinderGeometry(hole, hole, 0.05, 72, 1, true).rotateX(Math.PI / 2), frameM, 0, 0, 0.01);
  }
  // a short round shroud behind the opening
  placed(stator, new THREE.CylinderGeometry(hole, hole, 0.12, 64, 1, true).rotateX(Math.PI / 2), frameM, 0, 0, -0.07);
  if (grille) {
    // front wire grille: rings and straight radial spokes across the opening
    const dome = (r) => 0.045 + 0.03 * (1 - (r / hole) ** 2);
    const geos = [];
    for (const f of grille.rings) geos.push(new THREE.TorusGeometry(hole * f, 0.0045, 6, 72).translate(0, 0, dome(hole * f)));
    for (let i = 0; i < grille.spokes; i++) {
      const a = (i / grille.spokes) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 5; k++) { const rr = hole * (grille.from + (1 - grille.from) * (k / 5)); pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, dome(rr))); }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 5, 0.004, 4));
    }
    stator.add(mergedMesh(geos, M('wire', 'frame')));
  }
  // corner fittings: a mounting hole and bolts
  for (const [x, y] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    if (style === 'plain') break;
    const cx = x * frame * 0.42, cy = y * frame * 0.42;
    placed(stator, new THREE.TorusGeometry(0.02, 0.007, 8, 24), m.get('white'), cx, cy, 0.04);
    const bolts = fresh ? [[-0.1, 0], [0, -0.1], [-0.07, -0.07], [-0.05, -0.13]] : [[-0.12, 0.02], [0.02, -0.12]];
    for (const [dx, dy] of bolts) {
      const bolt = placed(stator, new THREE.CylinderGeometry(0.018, 0.018, 0.025, 6), m.get(fresh ? 'brass' : 'bolt'), cx + x * dx, cy + y * dy, 0.045);
      bolt.rotation.x = Math.PI / 2;
    }
  }
  if (struts) {
    // the motor on four struts at the back
    const mr = struts.motor ?? 0.15;
    const motorM = M('motor', 'frame');
    placed(stator, new THREE.CylinderGeometry(mr, mr, 0.3, 40).rotateX(Math.PI / 2), motorM, 0, 0, -0.36);
    if (fresh) placed(stator, new THREE.CylinderGeometry(mr + 0.005, mr + 0.005, 0.05, 40).rotateX(Math.PI / 2), m.get('brass'), 0, 0, -0.25);
    const cap = placed(stator, new THREE.CircleGeometry(mr, 40), motorM, 0, 0, -0.51);
    cap.rotation.y = Math.PI;
    for (const [x, y] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const from = new THREE.Vector3(x * frame * 0.36, y * frame * 0.36, -0.02);
      const to = new THREE.Vector3(x * mr * 0.7, y * mr * 0.7, -0.25);
      const geo = struts.flat ? new THREE.BoxGeometry(0.05, from.distanceTo(to), 0.012) : new THREE.CylinderGeometry(0.016, 0.016, from.distanceTo(to), 8);
      const strut = placed(stator, geo, M('strut', 'frame'), 0, 0, 0);
      strut.position.copy(from).add(to).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
  } else {
    // a shallow motor housing behind the plastic fans
    placed(stator, new THREE.CylinderGeometry(0.13, 0.15, 0.12, 40).rotateX(Math.PI / 2), frameM, 0, 0, -0.18);
  }

  const axis = new THREE.Group();
  axis.rotation.x = Math.PI / 2; // the rotor's y axis points out of the front (+z)
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  axis.add(rotor);
  const hr = hub.radius;
  const hubM = M('hub');
  if (hub.style === 'ringed') {
    rotor.add(new THREE.Mesh(lathe([[0, 0.075], [hr * 0.85, 0.074], [hr * 0.97, 0.06], [hr, 0.03], [hr * 0.98, -0.02]]), hubM));
    const ring = placed(rotor, new THREE.TorusGeometry(hr * 0.96, 0.012, 10, 64), M('hubRing', 'white'), 0, 0.064, 0);
    ring.rotation.x = Math.PI / 2;
    if (m.logo) rotor.add(hubLogo(m.logo, hr * 0.8, 0.078));
  } else if (hub.style === 'open') {
    // an open spider ring with the shaft end inside
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, 0.1, 40, 1, true), hubM));
    placed(rotor, new THREE.TorusGeometry(hr, 0.008, 8, 40).rotateX(Math.PI / 2), hubM, 0, 0.05, 0);
    placed(rotor, new THREE.CylinderGeometry(hr * 0.3, hr * 0.3, 0.12, 16), m.get('bolt'), 0, 0, 0);
    placed(rotor, new THREE.CircleGeometry(hr * 0.98, 40).rotateX(Math.PI / 2), m.get('dark'), 0, -0.03, 0);
  } else {
    rotor.add(new THREE.Mesh(lathe([[0, hr * 0.7], [hr * 0.6, hr * 0.68], [hr * 0.9, hr * 0.6], [hr, hr * 0.4], [hr * 0.98, -0.02]]), hubM));
    placed(rotor, new THREE.CylinderGeometry(hr * 0.22, hr * 0.24, 0.03, 20), hubM, 0, hr * 0.7 + 0.012, 0); // centre boss
  }
  const bladeGeo = bladeGeometry({ shape: blades.shape, tip: hole * (blades.reach ?? 0.95), root: hr * 0.7, pitch: blades.pitch });
  const list = [];
  for (let i = 0; i < blades.count; i++) {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(bladeGeo, M('blade')));
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
  style: 'pinched', frame: 1.0, hole: 0.4, fresh: true,
  hub: { radius: 0.1, style: 'ringed' },
  grille: { spokes: 36, rings: [0.27, 0.5, 0.75, 1.0], from: 0.25 },
  struts: { motor: 0.15, flat: true }, // the photo's four flat bars
  blades: { count: 3, shape: 'scoop', pitch: 0.45, reach: 0.9 },
  colours: { // as in the photo: warm taupe frame, grille and blades, black hub with a white ring
    frame: { color: '#6f6862', metalness: 0.35, roughness: 0.45 },
    wire: { color: '#827b74', metalness: 0.4, roughness: 0.4 },
    blade: { color: '#7a746e', metalness: 0.4, roughness: 0.38 },
    hub: GLOSS('#111214'), hubRing: { color: '#f1f2f3', roughness: 0.3 }, logo: LOGO_LIGHT,
    motor: { color: '#6d6f73', metalness: 0.6, roughness: 0.35 },
  },
};
export const createFreshAir9 = ({ shadows = false } = {}) => withShadows(wallFan('fresh-air-9', FRESH_AIR), shadows);
export const createFreshAir12 = ({ shadows = false } = {}) => withShadows(wallFan('fresh-air-12', FRESH_AIR), shadows);

const VENTILATION = {
  style: 'plain', frame: 1.0, hole: 0.38, grille: null, struts: null,
  hub: { radius: 0.105 },
  blades: { count: 5, shape: 'vent', pitch: 0.42, reach: 0.9 },
  colours: {
    frame: { color: '#f3f2ee', roughness: 0.32, clearcoat: 0.6 },
    blade: { color: '#f6f5f2', roughness: 0.3, clearcoat: 0.6 },
    hub: { color: '#f6f5f2', roughness: 0.28, clearcoat: 0.8 },
  },
};
export const createVentilation = ({ shadows = false } = {}) => withShadows(wallFan('ventilation', VENTILATION), shadows);

const HEAVY_EXHAUST = {
  style: 'octagon', frame: 1.0, hole: 0.45, grille: null, // a narrow frame round a big opening
  hub: { radius: 0.085, style: 'open' },
  struts: { motor: 0.14, flat: true },
  blades: { count: 4, shape: 'wide', pitch: 0.5, reach: 0.92 },
  colours: {
    frame: { color: '#4a4e52', metalness: 0.45, roughness: 0.4, clearcoat: 0.4 },
    blade: { color: '#454a4e', metalness: 0.55, roughness: 0.35, clearcoat: 0.5 },
    hub: { color: '#3f4347', metalness: 0.55, roughness: 0.35 },
    motor: { color: '#3f4347', metalness: 0.5, roughness: 0.4 },
  },
};
export const createHeavyExhaust = ({ shadows = false } = {}) => withShadows(wallFan('heavy-exhaust', HEAVY_EXHAUST), shadows);

// Every model in this file, by its key in src/three/models.js.
export const FRONT_MODELS = {
  sultan: createSultan, hexa: createHexa, nexa: createNexa, fiona: createFiona, vistara: createVistara,
  glider: createGlider, spider: createSpider, vento: createVento, spectra: createSpectra, wendy: createWendy,
  tornado: createTornado, jazz: createJazz, velora: createVelora, vectra: createVectra, blazo: createBlazo,
  blitz: createBlitz, 'goair-12': createGoair12, 'goair-16': createGoair16, jawa: createJawa, regal: createRegal,
  safari: createSafari, 'piano-black': createPianoBlack, 'piano-white': createPianoWhite, stallion: createStallion,
  'bullet-12': createBullet12, 'bullet-16': createBullet16, 'bullet-osc-16': createBulletOsc16, ornet: createOrnet,
  shine: createShine, champion: createChampion, indus: createIndus,
  'fresh-air-9': createFreshAir9, 'fresh-air-12': createFreshAir12, ventilation: createVentilation,
  // built from the studio photos
  oreo: createOreo, tesla: createTesla, iconic: createIconic, 'bullet-metal-16': createBulletMetal16,
  maxx: createMaxx, windstar: createWindstar, swivel: createSwivel, compact: createCompact, 'heavy-exhaust': createHeavyExhaust,
};
