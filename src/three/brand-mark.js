// The Aparna logo printed on the 3D products, as on the real ones. Brief rule 6 and section 4.1: only the
// supplied files (01_Brand/logo, copied to public/brand by npm run content), never retyped, only red or white,
// and the lockup is stacked (the real products print emblem and wordmark side by side, which the brief rules
// out). So products carry the stacked logo: the red-wordmark file on light parts, the white one on dark parts.
//
//   brandMark({ colour: 'white' | 'red', width })            a flat decal facing +z, centred on the origin
//   brandMarkCurved({ colour, width, radius, y, angle })     wrapped round a cylinder or canopy (axis = y)

import * as THREE from 'three';

const FILES = { white: '/brand/aparna-logo-stacked-white.svg', red: '/brand/aparna-logo-stacked-red.svg' };
// the stacked lockup fills the files' 835 x 600 viewBox
const CROP = { x: 0, y: 0, w: 835, h: 600 };
export const MARK_ASPECT = CROP.h / CROP.w;

const textures = {};
function markTexture(colour) {
  if (textures[colour]) return textures[colour];
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * MARK_ASPECT);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // The SVGs carry only a viewBox, so browsers would draw them at a default 300 x 150: give them their real size.
  fetch(FILES[colour] ?? FILES.white).then((r) => r.text()).then((svg) => {
    const sized = svg.replace('<svg ', `<svg width="${CROP.w}" height="${CROP.h}" `);
    const img = new Image();
    img.onload = () => {
      canvas.getContext('2d').drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, canvas.width, canvas.height);
      tex.needsUpdate = true;
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  }).catch(() => {});
  textures[colour] = tex;
  return tex;
}

const markMaterial = (colour) => new THREE.MeshStandardMaterial({
  map: markTexture(colour), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.5,
  polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
});

export function brandMark({ colour = 'white', width = 0.1 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * MARK_ASPECT), markMaterial(colour));
  m.name = 'brand-mark';
  m.renderOrder = 2;
  return m;
}

// Wrapped round a vertical surface of the given radius, centred at height y and facing 'angle' (0 = +z).
export function brandMarkCurved({ colour = 'white', width = 0.1, radius = 0.1, y = 0, angle = 0 } = {}) {
  const arc = width / radius;
  const h = width * MARK_ASPECT;
  // a cylinder's angle 0 faces +z and u grows towards +x, so the decal reads left to right from outside
  const geo = new THREE.CylinderGeometry(radius, radius, h, 32, 1, true, angle - arc / 2, arc);
  geo.translate(0, y, 0);
  const m = new THREE.Mesh(geo, markMaterial(colour));
  m.name = 'brand-mark';
  m.renderOrder = 2;
  return m;
}
