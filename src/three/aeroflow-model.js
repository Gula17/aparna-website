// The Aparna AEROFLOW BLDC ceiling fan (1200 mm, three blades), built procedurally in three.js.
// References: catalogue leaf 3, poster "04 AEROFLOW", the event standee photo.
//
// Units: the blade tip sits at radius 1. The fan hangs from y = CANOPY_TOP down to the blades at y = 0.
// The rotor (motor shell + blades) is a separate group so it can spin while the downrod and canopy stay still.

import * as THREE from 'three';
import { makeWoodTexture } from './wood-texture.js';

export const BLADE_COUNT = 3; // Brief §3.7: always exactly three blades.
export const CANOPY_TOP = 0.92;

// ---------------------------------------------------------------- finishes

const chrome = { color: '#eceef0', metalness: 1, roughness: 0.18 };
const copper = { color: '#b8653f', metalness: 1, roughness: 0.28 };

export const FINISHES = {
  white: {
    blade: { color: '#f5f4f1', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 },
    body: { color: '#f2f1ee', roughness: 0.3, clearcoat: 0.8 },
    cap: { color: '#f7f6f3', roughness: 0.25, clearcoat: 1 },
    trim: chrome,
    accent: chrome,
  },
  grey: {
    blade: { color: '#8b8e92', metalness: 0.55, roughness: 0.38, clearcoat: 0.6 },
    body: { color: '#8e9195', metalness: 0.55, roughness: 0.36, clearcoat: 0.6 },
    cap: { color: '#9a9da1', metalness: 0.6, roughness: 0.3, clearcoat: 0.6 },
    trim: chrome,
    accent: chrome,
  },
  golden: {
    blade: { color: '#dcb27a', metalness: 0.4, roughness: 0.4, clearcoat: 0.5 },
    body: { color: '#d9ae74', metalness: 0.4, roughness: 0.38, clearcoat: 0.5 },
    cap: { color: '#e0b884', metalness: 0.4, roughness: 0.34, clearcoat: 0.6 },
    trim: { color: '#d5a76a', metalness: 0.7, roughness: 0.3 },
    accent: copper,
  },
  wood: {
    blade: { wood: true, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.3 },
    body: { color: '#7a4a30', metalness: 0.3, roughness: 0.45, clearcoat: 0.4 },
    cap: { wood: true, roughness: 0.45, clearcoat: 0.5 },
    trim: { wood: true, roughness: 0.48, clearcoat: 0.45 },
    accent: copper,
  },
};

// ---------------------------------------------------------------- geometry helpers

// Turns a list of [radius, height] points into a smooth surface of revolution.
export function lathe(points, segments = 64) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return new THREE.LatheGeometry(curve.getPoints(48), segments);
}

// One swept, tapered blade. The outline is drawn flat (x = out along the radius, y = across the chord),
// then turned to lie horizontally with a small pitch.
function bladeGeometry() {
  const leading = [];
  const trailing = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const x = 0.1 + (0.88 * i) / steps;
    const sweep = 0.22 * (x - 0.1) ** 2; // the blade curves backwards towards the tip
    const root = 0.1 * Math.exp(-((x - 0.2) ** 2) * 60); // a swell where the blade leaves the motor shell
    const width = 0.19 - 0.05 * x + root;
    leading.push(new THREE.Vector2(x, sweep - width * 0.42));
    trailing.push(new THREE.Vector2(x, sweep + width * 0.58));
  }
  const shape = new THREE.Shape();
  shape.moveTo(leading[0].x, leading[0].y);
  shape.splineThru(leading.slice(1));
  // rounded tip
  const tipL = leading[steps];
  const tipT = trailing[steps];
  shape.bezierCurveTo(tipL.x + 0.045, tipL.y + 0.01, tipT.x + 0.045, tipT.y - 0.01, tipT.x, tipT.y);
  shape.splineThru(trailing.slice(0, -1).reverse());
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -0.007);
  geo.rotateX(-Math.PI / 2); // lie flat; the chord now runs along z
  // Pitch: lift the leading edge so the blade pushes air down.
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.11));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- the fan

export function createAeroflow({ shadows = false } = {}) {
  const wood = makeWoodTexture();
  // Double-sided so the open lathe shapes (canopy, shell, cap) look solid from every camera angle.
  const material = () => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const materials = { blade: material(), body: material(), cap: material(), trim: material(), accent: material() };

  const fan = new THREE.Group();
  fan.name = 'aeroflow';

  // Canopy: a bell that narrows from the ceiling down to the downrod.
  const canopy = new THREE.Mesh(
    lathe([[0, CANOPY_TOP], [0.135, CANOPY_TOP], [0.128, CANOPY_TOP - 0.06], [0.08, CANOPY_TOP - 0.16], [0.045, CANOPY_TOP - 0.25], [0.034, CANOPY_TOP - 0.3]]),
    materials.body,
  );
  // Downrod: straight, flaring into the top of the motor.
  const downrod = new THREE.Mesh(
    lathe([[0.03, CANOPY_TOP - 0.3], [0.028, 0.32], [0.032, 0.17], [0.055, 0.09], [0.09, 0.05]], 40),
    materials.body,
  );
  const stator = new THREE.Group(); // parts that stay still
  stator.add(canopy, downrod);

  // Rotor: the motor shell, the trim ring, the copper accent, the centre cap and the three blades.
  const rotor = new THREE.Group();
  rotor.name = 'rotor';

  const shell = new THREE.Mesh(
    lathe([[0.09, 0.055], [0.15, 0.045], [0.198, 0.02], [0.205, -0.01], [0.198, -0.035], [0.185, -0.045]]),
    materials.body,
  );
  const trim = new THREE.Mesh(
    lathe([[0.186, -0.045], [0.178, -0.054], [0.16, -0.058], [0.142, -0.056]]),
    materials.trim,
  );
  const accent = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.0065, 16, 96), materials.accent);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = -0.057;
  const cap = new THREE.Mesh(
    lathe([[0.132, -0.055], [0.128, -0.062], [0.08, -0.066], [0, -0.067]]),
    materials.cap,
  );
  rotor.add(shell, trim, accent, cap);

  const bladeGeo = bladeGeometry();
  const blades = [];
  for (let i = 0; i < BLADE_COUNT; i++) {
    const pivot = new THREE.Group(); // the pivot lets the intro animation fold and unfold each blade
    const blade = new THREE.Mesh(bladeGeo, materials.blade);
    blade.position.y = -0.012;
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
  return { fan, rotor, stator, blades, blurDisc, hitArea, setFinish };
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
