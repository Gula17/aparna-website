// The Aparna AEROSLEEK and IKON BLDC ceiling fans (1200 mm, three blades), built procedurally in three.js
// in the same way as the Aeroflow (aeroflow-model.js), and with the same parts so the scene can drive them.
//
// References (what each part is modelled on):
//   AEROSLEEK  poster "03 AEROSLEEK" (matte black), event standee photo AVNI4456: rounded bowl canopy, slim
//              downrod, compact cylindrical motor, glossy black base cap with blue LEDs (six round one in the
//              centre), long flat square-tipped blades on a narrow bracket with two screws.
//              Studio photos 03/04/05 show it in white, black and brown.
//   IKON BLDC  posters "01/02 IKON BLDC" (charcoal grey), studio photos 06 (white) and 21 (smoke brown): cup
//              canopy, wider and flatter motor with a copper
//              pin-stripe on the body and round the stepped base cap, wide blades with a raised strip along the
//              front edge, cut-off tip corners, and a bracket with four screws.
// Sides the photos don't show (the top of the motor, the back of the blades) follow the visible design.
//
// Units match the Aeroflow: blade tip at radius 1, blades at y = 0, canopy top at CANOPY_TOP.

import * as THREE from 'three';
import { lathe, makeBlurTexture, BLADE_COUNT } from './aeroflow-model.js';
import { brandMarkCurved } from './brand-mark.js';
import { bottomCanopy, neckScrew } from './fan-mount.js';

// The logo printed on the canopy: red on the white finish, white on the dark ones. Both are built; the finish
// shows one.
function canopyLogos(stator, { width, radius, y }) {
  const red = brandMarkCurved({ colour: 'red', width, radius, y });
  const white = brandMarkCurved({ colour: 'white', width, radius, y });
  stator.add(red, white);
  return (finishName) => { red.visible = finishName === 'white'; white.visible = finishName !== 'white'; };
}

// Both posters show a short drop: the canopy sits much closer to the motor than on the Aeroflow.
const CANOPY_TOP = 0.5;

const physical = (spec) => {
  const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.45, ...spec });
  m.envMapIntensity = 1 + (m.metalness ?? 0) * 1.2;
  return m;
};

// A flat plate from an outline in (x = out along the radius, y = across the chord), lying in the blade plane.
function plate(outline, { thickness = 0.012, pitch = -0.1, y = 0 } = {}) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2); // lie flat; the chord runs along z
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(pitch)); // the leading edge lifts, so air goes down
  geo.translate(0, y, 0);
  geo.computeVertexNormals();
  return geo;
}

// Screw heads on a blade or bracket: small domes, placed in the blade's own (radius, chord) coordinates.
function screws(points, material, { y = 0.012, pitch = -0.1 } = {}) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.0085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [x, z] of points) {
    const s = new THREE.Mesh(geo, material);
    s.position.set(x, y + Math.sin(pitch) * z, -z * Math.cos(pitch)); // same tilt as plate()
    group.add(s);
  }
  return group;
}

// Shared assembly: still canopy + downrod, turning motor + blades, the blur disc and the pointer hit area.
function assemble(name, { stator, rotorParts, makeBlade, materials, finishes, shadows, showLogo = () => {} }) {
  const fan = new THREE.Group();
  fan.name = name;
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.add(...rotorParts);
  const blades = [];
  for (let i = 0; i < BLADE_COUNT; i++) {
    const pivot = new THREE.Group();
    pivot.add(makeBlade());
    pivot.userData.restAngle = (i * Math.PI * 2) / BLADE_COUNT;
    pivot.rotation.y = pivot.userData.restAngle;
    rotor.add(pivot);
    blades.push(pivot);
  }
  const blurDisc = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 1.02, 96),
    new THREE.MeshBasicMaterial({ map: makeBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = -0.01;
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ visible: false }));
  hitArea.rotation.x = -Math.PI / 2;
  fan.add(stator, rotor, blurDisc, hitArea);
  fan.traverse((o) => { if (o.isMesh && o !== blurDisc && o !== hitArea) { o.castShadow = shadows; o.receiveShadow = shadows; } });

  function setFinish(finishName) {
    const finish = finishes[finishName] ?? Object.values(finishes)[0];
    showLogo(finishes[finishName] ? finishName : Object.keys(finishes)[0]);
    for (const [part, spec] of Object.entries(finish)) {
      const m = materials[part];
      if (!m) continue;
      const { color, ...rest } = spec;
      Object.assign(m, { metalness: 0, roughness: 0.45, clearcoat: 0, clearcoatRoughness: 0.2 }, rest);
      m.color.set(color);
      m.envMapIntensity = 1 + m.metalness * 1.2;
      m.needsUpdate = true;
    }
  }
  setFinish(Object.keys(finishes)[0]);
  return { fan, rotor, stator, blades, blurDisc, hitArea, setFinish };
}

