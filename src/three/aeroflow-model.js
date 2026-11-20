// The Aparna AEROFLOW BLDC ceiling fan (1200 mm, three blades), built procedurally in three.js.
// References: studio photos 01 (three-quarter view from below) and 02 (from below), catalogue leaf 3, poster "04
// AEROFLOW". The blade outline is traced from photo 02; the blades' angle and rise, the canopy, drop and motor size are
// fitted so the model's outline lines up with both photos (by a local photo-matching script in .cache/aeroflow-match,
// not part of the site: its match.mjs measures the difference).
//
// Units: the blade tip sits at radius 1. The fan hangs from y = CANOPY_TOP down to the blades at y = 0.
// The rotor (motor shell + blades) is a separate group so it can spin while the downrod and canopy stay still.

import * as THREE from 'three';
import woodUrl from './textures/aeroflow-wood.webp';
import { brandMarkCurved } from './brand-mark.js';
import { neckScrew, CANOPY_GAP } from './fan-mount.js';
import { createMotorInternals } from './bldc-motor.js';

export const BLADE_COUNT = 3; // Brief §3.7: always exactly three blades.
export const CANOPY_TOP = 0.696; // studio photo 01 (fitted): the canopy's top, about 0.7 blade radii above the blades

// ---------------------------------------------------------------- finishes

const chrome = { color: '#eceef0', metalness: 1, roughness: 0.18 };
const copper = { color: '#b8653f', metalness: 1, roughness: 0.28 };
const bronze = { color: '#c08c68', metalness: 0.85, roughness: 0.3 }; // the soft champagne-copper rings of the Wood Craft photos

export const FINISHES = {
  white: {
    blade: { color: '#f5f4f1', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 },
    body: { color: '#f2f1ee', roughness: 0.3, clearcoat: 0.8 },
    cap: { color: '#eeede9', roughness: 0.3, clearcoat: 0.8 },
    trim: { color: '#f2f1ee', roughness: 0.3, clearcoat: 0.8 },
    accent: chrome,
  },
  grey: {
    blade: { color: '#8b8e92', metalness: 0.55, roughness: 0.38, clearcoat: 0.6 },
    body: { color: '#8e9195', metalness: 0.55, roughness: 0.36, clearcoat: 0.6 },
    cap: { color: '#8a8d91', metalness: 0.55, roughness: 0.36, clearcoat: 0.6 },
    trim: { color: '#8e9195', metalness: 0.55, roughness: 0.36, clearcoat: 0.6 },
    accent: chrome,
  },
  golden: {
    blade: { color: '#dcb27a', metalness: 0.4, roughness: 0.4, clearcoat: 0.5 },
    body: { color: '#d9ae74', metalness: 0.4, roughness: 0.38, clearcoat: 0.5 },
    cap: { color: '#dcb27a', metalness: 0.4, roughness: 0.36, clearcoat: 0.5 },
    trim: { color: '#d9ae74', metalness: 0.4, roughness: 0.38, clearcoat: 0.5 },
    accent: copper,
  },
  wood: {
    blade: { wood: true, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.3 },
    body: { wood: true, roughness: 0.46, clearcoat: 0.45 }, // the motor shell is wood like the blades
    mount: { color: '#a56a48', roughness: 0.42, clearcoat: 0.35 }, // studio photo 01: a plain tan canopy and downrod (this shade draws as the photo's tan, 162 111 79, under the site's lights)
    cap: { wood: true, roughness: 0.45, clearcoat: 0.5 },
    trim: { wood: true, roughness: 0.48, clearcoat: 0.45 },
    accent: bronze,
  },
};
// The canopy and downrod are in the body colour, except where a finish names its own (Wood Craft).
for (const f of Object.values(FINISHES)) f.mount ??= f.body;

// ---------------------------------------------------------------- geometry helpers

// Turns a list of [radius, height] points into a smooth surface of revolution.
export function lathe(points, segments = 64) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return new THREE.LatheGeometry(curve.getPoints(48), segments);
}

