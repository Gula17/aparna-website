// The inside of the Aeroflow's BLDC motor, for the home page's BLDC story: in "01 BLDC" and "05 Double ball
// bearing · Anti-dust" the parts slide down out of the housing along the shaft, the part the story names glows,
// and they close back up as the step scrolls on (src/scenes/fan-journey.js).
// A clean, stylised illustration in a few low-poly pieces, not an engineering drawing:
//   upper bearing · stator with copper-coloured windings · rotor with its magnet ring · lower bearing ·
//   inverter driver board · bottom cover (the housing's own cap, moved by the caller)
// Units are the fan's (blade tip at radius 1); the motor housing spans about y = +0.055 to -0.074.

import * as THREE from 'three';

const physical = (spec) => new THREE.MeshPhysicalMaterial({ roughness: 0.4, ...spec });
const GLOW = new THREE.Color('#ffb85c'); // the labels' gold, as a soft glow on the part being named

// The materials, one set per part, so one part can glow while the others dim (no textures: colours only).
const SPECS = {
  steel: { color: '#c9ccd0', metalness: 1, roughness: 0.22 },
  race: { color: '#8a8e94', metalness: 0.9, roughness: 0.42 }, // a bearing's races: satin, darker
  ball: { color: '#f4f5f7', metalness: 1, roughness: 0.08 }, // its balls: polished, so they stand out between the races
  core: { color: '#3b3d42', metalness: 0.7, roughness: 0.35 },
  coil: { color: '#c0703f', metalness: 1, roughness: 0.3 }, // colour only (no claim about the metal)
  magnet: { color: '#25272b', metalness: 0.4, roughness: 0.3, clearcoat: 0.6 },
  pole: { color: '#5a5e66', metalness: 0.6, roughness: 0.3 },
  board: { color: '#1d3a30', roughness: 0.55 },
  chip: { color: '#121314', roughness: 0.5 },
  cap: { color: '#2d4f7a', roughness: 0.35, clearcoat: 0.5 },
};

// Where each part sits closed (inside the housing), and how far it travels down when fully open.
// Layout 0 ("01 BLDC"): the stack opens evenly. Layout 1 ("05"): wider gaps either side of the two bearings and the
// upper bearing clear of the housing's rim, so the camera can see the balls in their races. Same parts, same order.
const CLOSED = { upperBearing: 0.035, stator: 0.005, rotor: -0.005, lowerBearing: -0.045, board: -0.058 };
const TRAVEL = [
  { upperBearing: -0.085, stator: -0.15, rotor: -0.235, lowerBearing: -0.3, board: -0.37, cover: -0.46 },
  { upperBearing: -0.14, stator: -0.21, rotor: -0.3, lowerBearing: -0.4, board: -0.5, cover: -0.6 },
];
// Each part's size, for its label and for keeping labels clear of the other parts: radius and height (local units).
const SIZE = { upperBearing: [0.03, 0.012], stator: [0.104, 0.038], rotor: [0.152, 0.05], lowerBearing: [0.03, 0.012], board: [0.125, 0.03], cover: [0.18, 0.014] };
const COVER_Y = -0.0735;

