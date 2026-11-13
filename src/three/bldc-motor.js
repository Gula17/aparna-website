// The inside of the Aeroflow's BLDC motor, for the home page's "01 BLDC" step: as the step scrolls in, the
// parts slide down out of the housing along the shaft and close back up as it scrolls on (src/scenes/fan-journey.js).
// A clean, stylised illustration in a few low-poly pieces with shared materials, not an engineering drawing:
//   upper bearing · stator with copper-coloured windings · rotor with its magnet ring · lower bearing ·
//   inverter driver board · bottom cover (the housing's own cap, moved by the caller)
// Units are the fan's (blade tip at radius 1); the motor housing spans about y = +0.055 to -0.074.

import * as THREE from 'three';

const physical = (spec) => new THREE.MeshPhysicalMaterial({ roughness: 0.4, ...spec });

export function createMotorInternals() {
  const mat = {
    steel: physical({ color: '#c9ccd0', metalness: 1, roughness: 0.22 }),
    core: physical({ color: '#3b3d42', metalness: 0.7, roughness: 0.35 }),
    coil: physical({ color: '#c0703f', metalness: 1, roughness: 0.3 }), // colour only (no claim about the metal)
    magnet: physical({ color: '#25272b', metalness: 0.4, roughness: 0.3, clearcoat: 0.6 }),
    pole: physical({ color: '#5a5e66', metalness: 0.6, roughness: 0.3 }),
    board: physical({ color: '#1d3a30', roughness: 0.55 }),
    chip: physical({ color: '#121314', roughness: 0.5 }),
    cap: physical({ color: '#2d4f7a', roughness: 0.35, clearcoat: 0.5 }),
  };
  const group = new THREE.Group();
  group.name = 'motor-internals';
  group.visible = false;

  const ring = (rOut, rIn, h, material, segments = 48) => {
    const shape = new THREE.Shape().absarc(0, 0, rOut, 0, Math.PI * 2);
    shape.holes.push(new THREE.Path().absarc(0, 0, rIn, 0, Math.PI * 2, true));
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: segments });
    g.rotateX(Math.PI / 2);
    g.translate(0, h / 2, 0);
    return new THREE.Mesh(g, material);
  };
  const instanced = (geo, material, transforms) => {
    const m = new THREE.InstancedMesh(geo, material, transforms.length);
    const o = new THREE.Object3D();
    transforms.forEach(([x, y, z, ry], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    return m;
  };

  // the shaft, scaled with the split so it always runs through every part
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 16), mat.steel);
  group.add(shaft);

  // a bearing: outer race, a ring of balls, inner race
  const bearing = () => {
    const b = new THREE.Group();
    b.add(ring(0.03, 0.022, 0.012, mat.steel), ring(0.017, 0.012, 0.012, mat.steel));
    const balls = 10;
    b.add(instanced(new THREE.SphereGeometry(0.0042, 8, 6), mat.steel, Array.from({ length: balls }, (_, i) => {
      const a = (i / balls) * Math.PI * 2; return [Math.cos(a) * 0.0195, 0, Math.sin(a) * 0.0195, 0];
    })));
    return b;
  };
  const upperBearing = bearing();
  const lowerBearing = bearing();

  // the stator: a laminated core with teeth, each wound with a coil
  const stator = new THREE.Group();
  stator.add(ring(0.06, 0.02, 0.032, mat.core));
  const teeth = 18;
  const toothAt = (r) => Array.from({ length: teeth }, (_, i) => { const a = (i / teeth) * Math.PI * 2; return [Math.cos(a) * r, 0, Math.sin(a) * r, -a]; });
  stator.add(instanced(new THREE.BoxGeometry(0.05, 0.03, 0.012), mat.core, toothAt(0.085)));
  stator.add(instanced(new THREE.BoxGeometry(0.03, 0.038, 0.02), mat.coil, toothAt(0.088)));

  // the rotor: a steel can lined with a ring of permanent magnets, alternating poles
  const rotor = new THREE.Group();
  rotor.add(ring(0.152, 0.146, 0.05, mat.steel, 64));
  const poles = 16;
  rotor.add(instanced(new THREE.BoxGeometry(0.052, 0.042, 0.012), mat.magnet, Array.from({ length: poles / 2 }, (_, i) => {
    const a = ((i * 2) / poles) * Math.PI * 2; return [Math.cos(a) * 0.139, 0, Math.sin(a) * 0.139, -a + Math.PI / 2];
  })));
  rotor.add(instanced(new THREE.BoxGeometry(0.052, 0.042, 0.012), mat.pole, Array.from({ length: poles / 2 }, (_, i) => {
    const a = ((i * 2 + 1) / poles) * Math.PI * 2; return [Math.cos(a) * 0.139, 0, Math.sin(a) * 0.139, -a + Math.PI / 2];
  })));

  // the inverter driver board: a ring-shaped circuit board with chips and capacitors
  const board = new THREE.Group();
  board.add(ring(0.125, 0.03, 0.006, mat.board, 40));
  const chips = [[0.07, 0.0, 0.02, 0.4], [-0.05, 0, 0.06, 1.2], [0.0, 0, -0.08, 0], [-0.08, 0, -0.03, 2.1], [0.05, 0, -0.06, 0.8], [0.09, 0, 0.05, 1.6]];
  board.add(instanced(new THREE.BoxGeometry(0.026, 0.006, 0.018), mat.chip, chips.map(([x, , z, r]) => [x, -0.006, z, r])));
  const caps = [[-0.095, 0.03], [0.03, 0.095], [-0.02, -0.1], [0.1, -0.02]];
  board.add(instanced(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 12), mat.cap, caps.map(([x, z]) => [x, -0.014, z, 0])));

  group.add(upperBearing, stator, rotor, lowerBearing, board);

  // where each part sits closed (inside the housing), and how far it travels down when fully open
  const parts = [
    [upperBearing, 0.035, -0.085],
    [stator, 0.005, -0.15],
    [rotor, -0.005, -0.235],
    [lowerBearing, -0.045, -0.3],
    [board, -0.058, -0.37],
  ];
  const BOTTOM_TRAVEL = -0.46; // the bottom cover, moved by the caller

  // where the labels point, in the fan's coordinates, for a given split
  const anchors = (t, spread) => ({
    motor: new THREE.Vector3(0.15, -0.005 - 0.235 * t * spread, 0),
    board: new THREE.Vector3(0.12, -0.058 - 0.37 * t * spread, 0),
    bearing: new THREE.Vector3(0.03, -0.045 - 0.3 * t * spread, 0),
    housing: new THREE.Vector3(0.19, -0.074 + BOTTOM_TRAVEL * t * spread, 0),
  });

  // t: 0 closed .. 1 open; spread: how far apart (1 on desktop, tighter on phones)
  function setSplit(t, spread = 1) {
    group.visible = t > 0.002;
    for (const [part, y, travel] of parts) part.position.y = y + travel * t * spread;
    const top = 0.05, bottom = -0.07 + BOTTOM_TRAVEL * t * spread;
    shaft.scale.y = top - bottom;
    shaft.position.y = (top + bottom) / 2;
  }
  setSplit(0);
  return { group, setSplit, anchors, bottomTravel: BOTTOM_TRAVEL };
}