// One blade's outline, traced from studio photo 02 (the Wood Craft fan seen from below, its camera tilt undone and
// its blades averaged): [radius (blade tip = 1), edge A, edge B], the edges in degrees from the blade's axis, B on
// the side the blade curves towards. Near the hub (radius under 0.2) the blades widen until they meet their
// neighbours (+-60 degrees), so the three form one piece round the hub; beyond, the blade curves gently towards B
// and ends in a slanted, rounded square tip. (Seen from below, B is clockwise of A.)
const OUTLINE = [
  // (the joins round the hub, radius 0.14-0.32, smoothed: the photo's hub ring breaks the trace there. From 0.3 to 0.95
  // a smooth curve through the trace, within 1.4 degrees of it: a glare on one blade's root in photo 02 read as
  // background and made a false narrowing there, which photo 01 doesn't show.)
  [0.12, -60, 60], [0.14, -60, 58], [0.16, -60, 53], [0.18, -59, 49], [0.19, -50, 47.2], [0.2, -42, 45.5],
  [0.21, -37, 43.3], [0.22, -33.5, 41], [0.24, -29.5, 36], [0.26, -27, 31.5], [0.28, -25, 28.3], [0.3, -23, 26.2],
  [0.32, -19.76, 25.06], [0.34, -17.97, 24.36], [0.36, -16.42, 23.71], [0.38, -15.08, 23.1], [0.4, -13.92, 22.53], [0.42, -12.92, 21.99],
  [0.44, -12.05, 21.48], [0.46, -11.29, 20.99], [0.48, -10.61, 20.54], [0.5, -9.99, 20.1], [0.52, -9.43, 19.67], [0.54, -8.9, 19.27],
  [0.56, -8.39, 18.87], [0.58, -7.88, 18.48], [0.6, -7.38, 18.11], [0.62, -6.87, 17.73], [0.64, -6.34, 17.37], [0.66, -5.8, 17],
  [0.68, -5.24, 16.64], [0.7, -4.66, 16.28], [0.72, -4.06, 15.91], [0.74, -3.46, 15.55], [0.76, -2.84, 15.19], [0.78, -2.24, 14.82],
  [0.8, -1.65, 14.46], [0.82, -1.08, 14.09], [0.84, -0.56, 13.73], [0.86, -0.09, 13.37], [0.88, 0.3, 13.01], [0.9, 0.59, 12.65],
  [0.92, 0.8, 12.3], [0.94, 1.1, 11.95], [0.95, 1.4, 11.8], [0.96, 1.7, 11.4], [0.97, 2, 11], [0.975, 2.1, 10.5],
  [0.98, 2.1, 9.8], [0.985, 2.4, 8.9], [0.99, 2.8, 8.2], [0.995, 3.5, 7.2], [1, 4.8, 5.9],
];
const outlineAt = (f) => {
  let i = 1;
  while (i < OUTLINE.length - 1 && OUTLINE[i][0] < f) i++;
  const [f0, l0, t0] = OUTLINE[i - 1];
  const [f1, l1, t1] = OUTLINE[i];
  const k = Math.min(1, Math.max(0, (f - f0) / (f1 - f0)));
  return [l0 + (l1 - l0) * k, t0 + (t1 - t0) * k];
};

// Its shape across and along, fitted to photos 01 and 02 together (their outlines, matched with the camera of
// each photo): thickness at the root and the tip; blade angle at the root and the tip (radians, edge B raised;
// the root is flat where the blades join); how far the blade rises towards its tip (the photos show the tips a
// little higher than the root); its arch across the chord; the root's height on the motor (the hub's rings stand
// below it, as pictured); and how far in from edges A and B their rounding reaches.
export const BLADE = { thickRoot: 0.03, thickTip: 0.011, pitchRoot: 0.135, pitchTip: 0.148, rise: 0.098, camber: 0.008, y: -0.042, edgeA: 0.07, edgeB: 0.035 };

