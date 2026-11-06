// The Aparna AEROSLEEK and IKON BLDC ceiling fans (1200 mm, three blades), built procedurally in three.js
// in the same way as the Aeroflow (aeroflow-model.js), and with the same parts so the scene can drive them.
//
// References (what each part is modelled on):
//   AEROSLEEK  poster "03 AEROSLEEK" (matte black), event standee photo AVNI4456: rounded bowl canopy, slim
//              downrod, compact cylindrical motor, glossy black base cap with blue LEDs (six round one in the
//              centre), long flat square-tipped blades on a narrow bracket with two screws.
//   IKON BLDC  posters "01/02 IKON BLDC" (charcoal grey): cone canopy, wider and flatter motor with a copper
//              pin-stripe on the body and round the stepped base cap, wide blades with a raised strip along the
//              front edge, cut-off tip corners, and a bracket with four screws.
// Sides the photos don't show (the top of the motor, the back of the blades) follow the visible design.
//
// Units match the Aeroflow: blade tip at radius 1, blades at y = 0, canopy top at CANOPY_TOP.

import * as THREE from 'three';
import { lathe, makeBlurTexture, BLADE_COUNT } from './aeroflow-model.js';

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
function assemble(name, { stator, rotorParts, makeBlade, materials, finishes, shadows }) {
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
  // the poster's finish; the standee also shows a white one (white body, chrome ring)
  black: {
    body: { color: '#2b2c2f', metalness: 0.45, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.15 },
    blade: { color: '#2b2c2f', metalness: 0.15, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.4 }, // matte, as on the poster
    bracket: { color: '#1f2022', metalness: 0.55, roughness: 0.35 },
    cap: { color: '#0a0b0c', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
    ring: { color: '#2a2b2d', metalness: 0.8, roughness: 0.3 },
  },
  white: {
    body: { color: '#f1f1ef', roughness: 0.32, clearcoat: 0.8 },
    blade: { color: '#f3f3f1', roughness: 0.35, clearcoat: 0.8 },
    bracket: { color: '#e6e6e4', roughness: 0.35 },
    cap: { color: '#0a0b0c', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 },
    ring: { color: '#eceef0', metalness: 1, roughness: 0.18 },
  },
};

export function createAerosleek({ shadows = false } = {}) {
  const materials = {
    body: physical({}), blade: physical({}), bracket: physical({}), cap: physical({}), ring: physical({}),
    led: new THREE.MeshStandardMaterial({ color: '#7fd0ff', emissive: '#1f9bff', emissiveIntensity: 2.4, roughness: 0.3 }),
  };

  // Still: a rounded bowl canopy, a slim downrod, and the LED base cap under the motor (it sits on the fixed
  // shaft on a BLDC fan, so the lights don't spin).
  const canopy = new THREE.Mesh(lathe([[0, CANOPY_TOP], [0.1, CANOPY_TOP], [0.112, CANOPY_TOP - 0.03], [0.108, CANOPY_TOP - 0.08], [0.085, CANOPY_TOP - 0.13], [0.045, CANOPY_TOP - 0.16], [0.024, CANOPY_TOP - 0.17]]), materials.body);
  const downrod = new THREE.Mesh(lathe([[0.019, CANOPY_TOP - 0.17], [0.018, 0.17], [0.02, 0.12], [0.035, 0.095]], 32), materials.body);
  const cap = new THREE.Mesh(lathe([[0.118, -0.068], [0.116, -0.078], [0.1, -0.088], [0.05, -0.093], [0, -0.094]]), materials.cap);
  const leds = new THREE.Group();
  const ledGeo = new THREE.SphereGeometry(0.0105, 14, 10);
  [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * 0.06, Math.sin((i * Math.PI) / 3) * 0.06])].forEach(([x, z]) => {
    const led = new THREE.Mesh(ledGeo, materials.led);
    led.position.set(x, -0.092 + (x || z ? 0.003 : 0), z);
    led.scale.y = 0.45;
    leds.add(led);
  });
  const stator = new THREE.Group();
  stator.add(canopy, downrod, cap, leds);

  // Turning: a compact, tall cylindrical motor with a thin ring at the bottom edge.
  const shell = new THREE.Mesh(lathe([[0.035, 0.095], [0.09, 0.09], [0.118, 0.07], [0.124, 0.03], [0.124, -0.04], [0.12, -0.064]]), materials.body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.005, 12, 72), materials.ring);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.066;

  // Blade: a long flat plank, square tip with a slight angle, carried on a narrow bracket from the motor.
  const pitch = -0.09;
  const bladeGeo = plate([[0.24, -0.072], [0.985, -0.066], [1.0, -0.05], [1.0, 0.07], [0.24, 0.078]], { pitch, y: -0.004 });
  const bracketGeo = plate([[0.11, -0.022], [0.33, -0.026], [0.33, 0.026], [0.11, 0.022]], { thickness: 0.014, pitch, y: 0.008 });
  const makeBlade = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bladeGeo, materials.blade), new THREE.Mesh(bracketGeo, materials.bracket), screws([[0.27, -0.012], [0.3, 0.012]], materials.bracket, { y: 0.02, pitch }));
    return g;
  };
  return assemble('aerosleek', { stator, rotorParts: [shell, ring], makeBlade, materials, finishes: AEROSLEEK_FINISHES, shadows });
}

