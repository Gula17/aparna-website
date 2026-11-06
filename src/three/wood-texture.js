// A procedural wood-grain texture for the Wood Craft finish, tuned to the warm walnut of catalogue leaf 3.
// Drawn on a canvas so it costs no download. The grain runs along the texture's x axis, which the blade
// geometry maps to the blade's length.

import * as THREE from 'three';

const BASE = ['#7c3f1e', '#904d27', '#6e361a'];
const DARK = 'rgba(52, 22, 8, ALPHA)';
const LIGHT = 'rgba(200, 128, 76, ALPHA)';

// Small deterministic random generator so every visitor sees the same grain.
function random(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function makeWoodTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = random(1991);

  const base = ctx.createLinearGradient(0, 0, 0, h);
  BASE.forEach((c, i) => base.addColorStop(i / (BASE.length - 1), c));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Long, gently waving grain lines.
  for (let i = 0; i < 150; i++) {
    const y0 = rand() * h;
    const amp = 4 + rand() * 18;
    const freq = 0.002 + rand() * 0.006;
    const phase = rand() * Math.PI * 2;
    const dark = rand() > 0.35;
    const alpha = (dark ? 0.12 : 0.1) + rand() * 0.22;
    ctx.strokeStyle = (dark ? DARK : LIGHT).replace('ALPHA', alpha.toFixed(2));
    ctx.lineWidth = 0.6 + rand() * (dark ? 3.2 : 2);
    ctx.beginPath();
    for (let x = -10; x <= w + 10; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.25;
      if (x === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A few darker "cathedral" figure bands, like the flame pattern on the real blade.
  for (let i = 0; i < 6; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    for (let r = 0; r < 8; r++) {
      ctx.strokeStyle = DARK.replace('ALPHA', (0.08 + rand() * 0.1).toFixed(2));
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 120 + r * 26, 14 + r * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.6);
  tex.anisotropy = 4;
  return tex;
}