// ---------------------------------------------------------------- AEROSLEEK

const AEROSLEEK_FINISHES = {
  // the three studio photos (03 white, 04 black, 05 brown): a glossy black LED cap on all three
  white: {
    body: { color: '#f1f1ef', roughness: 0.32, clearcoat: 0.8 },
    blade: { color: '#f3f3f1', roughness: 0.35, clearcoat: 0.8 },
    bracket: { color: '#e6e6e4', roughness: 0.35 },
    cap: { color: '#0a0b0c', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
    ring: { color: '#eceef0', metalness: 1, roughness: 0.18 },
  },
  black: {
    body: { color: '#38393c', metalness: 0.5, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.15 },
    blade: { color: '#3a3b3e', metalness: 0.35, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 },
    bracket: { color: '#2a2b2d', metalness: 0.55, roughness: 0.35 },
    cap: { color: '#0a0b0c', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
    ring: { color: '#8a8c90', metalness: 1, roughness: 0.25 },
  },
  brown: {
    // studio photo 05: a metallic bronze-brown, lighter and greyer than a plain brown
    body: { color: '#6a5546', metalness: 0.6, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 },
    blade: { color: '#6c5647', metalness: 0.55, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2 },
    bracket: { color: '#55443a', metalness: 0.6, roughness: 0.32 },
    cap: { color: '#0a0b0c', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
    ring: { color: '#9a9ca0', metalness: 1, roughness: 0.25 },
  },
};

export function createAerosleek({ shadows = false } = {}) {
  const materials = {
    body: physical({}), blade: physical({}), bracket: physical({}), cap: physical({}), ring: physical({}),
    // vivid blue, with a soft halo round each light (studio photo 03)
    led: new THREE.MeshBasicMaterial({ color: '#3fb4ff' }),
    halo: new THREE.MeshBasicMaterial({ color: '#2a8cff', transparent: true, opacity: 0.35, depthWrite: false }),
    hole: new THREE.MeshBasicMaterial({ color: '#4a4a4c', side: THREE.DoubleSide }),
  };

  // Still: a straight cup canopy, a slim downrod, and the LED base cap under the motor (it sits on the fixed
  // shaft on a BLDC fan, so the lights don't spin).
  // studio photos: a rounded bowl, wide at the top and curving in to a small base, a little collar on the rod
  // below it, a slim rod, and the motor rising in a curved shoulder to a raised neck round the rod
  const canopy = new THREE.Mesh(lathe([[0, CANOPY_TOP], [0.078, CANOPY_TOP], [0.08, CANOPY_TOP - 0.006], [0.079, CANOPY_TOP - 0.03], [0.075, CANOPY_TOP - 0.05], [0.064, CANOPY_TOP - 0.068], [0.044, CANOPY_TOP - 0.08], [0.024, CANOPY_TOP - 0.085], [0.014, CANOPY_TOP - 0.086]]), materials.body);
  const collar = new THREE.Mesh(lathe([[0.012, CANOPY_TOP - 0.084], [0.019, CANOPY_TOP - 0.09], [0.02, CANOPY_TOP - 0.1], [0.015, CANOPY_TOP - 0.11], [0.011, CANOPY_TOP - 0.112]], 24), materials.body);
  const downrod = new THREE.Mesh(lathe([[0.011, CANOPY_TOP - 0.11], [0.011, 0.165]], 24), materials.body);
  // the bottom canopy: a separate cup over the rod-to-motor joint, a few mm above the motor (Aparna's manual)
  const lowCanopy = bottomCanopy(materials.body, materials.body, { rodR: 0.011, top: 0.175, baseR: 0.068, baseY: 0.099, shape: 'cup', angle: 1.2 });
  const topScrew = neckScrew(materials.body, { r: 0.02, y: CANOPY_TOP - 0.098, angle: 1.2 });
  // The glossy black cap is as wide as the motor, with black sides below the chrome band.
  const cap = new THREE.Mesh(lathe([[0.125, -0.064], [0.125, -0.08], [0.12, -0.089], [0.1, -0.095], [0.05, -0.098], [0, -0.0985]]), materials.cap);
  const leds = new THREE.Group();
  const ledGeo = new THREE.SphereGeometry(0.0095, 14, 10);
  const haloGeo = new THREE.CircleGeometry(0.019, 24);
  // six lights in a ring, none in the centre
  Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3 + Math.PI / 6) * 0.052, Math.sin((i * Math.PI) / 3 + Math.PI / 6) * 0.052]).forEach(([x, z]) => {
    const led = new THREE.Mesh(ledGeo, materials.led);
    led.position.set(x, -0.0975, z);
    led.scale.y = 0.4;
    const halo = new THREE.Mesh(haloGeo, materials.halo);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(x, -0.0995, z);
    leds.add(led, halo);
  });
  const stator = new THREE.Group();
  stator.add(canopy, collar, downrod, lowCanopy, topScrew, cap, leds);
  const showLogo = canopyLogos(stator, { width: 0.07, radius: 0.0805, y: CANOPY_TOP - 0.028 });

  // Turning: a compact cylindrical motor, with a wide polished chrome band round its lower edge.
  // the motor's top cover: a low closed dome under the bottom canopy
  const shell = new THREE.Mesh(lathe([[0, 0.101], [0.06, 0.1], [0.1, 0.09], [0.118, 0.072], [0.124, 0.04], [0.124, -0.044]]), materials.body);
  const ring = new THREE.Mesh(lathe([[0.1245, -0.044], [0.126, -0.047], [0.126, -0.061], [0.1255, -0.064]]), materials.ring);

  // Blade (studio photos 03-05): a long flat plank that starts right at the motor (its short bracket sits on top,
  // hidden), widening a little towards a gently rounded tip, with a narrow lip folded up along its front edge,
  // and three screws in a triangle near the root.
  const pitch = -0.09;
  const lip = 0.42; // the narrow lip along the front edge is folded up this far (radians); the rest is flat
  const lead = () => -0.022;                // the lip's width
  const trail = (t) => 0.098 + 0.03 * t;    // the flat face, widening towards the tip
  const x0 = 0.132, x1 = 0.972;
  const at = (x) => (x - x0) / (x1 - x0);
  // one face of the blade: from the fold line (chord 0) out to one edge, with its half of the rounded tip
  const face = (edge) => {
    const pts = [[x0, 0]];
    for (let i = 0; i <= 8; i++) { const x = x0 + ((x1 - x0) * i) / 8; pts.push([x, edge(at(x))]); }
    const e = edge(1);
    for (let i = 1; i <= 6; i++) { const k = i / 6; pts.push([x1 + 0.028 * Math.sin((1 - k) * Math.PI / 2) ** 0.4, e * (1 - k)]); }
    return pts;
  };
  const frontGeo = plate(face(lead), { pitch: pitch - lip, y: -0.004, thickness: 0.01 });
  const backGeo = plate(face(trail), { pitch, y: -0.004 });
  const bracketGeo = plate([[0.1, -0.024], [0.22, -0.028], [0.22, 0.028], [0.1, 0.024]], { thickness: 0.012, pitch, y: 0.01 });
  const holeGeo = new THREE.CircleGeometry(0.0072, 16);
  const makeBlade = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(frontGeo, materials.blade), new THREE.Mesh(backGeo, materials.blade), new THREE.Mesh(bracketGeo, materials.bracket));
    // the three screws, on both faces, each set into the face it sits on
    for (const [x, c] of [[0.19, 0.02], [0.19, 0.07], [0.235, 0.045]]) {
      const tilt = pitch;
      for (const [off, turn] of [[0.0066, -Math.PI / 2], [-0.0066, Math.PI / 2]]) {
        const hole = new THREE.Mesh(holeGeo, materials.hole);
        hole.rotation.x = turn + tilt;
        hole.position.set(x, -0.004 + off * Math.cos(tilt) + Math.sin(tilt) * c, -c * Math.cos(tilt) + off * Math.sin(tilt));
        g.add(hole);
      }
    }
    return g;
  };
  return assemble('aerosleek', { stator, rotorParts: [shell, ring], makeBlade, materials, finishes: AEROSLEEK_FINISHES, shadows, showLogo });
}

