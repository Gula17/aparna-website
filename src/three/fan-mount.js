// The still parts a ceiling fan hangs from, as listed in Aparna's ceiling fan manual (08_Support_Reference):
// the top canopy over the ceiling hanger (with a small screw on its neck), the down rod, and the bottom canopy:
// a separate cover that slides down the rod over the joint where it bolts to the motor, left "3 to 4 mm" above
// the motor body and held by a screw on its neck. The motor below it turns; these parts don't.
//
// Units are the fans' own (blade tip at radius 1, about 600 mm), so 4 mm is about 0.007.

import * as THREE from 'three';

export const CANOPY_GAP = 0.0065; // the manual's 3-4 mm between the bottom canopy and the motor body

const lathe = (points, segments = 48) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// A small round screw head standing out from a surface of radius r at height y, facing 'angle' (0 = +z).
export function neckScrew(material, { r, y, angle = 0.6, size = 0.0055 }) {
  const head = new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 0.8, 14), material);
  head.rotation.z = Math.PI / 2;
  head.rotation.y = angle - Math.PI / 2;
  head.position.set(Math.sin(angle) * (r + size * 0.3), y, Math.cos(angle) * (r + size * 0.3));
  return head;
}

// The bottom canopy: a short neck round the rod, then a bell flaring down to rest just above the motor.
//   rodR   the rod's radius          top    where the neck starts on the rod
//   baseR  the bell's lower radius   baseY  the height of the motor's surface under the bell's edge
//   shape  'bell' (a curved flare), 'cup' (nearly upright sides, as on the Aerosleek) or 'cone' (straight sides)
export function bottomCanopy(material, screwMaterial, { rodR, top, baseR, baseY, shape = 'bell', angle = 0.6 }) {
  const neckR = rodR + 0.006;
  const low = baseY + CANOPY_GAP;
  const h = top - low;
  const outline = shape === 'cone'
    ? [[rodR + 0.001, top], [neckR, top - 0.002], [neckR, top - h * 0.14], [neckR + 0.003, top - h * 0.18], [baseR * 0.96, low + 0.004], [baseR, low + 0.001], [baseR * 0.97, low]]
    : shape === 'cup'
    ? [[rodR + 0.001, top], [neckR, top - 0.002], [neckR, top - h * 0.3], [neckR + 0.006, top - h * 0.38], [baseR * 0.9, top - h * 0.55], [baseR, top - h * 0.75], [baseR, low + 0.002], [baseR * 0.97, low]]
    : [[rodR + 0.001, top], [neckR, top - 0.002], [neckR, top - h * 0.3], [neckR + 0.004, top - h * 0.36], [baseR * 0.55, top - h * 0.6], [baseR * 0.85, top - h * 0.82], [baseR, low + 0.002], [baseR * 0.97, low]];
  const g = new THREE.Group();
  g.name = 'bottom-canopy';
  g.add(new THREE.Mesh(lathe(outline), material));
  g.add(neckScrew(screwMaterial ?? material, { r: neckR, y: top - h * 0.16, angle }));
  return g;
}