export function createMotorInternals() {
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
  // the materials of one part (named for highlighting); geometry is shared where parts repeat
  const focusable = {}; // focus key -> materials
  const mats = (key, names) => {
    const set = Object.fromEntries(names.map((n) => [n, physical(SPECS[n])]));
    for (const m of Object.values(set)) m.userData.base = m.color.clone();
    (focusable[key] ??= []).push(...Object.values(set));
    return set;
  };

  // the shaft, scaled with the split so it always runs through every part (never highlighted)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 16), physical(SPECS.steel));
  group.add(shaft);

  // a bearing: outer race, a ring of balls, inner race (the balls sit in an open gap between the races, so a close
  // look from below shows them)
  const ballGeo = new THREE.SphereGeometry(0.0046, 10, 8);
  const bearing = () => {
    const m = mats('bearing', ['race', 'ball']);
    m.ball.userData.glow = 0.25; // the balls keep their polish, so they read against the glowing races
    const b = new THREE.Group();
    b.add(ring(0.03, 0.0236, 0.011, m.race), ring(0.0154, 0.011, 0.011, m.race));
    const balls = 10;
    b.add(instanced(ballGeo, m.ball, Array.from({ length: balls }, (_, i) => {
      const a = (i / balls) * Math.PI * 2; return [Math.cos(a) * 0.0195, 0, Math.sin(a) * 0.0195, 0];
    })));
    return b;
  };
  const upperBearing = bearing();
  const lowerBearing = bearing();

  // the stator: a laminated core with teeth, each wound with a coil
  const sm = mats('motor', ['core', 'coil']);
  const stator = new THREE.Group();
  stator.add(ring(0.06, 0.02, 0.032, sm.core));
  const teeth = 18;
  const toothAt = (r) => Array.from({ length: teeth }, (_, i) => { const a = (i / teeth) * Math.PI * 2; return [Math.cos(a) * r, 0, Math.sin(a) * r, -a]; });
  stator.add(instanced(new THREE.BoxGeometry(0.05, 0.03, 0.012), sm.core, toothAt(0.085)));
  stator.add(instanced(new THREE.BoxGeometry(0.03, 0.038, 0.02), sm.coil, toothAt(0.088)));

  // the rotor: a steel can lined with a ring of permanent magnets, alternating poles
  const rm = mats('motor', ['steel', 'magnet', 'pole']);
  const rotor = new THREE.Group();
  rotor.add(ring(0.152, 0.146, 0.05, rm.steel, 64));
  const poles = 16;
  rotor.add(instanced(new THREE.BoxGeometry(0.052, 0.042, 0.012), rm.magnet, Array.from({ length: poles / 2 }, (_, i) => {
    const a = ((i * 2) / poles) * Math.PI * 2; return [Math.cos(a) * 0.139, 0, Math.sin(a) * 0.139, -a + Math.PI / 2];
  })));
  rotor.add(instanced(new THREE.BoxGeometry(0.052, 0.042, 0.012), rm.pole, Array.from({ length: poles / 2 }, (_, i) => {
    const a = ((i * 2 + 1) / poles) * Math.PI * 2; return [Math.cos(a) * 0.139, 0, Math.sin(a) * 0.139, -a + Math.PI / 2];
  })));

  // the inverter driver board: a ring-shaped circuit board with chips and capacitors
  const bm = mats('board', ['board', 'chip', 'cap']);
  const board = new THREE.Group();
  board.add(ring(0.125, 0.03, 0.006, bm.board, 40));
  const chips = [[0.07, 0.0, 0.02, 0.4], [-0.05, 0, 0.06, 1.2], [0.0, 0, -0.08, 0], [-0.08, 0, -0.03, 2.1], [0.05, 0, -0.06, 0.8], [0.09, 0, 0.05, 1.6]];
  board.add(instanced(new THREE.BoxGeometry(0.026, 0.006, 0.018), bm.chip, chips.map(([x, , z, r]) => [x, -0.006, z, r])));
  const caps = [[-0.095, 0.03], [0.03, 0.095], [-0.02, -0.1], [0.1, -0.02]];
  board.add(instanced(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 12), bm.cap, caps.map(([x, z]) => [x, -0.014, z, 0])));

  group.add(upperBearing, stator, rotor, lowerBearing, board);
  const parts = { upperBearing, stator, rotor, lowerBearing, board };

  // travel for a layout between 0 and 1
  const travelAt = (key, layout) => TRAVEL[0][key] + (TRAVEL[1][key] - TRAVEL[0][key]) * layout;
  const yAt = (key, t, spread, layout) => (key === 'cover' ? COVER_Y : CLOSED[key]) + travelAt(key, layout) * t * spread;

  // Where the labels point and how big each part is, in the fan's coordinates, for a given split.
  // Labels: motor = the rotor can (the motor's widest ring, with the stator inside it), board, bearing = the lower
  // bearing (bearing2 = the upper one, for its second dot), housing = the bottom cover.
  function anchors(t, spread = 1, layout = 0) {
    const at = (key) => ({ y: yAt(key, t, spread, layout), r: SIZE[key][0], h: SIZE[key][1] });
    return {
      labels: { motor: at('rotor'), board: at('board'), bearing: at('lowerBearing'), bearing2: at('upperBearing'), housing: at('cover') },
      stack: ['upperBearing', 'stator', 'rotor', 'lowerBearing', 'board', 'cover'].map(at),
    };
  }

  // t: 0 closed .. 1 open; spread: how far apart (1 on desktop, tighter on phones); layout: 0 (01) .. 1 (05)
  function setSplit(t, spread = 1, layout = 0) {
    group.visible = t > 0.002;
    for (const [key, part] of Object.entries(parts)) part.position.y = yAt(key, t, spread, layout);
    const top = 0.05, bottom = -0.07 + travelAt('cover', layout) * t * spread;
    shaft.scale.y = top - bottom;
    shaft.position.y = (top + bottom) / 2;
  }

  // focus: { motor, board, bearing } 0..1 each (the part glows); dim 0..1: the parts not in focus darken
  let last = '';
  function setFocus(focus = {}, dim = 0) {
    const key = JSON.stringify(focus) + dim.toFixed(3);
    if (key === last) return; // nothing to update (it runs on every frame while labels show)
    last = key;
    for (const [part, list] of Object.entries(focusable)) {
      const f = focus[part] ?? 0;
      for (const m of list) {
        m.color.copy(m.userData.base).multiplyScalar(1 - 0.58 * dim * (1 - f));
        m.emissive.copy(GLOW).multiplyScalar(0.11 * f * (m.userData.glow ?? 1));
      }
    }
  }

  setSplit(0);
  return { group, setSplit, setFocus, anchors, travelAt, coverY: (t, spread, layout) => yAt('cover', t, spread, layout) - COVER_Y };
}