// ---------------------------------------------------------------- IKON BLDC

const IKON_FINISHES = {
  // studio photos 06 (white, a champagne pin-line) and 21 (smoke brown, a copper pin-line)
  white: {
    body: { color: '#f1f1ef', roughness: 0.3, clearcoat: 0.8 },
    blade: { color: '#f3f3f1', roughness: 0.32, clearcoat: 0.8 },
    ridge: { color: '#f6f6f4', roughness: 0.3, clearcoat: 0.8 },
    bracket: { color: '#d9dadc', metalness: 0.6, roughness: 0.3 },
    copper: { color: '#cdb487', metalness: 1, roughness: 0.25 },
    hole: { color: '#a9aaac', roughness: 0.6 },
  },
  'smoke-brown': {
    body: { color: '#555355', metalness: 0.45, roughness: 0.4, clearcoat: 0.35 },
    blade: { color: '#5a5859', metalness: 0.4, roughness: 0.44, clearcoat: 0.3 },
    ridge: { color: '#626062', metalness: 0.4, roughness: 0.4, clearcoat: 0.3 },
    bracket: { color: '#48474a', metalness: 0.55, roughness: 0.4 },
    copper: { color: '#b8653f', metalness: 1, roughness: 0.28 },
    hole: { color: '#2a2a2b', roughness: 0.8 },
  },
  charcoal: {
    body: { color: '#4b4b4e', metalness: 0.5, roughness: 0.42, clearcoat: 0.3 },
    blade: { color: '#505053', metalness: 0.45, roughness: 0.46, clearcoat: 0.25 },
    ridge: { color: '#5a5a5d', metalness: 0.45, roughness: 0.4, clearcoat: 0.3 },
    bracket: { color: '#3e3e41', metalness: 0.55, roughness: 0.4 },
    copper: { color: '#b8653f', metalness: 1, roughness: 0.28 },
    hole: { color: '#151516', roughness: 0.8 },
  },
};