export function bladeGeometry(spec = {}) {
  const p = { ...BLADE, ...spec };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const edge = (s, w) => { const x = Math.min(1, Math.max(0, s / w)); return Math.sqrt(1 - (1 - x) ** 2); }; // a rounded edge
  const stations = [];
  for (let f = 0.12; f < 0.949; f += 0.01) stations.push(f);
  for (let f = 0.95; f < 0.999; f += 0.0025) stations.push(f);
  stations.push(1);
  const n = 32; // points across the chord, closer together at the edges
  const pos = [];
  const uv = [];
  const index = [];
  const tops = [];
  const bottoms = [];
  for (const f of stations) {
    const [L, T] = outlineAt(f).map((a) => (a * Math.PI) / 180);
    const chord = f * (T - L);
    const aJoined = L <= (-59.9 * Math.PI) / 180; // joined to the next blade here: no edge
    const bJoined = T >= (59.9 * Math.PI) / 180;
    const k = smooth(0.2, 1, f);
    const thick = p.thickRoot + (p.thickTip - p.thickRoot) * k;
    const flat = smooth(0.14, 0.42, f);
    const pitch = (p.pitchRoot + (p.pitchTip - p.pitchRoot) * k) * flat;
    const y0 = p.y + p.rise * Math.max(0, f - 0.2);
    const top = [];
    const bottom = [];
    for (let j = 0; j <= n; j++) {
      const u = (1 - Math.cos((Math.PI * j) / n)) / 2;
      const a = L + (T - L) * u;
      const s = chord * u; // distance from edge A
      const half = (thick / 2) * (aJoined ? 1 : edge(s, p.edgeA)) * (bJoined ? 1 : edge(chord - s, p.edgeB));
      const mid = y0 + Math.sin(pitch) * (s - chord * 0.4) + p.camber * flat * 4 * u * (1 - u) * (chord / 0.25);
      const x = f * Math.cos(a);
      const z = -f * Math.sin(a);
      top.push(pos.length / 3);
      pos.push(x, mid + half, z);
      uv.push((f - 0.12) / 0.88, u);
      bottom.push(pos.length / 3);
      pos.push(x, mid - half, z);
      uv.push((f - 0.12) / 0.88, u);
    }
    tops.push(top);
    bottoms.push(bottom);
  }
  const quad = (a, b, c, d) => index.push(a, b, d, b, c, d);
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      quad(tops[i][j], tops[i + 1][j], tops[i + 1][j + 1], tops[i][j + 1]);
      quad(bottoms[i][j + 1], bottoms[i + 1][j + 1], bottoms[i + 1][j], bottoms[i][j]);
    }
    // the sides (zero height along a real edge; a wall where the blade joins its neighbour)
    quad(bottoms[i][0], bottoms[i + 1][0], tops[i + 1][0], tops[i][0]);
    quad(tops[i][n], tops[i + 1][n], bottoms[i + 1][n], bottoms[i][n]);
  }
  // close the tip and the root end
  const last = stations.length - 1;
  for (let j = 0; j < n; j++) {
    quad(tops[last][j], tops[last][j + 1], bottoms[last][j + 1], bottoms[last][j]);
    quad(bottoms[0][j], bottoms[0][j + 1], tops[0][j + 1], tops[0][j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// Maps the wood straight across a shape from above (x, z), so its grain runs in lines, not rings, at the same size
// as on the blades (the texture spans a blade's length, 0.88, and about its width, 0.25).
function flatGrain(geo) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.88 + 0.5, pos.getZ(i) / 0.25 + 0.5);
  uv.needsUpdate = true;
}

// The Wood Craft finish: the real wood of studio photo 01, cut from its left blade with the photo's broad lighting
// evened out (by the local script .cache/aeroflow-match/wood.cjs). Grain along the texture's x, the blade's length. Until the picture
// has loaded the wood shows its average colour (never black); ready resolves once it has (or failed to).
function photoWood() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#aa7c65';
  ctx.fillRect(0, 0, 2, 2);
  const tex = new THREE.Texture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.MirroredRepeatWrapping; // the hub is wider than a blade: the grain mirrors beyond it
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  const ready = new Promise((resolve) => {
    // a new size needs new storage on the graphics card: dispose() drops the placeholder's, the next draw makes it again
    new THREE.ImageLoader().load(woodUrl, (image) => { tex.image = image; tex.dispose(); tex.needsUpdate = true; resolve(); }, undefined, () => resolve());
  });
  return { tex, ready };
}

