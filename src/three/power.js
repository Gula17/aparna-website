// "Start" in the 360° view: the parts of a model that come alive when it is switched on.
// Models mark meshes with userData.power:
//   { kind: 'heat', emissive, intensity, color }  coils, rods, grilles: warm up to a red-orange glow
//   { kind: 'lamp' }                             indicator lamps: dark when off, lit when on
//   { kind: 'glow', opacity }                    an extra see-through glow (a cooktop's ring): fades in
// Turning parts (the rotor) are driven by the scene itself.

import * as THREE from 'three';

export function collectPowerParts(root) {
  const parts = [];
  root.traverse((o) => {
    const spec = o.isMesh && o.userData.power;
    if (!spec) return;
    o.material = o.material.clone(); // shared materials (a chrome tube, a coil) change on this part only
    const m = o.material;
    parts.push({
      spec, m,
      color: m.color?.clone(),
      emissive: m.emissive?.clone() ?? new THREE.Color(0),
      intensity: m.emissiveIntensity ?? 1,
      hotEmissive: new THREE.Color(spec.emissive ?? '#ff4a12'),
      hotColor: spec.color ? new THREE.Color(spec.color) : null,
      seed: Math.random() * 10,
    });
  });
  return parts;
}

const tmp = new THREE.Color();
// amount: 0 (off) .. 1 (fully on). Heat flickers a little once it is hot.
export function applyPower(parts, amount, now) {
  for (const p of parts) {
    const { spec, m } = p;
    if (spec.kind === 'glow') {
      m.opacity = (spec.opacity ?? 1) * amount * (0.94 + 0.06 * Math.sin(now / 180 + p.seed));
      continue;
    }
    if (spec.kind === 'lamp') {
      const on = amount > 0.5 ? 1 : 0;
      m.emissive.copy(p.emissive.lengthSq() ? p.emissive : p.color);
      m.emissiveIntensity = on ? Math.max(1.4, p.intensity * 2) : 0.04;
      continue;
    }
    // heat: dull metal when off, glowing when on
    const heat = amount * amount * (3 - 2 * amount); // glows slowly at first, as an element warms
    const flicker = 1 + 0.05 * Math.sin(now / 140 + p.seed) * heat;
    m.emissive.copy(p.emissive).lerp(p.hotEmissive, heat);
    m.emissiveIntensity = THREE.MathUtils.lerp(0, spec.intensity ?? 1.2, heat) * flicker;
    if (p.hotColor && p.color) m.color.copy(p.color).lerp(tmp.copy(p.hotColor), heat * 0.7);
  }
}