export function createIkonBldc({ shadows = false } = {}) {
  const materials = {
    body: physical({}), blade: physical({}), ridge: physical({}), bracket: physical({}), copper: physical({}), hole: physical({}),
  };

  // Still: a cup canopy (as in the studio photos) and the downrod.
  const canopy = new THREE.Mesh(lathe([[0, CANOPY_TOP], [0.084, CANOPY_TOP], [0.088, CANOPY_TOP - 0.014], [0.082, CANOPY_TOP - 0.06], [0.058, CANOPY_TOP - 0.1], [0.032, CANOPY_TOP - 0.125], [0.026, CANOPY_TOP - 0.17]]), materials.body);
  const downrod = new THREE.Mesh(lathe([[0.022, CANOPY_TOP - 0.17], [0.021, 0.12]], 32), materials.body);
  const stator = new THREE.Group();
  // the bottom canopy: a separate bell over the rod-to-motor joint, a few mm above the motor (Aparna's manual)
  stator.add(canopy, downrod, bottomCanopy(materials.body, materials.body, { rodR: 0.021, top: 0.13, baseR: 0.062, baseY: 0.082, angle: 1.2 }), neckScrew(materials.body, { r: 0.03, y: CANOPY_TOP - 0.15, angle: 1.2 }));
  const showLogo = canopyLogos(stator, { width: 0.072, radius: 0.0875, y: CANOPY_TOP - 0.036 });

  // Turning (studio photos 06, 21): a wide, low motor whose domed top rises to a neck round the rod, a copper
  // pin-stripe on the body, and underneath one large shallow dish with a copper line round its rim.
  const upper = new THREE.Mesh(lathe([[0, 0.084], [0.04, 0.083], [0.08, 0.075], [0.125, 0.058], [0.158, 0.038], [0.172, 0.012], [0.174, -0.004]]), materials.body);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.0035, 10, 96), materials.copper);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.03;
  const band = new THREE.Mesh(lathe([[0.174, -0.004], [0.176, -0.028], [0.173, -0.04], [0.166, -0.046]]), materials.body);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.004, 10, 96), materials.copper);
  capRing.rotation.x = Math.PI / 2;
  capRing.position.y = -0.0465;
  const cap = new THREE.Mesh(lathe([[0.161, -0.047], [0.152, -0.05], [0.11, -0.0535], [0, -0.0545]]), materials.body);

  // Blade: starts right at the motor, widening towards the tip, with a shallow fold running its length near the
  // front edge (two faces catching the light differently), the front tip corner cut off, a rounded root and four
  // screws there on a short bracket.
  const pitch = -0.1;
  const fold = 0.06;
  const x0 = 0.19, x1 = 1.0;
  const lead = (t) => -(0.045 + 0.02 * t); // the narrow face, in front of the fold
  const trail = (t) => 0.075 + 0.03 * t;   // the wide face, behind it
  const at = (x) => (x - x0) / (x1 - x0);
  const span = (edge) => Array.from({ length: 9 }, (_, i) => { const x = x0 + 0.014 + ((x1 - x0 - 0.05) * i) / 8; return [x, edge(at(x))]; });
  const front = [[x0, 0], [x0, lead(0) + 0.012], [x0 + 0.014, lead(0)], ...span(lead), [x1 - 0.04, lead(1)], [x1, lead(1) + 0.035], [x1, 0]];
  const back = [[x0, 0], [x0, trail(0) - 0.012], [x0 + 0.014, trail(0)], ...span(trail), [x1 - 0.012, trail(1)], [x1, trail(1) - 0.012], [x1, 0]];
  const frontGeo = plate(front, { pitch: pitch - fold, y: -0.006 });
  const backGeo = plate(back, { pitch: pitch + fold, y: -0.006 });
  const bracketGeo = plate([[0.12, -0.03], [0.27, -0.034], [0.27, 0.034], [0.12, 0.03]], { thickness: 0.014, pitch, y: 0.01 });
  const holeGeo = new THREE.CircleGeometry(0.0075, 16);
  const makeBlade = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(frontGeo, materials.blade), new THREE.Mesh(backGeo, materials.blade), new THREE.Mesh(bracketGeo, materials.bracket));
    for (const [x, c] of [[0.22, -0.024], [0.22, 0.03], [0.26, -0.024], [0.26, 0.03]]) {
      const tilt = pitch + (c < 0 ? -fold : fold);
      for (const [off, turn] of [[0.0066, -Math.PI / 2], [-0.0066, Math.PI / 2]]) {
        const hole = new THREE.Mesh(holeGeo, materials.hole);
        hole.rotation.x = turn + tilt;
        hole.position.set(x, -0.006 + off * Math.cos(tilt) + Math.sin(tilt) * c, -c * Math.cos(tilt) + off * Math.sin(tilt));
        g.add(hole);
      }
    }
    return g;
  };
  return assemble('ikon-bldc', { stator, rotorParts: [upper, stripe, band, capRing, cap], makeBlade, materials, finishes: IKON_FINISHES, shadows, showLogo });
}