// ---------------------------------------------------------------- the fan

export function createAeroflow({ shadows = false, blade = {} } = {}) {
  const { tex: wood, ready } = photoWood();
  // Double-sided so the open lathe shapes (canopy, shell, cap) look solid from every camera angle.
  const material = () => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const materials = { blade: material(), body: material(), mount: material(), cap: material(), trim: material(), accent: material() };

  const fan = new THREE.Group();
  fan.name = 'aeroflow';

  // Canopy (studio photo 01, its size fitted to the photo's outline): a smooth flared funnel, wide and flat at the
  // top, narrowing into a stout downrod.
  const canopy = new THREE.Mesh(
    lathe([[0, CANOPY_TOP], [0.1085, CANOPY_TOP], [0.1122, CANOPY_TOP - 0.0107], [0.1037, CANOPY_TOP - 0.0399], [0.0856, CANOPY_TOP - 0.0798], [0.0675, CANOPY_TOP - 0.1264], [0.0555, CANOPY_TOP - 0.1663], [0.0482, CANOPY_TOP - 0.1996]]),
    materials.mount,
  );
  // Downrod: stout. At its foot the bottom canopy, a separate trumpet-shaped cover over the rod-to-motor joint,
  // flares down to just above the motor (Aparna's manual: 3-4 mm), held by a screw on its neck.
  const downrod = new THREE.Mesh(lathe([[0.039, CANOPY_TOP - 0.1996], [0.037, 0.22]], 24), materials.mount);
  const bottomCanopy = new THREE.Mesh(
    lathe([[0.037, 0.248], [0.041, 0.245], [0.041, 0.193], [0.049, 0.143], [0.068, 0.106], [0.1, 0.078], [0.13, 0.062 + CANOPY_GAP * 0.5], [0.148, 0.051 + CANOPY_GAP]], 48),
    materials.mount,
  );
  const canopyScrews = [neckScrew(materials.mount, { r: 0.041, y: 0.226, angle: 1.4 }), neckScrew(materials.mount, { r: 0.0603, y: CANOPY_TOP - 0.1664, angle: 1.4 })];
  // the logo printed on the front of the canopy: red on white and golden, white on grey and Wood Craft (studio photo 01)
  const logos = {
    red: brandMarkCurved({ colour: 'red', width: 0.072, radius: 0.109, y: CANOPY_TOP - 0.035 }),
    white: brandMarkCurved({ colour: 'white', width: 0.072, radius: 0.109, y: CANOPY_TOP - 0.035 }),
  };
  const stator = new THREE.Group(); // parts that stay still
  stator.add(canopy, downrod, bottomCanopy, ...canopyScrews, logos.red, logos.white);

  // Rotor: the motor shell, the trim ring, the copper accent, the centre cap and the three blades.
  const rotor = new THREE.Group();
  rotor.name = 'rotor';

  const shell = new THREE.Mesh(
    // narrower than the blades' joined root (photos 01 and 02: it never shows between the blades from below)
    lathe([[0, 0.058], [0.09, 0.055], [0.15, 0.045], [0.175, 0.025], [0.183, -0.005], [0.185, -0.042], [0.186, -0.056], [0.184, -0.066], [0.178, -0.0718], [0.165, -0.0735]]),
    materials.body,
  );
  // Seen from below (studio photo 01, close up): a raised flat ring in the body colour standing below the blades'
  // joined root, edged by a fine dark groove; inside it a step with a thin bright edge, then the bright ring
  // (chrome, or copper on golden and wood) and the flat cap set just inside it.
  const trim = new THREE.Mesh(
    lathe([[0.178, -0.0733], [0.152, -0.0742], [0.148, -0.0742]]),
    materials.trim,
  );
  const accent = new THREE.Mesh(new THREE.TorusGeometry(0.139, 0.0068, 16, 96), materials.accent);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = -0.074;
  const cap = new THREE.Mesh(
    lathe([[0.133, -0.0715], [0.12, -0.072], [0, -0.0722]]),
    materials.cap,
  );
  // the thin bright edge of the step inside the flat ring
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.0022, 10, 96), materials.accent);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.0742;
  // the fine dark groove round the flat ring's outer edge
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.174, 0.0016, 6, 128), new THREE.MeshBasicMaterial({ color: '#2a1d15', transparent: true, opacity: 0.6 }));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = -0.0737;
  // straight wood grain across the hub's underside (a lathe's own mapping would draw tree rings)
  for (const m of [shell, trim, cap]) flatGrain(m.geometry);
  rotor.add(shell, trim, accent, lip, cap, seam);

  // the motor's insides (home page "01" and "05" steps): hidden in the closed housing until the split opens it
  const internals = createMotorInternals();
  stator.add(internals.group);
  const bottomCover = [trim, accent, lip, cap, seam];
  const coverY = bottomCover.map((m) => m.position.y);
  // t: 0 closed .. 1 open; spread: how far apart (1 on desktop, tighter on phones); layout: 0 ("01") .. 1 ("05")
  function setExplode(t, spread = 1, layout = 0) {
    internals.setSplit(t, spread, layout);
    const dy = internals.coverY(t, spread, layout);
    bottomCover.forEach((m, i) => { m.position.y = coverY[i] + dy; });
  }
  // the part the story names glows: { motor, board, bearing, housing } 0..1; dim 0..1 darkens the other insides.
  // "housing" is the bottom cover that seals the motor (Anti-dust): an emissive glow, which setFinish never resets.
  const coverGlow = new THREE.Color('#ffb85c');
  function setFocus(focus = {}, dim = 0) {
    internals.setFocus(focus, dim);
    const f = focus.housing ?? 0;
    for (const m of [materials.trim, materials.accent, materials.cap]) m.emissive.copy(coverGlow).multiplyScalar(0.14 * f);
  }

  const bladeGeo = bladeGeometry(blade);
  const blades = [];
  for (let i = 0; i < BLADE_COUNT; i++) {
    const pivot = new THREE.Group(); // the pivot lets the intro animation fold and unfold each blade
    const blade = new THREE.Mesh(bladeGeo, materials.blade);
    pivot.add(blade);
    pivot.userData.restAngle = (i * Math.PI * 2) / BLADE_COUNT;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }

  // A soft disc in the blade plane. It fades in only at high speed so three real blades stay readable.
  const blurDisc = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 1.02, 96),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = -0.01;

  // Invisible disc used to check whether the pointer is over the fan.
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ visible: false }));
  hitArea.rotation.x = -Math.PI / 2;

  fan.add(stator, rotor, blurDisc, hitArea);

  // Soft shadows (high quality only): the blades shade the motor shell and the ceiling.
  for (const mesh of [canopy, downrod, shell, trim, accent, cap, ...blades.map((p) => p.children[0])]) {
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
  }

  function setFinish(name) {
    const finish = FINISHES[name] ?? FINISHES.wood;
    const whiteLogo = finish === FINISHES.grey || finish === FINISHES.wood;
    logos.white.visible = whiteLogo;
    logos.red.visible = !whiteLogo;
    for (const [part, spec] of Object.entries(finish)) {
      const m = materials[part];
      const { wood: useWood, color = '#ffffff', ...rest } = spec;
      m.map = useWood ? wood : null;
      m.color.set(useWood ? '#ffffff' : color);
      m.metalness = 0;
      m.roughness = 0.4;
      m.clearcoat = 0;
      m.clearcoatRoughness = 0.2;
      Object.assign(m, rest);
      // Metal parts (chrome and copper rings, metallic finishes) pick up stronger room reflections.
      m.envMapIntensity = 1 + m.metalness * 1.2;
      m.needsUpdate = true;
    }
  }

  setFinish('wood');
  return { fan, rotor, stator, blades, blurDisc, hitArea, setFinish, setExplode, setFocus, explodeAnchors: internals.anchors, ready };
}

export function makeBlurTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,250,242,0.55)');
  g.addColorStop(0.85, 'rgba(255,250,242,0.35)');
  g.addColorStop(1, 'rgba(255,250,242,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