// ---------------------------------------------------------------- IKON BLDC

const IKON_FINISHES = {
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

  // Still: a cone canopy (wide at the ceiling, narrowing to the rod) and the downrod.
  const canopy = new THREE.Mesh(lathe([[0, CANOPY_TOP], [0.095, CANOPY_TOP], [0.098, CANOPY_TOP - 0.02], [0.075, CANOPY_TOP - 0.09], [0.042, CANOPY_TOP - 0.15], [0.026, CANOPY_TOP - 0.17]]), materials.body);
  const downrod = new THREE.Mesh(lathe([[0.022, CANOPY_TOP - 0.17], [0.021, 0.13], [0.026, 0.09], [0.05, 0.065]], 32), materials.body);
  const stator = new THREE.Group();
  stator.add(canopy, downrod);

  // Turning: a wide, low motor. Upper body with a copper pin-stripe, a lower band, and a stepped base cap
  // with a copper ring round it.
  const upper = new THREE.Mesh(lathe([[0.05, 0.066], [0.11, 0.058], [0.158, 0.038], [0.172, 0.012], [0.174, -0.004]]), materials.body);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.0035, 10, 96), materials.copper);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.03;
  const band = new THREE.Mesh(lathe([[0.174, -0.004], [0.176, -0.03], [0.168, -0.046], [0.15, -0.052]]), materials.body);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.146, 0.0045, 10, 96), materials.copper);
  capRing.rotation.x = Math.PI / 2;
  capRing.position.y = -0.052;
  const cap = new THREE.Mesh(lathe([[0.142, -0.052], [0.138, -0.058], [0.11, -0.061], [0.1, -0.066], [0.06, -0.069], [0, -0.07]]), materials.body);
  const capStep = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 8, 80), materials.body);
  capStep.rotation.x = Math.PI / 2;
  capStep.position.y = -0.064;

  // Blade: wide and straight, both tip corners cut off, with a raised strip along the leading edge.
  const pitch = -0.1;
  const bladeGeo = plate([[0.25, -0.085], [0.975, -0.08], [1.0, -0.055], [1.0, 0.06], [0.975, 0.085], [0.25, 0.088]], { pitch, y: -0.006 });
  const ridgeGeo = plate([[0.27, -0.085], [0.975, -0.08], [0.99, -0.064], [0.99, -0.046], [0.27, -0.05]], { thickness: 0.008, pitch: pitch - 0.05, y: 0.007 });
  const bracketGeo = plate([[0.15, -0.032], [0.36, -0.04], [0.36, 0.04], [0.15, 0.032]], { thickness: 0.014, pitch, y: 0.01 });
  const holes = screws([[0.29, -0.022], [0.29, 0.022], [0.335, -0.024], [0.335, 0.024]], materials.hole, { y: 0.02, pitch });
  const makeBlade = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bladeGeo, materials.blade), new THREE.Mesh(ridgeGeo, materials.ridge), new THREE.Mesh(bracketGeo, materials.bracket), holes.clone());
    return g;
  };
  return assemble('ikon-bldc', { stator, rotorParts: [upper, stripe, band, capRing, cap, capStep], makeBlade, materials, finishes: IKON_FINISHES, shadows });
}
