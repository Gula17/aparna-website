// The Aparna AEROFLOW BLDC ceiling fan (1200 mm, three blades), built procedurally in three.js.
// References: catalogue leaf 3, poster "04 AEROFLOW", the event standee photo.
//
// Units: the blade tip sits at radius 1. The fan hangs from y = CANOPY_TOP down to the blades at y = 0.
// The rotor (motor shell + blades) is a separate group so it can spin while the downrod and canopy stay still.

import * as THREE from 'three';
import { makeWoodTexture } from './wood-texture.js';
import { brandMarkCurved } from './brand-mark.js';

export const BLADE_COUNT = 3; // Brief §3.7: always exactly three blades.
export const CANOPY_TOP = 0.6; // studio photo: a short drop, the canopy close above the motor

// ---------------------------------------------------------------- finishes

const chrome = { color: '#eceef0', metalness: 1, roughness: 0.18 };
const copper = { color: '#b8653f', metalness: 1, roughness: 0.28 };

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
    mount: { color: '#bd8a64', roughness: 0.42, clearcoat: 0.35 }, // studio photo: a plain tan canopy and downrod
    cap: { wood: true, roughness: 0.45, clearcoat: 0.5 },
    trim: { wood: true, roughness: 0.48, clearcoat: 0.45 },
    accent: copper,
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

// One broad paddle blade (studio photo): wide and nearly straight, gently curving back, and flaring much wider
// at the root so it flows smoothly into the motor shell. The outline is drawn flat (x = out along the radius,
// y = across the chord), then turned to lie horizontally with a small pitch.
function bladeGeometry() {
  const leading = [];
  const trailing = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = 0.12 + (0.86 * i) / steps; // starts inside the motor shell, so the roots never show
    const sweep = 0.1 * (x - 0.1) ** 2; // a gentle backward curve towards the tip
    const root = 0.15 * Math.exp(-((x - 0.2) ** 2) * 30); // the wide flare where it leaves the collar
    const width = 0.27 - 0.09 * x + root;
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
    depth: 0.022, // thick, rounded blades as pictured
    bevelEnabled: true,
    bevelThickness: 0.011,
    bevelSize: 0.009,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -0.011);
  geo.rotateX(-Math.PI / 2); // lie flat; the chord now runs along z
  // Pitch: lift the leading edge so the blade pushes air down.
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.08));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- the fan

export function createAeroflow({ shadows = false } = {}) {
  const wood = makeWoodTexture();
  // Double-sided so the open lathe shapes (canopy, shell, cap) look solid from every camera angle.
  const material = () => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const materials = { blade: material(), body: material(), mount: material(), cap: material(), trim: material(), accent: material() };

  const fan = new THREE.Group();
  fan.name = 'aeroflow';

  // Canopy (studio photo): a small rounded egg shape with a flat top, narrowing into the downrod.
  const canopy = new THREE.Mesh(
    lathe([[0, CANOPY_TOP], [0.07, CANOPY_TOP], [0.092, CANOPY_TOP - 0.025], [0.1, CANOPY_TOP - 0.07], [0.088, CANOPY_TOP - 0.13], [0.058, CANOPY_TOP - 0.18], [0.04, CANOPY_TOP - 0.205]]),
    materials.mount,
  );
  // Downrod: straight, flaring into the top of the motor.
  const downrod = new THREE.Mesh(
    lathe([[0.037, CANOPY_TOP - 0.205], [0.036, 0.2], [0.04, 0.13], [0.06, 0.08], [0.09, 0.05]], 40), // short and stout
    materials.mount,
  );
  // the logo printed on the front of the canopy: red on the light finishes, white on grey
  const logos = {
    red: brandMarkCurved({ colour: 'red', width: 0.105, radius: 0.1025, y: CANOPY_TOP - 0.078 }),
    white: brandMarkCurved({ colour: 'white', width: 0.105, radius: 0.1025, y: CANOPY_TOP - 0.078 }),
  };
  const stator = new THREE.Group(); // parts that stay still
  stator.add(canopy, downrod, logos.red, logos.white);

  // Rotor: the motor shell, the trim ring, the copper accent, the centre cap and the three blades.
  const rotor = new THREE.Group();
  rotor.name = 'rotor';

  const shell = new THREE.Mesh(
    lathe([[0.09, 0.055], [0.15, 0.045], [0.198, 0.02], [0.208, -0.015], [0.214, -0.046], [0.232, -0.058], [0.236, -0.064], [0.226, -0.07], [0.2, -0.0725], [0.165, -0.0735]]),
    materials.body,
  );
  // Seen from below (studio photos, posters 03/04): a smooth collar in the body colour that the blades grow
  // out of, a thin bright ring (chrome, or copper on golden and wood) and a flat cap set just inside it.
  const trim = new THREE.Mesh(
    lathe([[0.165, -0.0735], [0.152, -0.074], [0.144, -0.074]]),
    materials.trim,
  );
  const accent = new THREE.Mesh(new THREE.TorusGeometry(0.139, 0.0068, 16, 96), materials.accent);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = -0.074;
  const cap = new THREE.Mesh(
    lathe([[0.133, -0.0715], [0.12, -0.072], [0, -0.0722]]),
    materials.cap,
  );
  // the fine seam where each blade meets the hub, following the collar's edge
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.236, 0.0016, 6, 128), new THREE.MeshBasicMaterial({ color: '#2a1d15', transparent: true, opacity: 0.5 }));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = -0.064;
  rotor.add(shell, trim, accent, cap, seam);

  const bladeGeo = bladeGeometry();
  const blades = [];
  for (let i = 0; i < BLADE_COUNT; i++) {
    const pivot = new THREE.Group(); // the pivot lets the intro animation fold and unfold each blade
    const blade = new THREE.Mesh(bladeGeo, materials.blade);
    blade.position.y = -0.038; // low on the motor: the blades' underside runs level with the collar, as pictured
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
    logos.white.visible = name === 'grey';
    logos.red.visible = name !== 'grey';
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
