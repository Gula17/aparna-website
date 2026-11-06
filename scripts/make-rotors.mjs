// Turning blades for fans, from their own photos (no generated pixels).
//
//   npm run rotors
//
// For each fan marked in src/content/rotors.json, its cutout (scripts/make-cutouts.mjs) is split into layers:
//   base   everything outside the blade area (stand, guard ring, canopy): stays still
//   rotor  the blade area: turns, in the fan's own perspective plane
//   top    parts that must stay still on top of the blades (the hub with its logo, a down-rod, a stand neck)
// A fan seen face-on turns in a circle; a ceiling fan seen from below turns in an ellipse, worked out from its
// hub and blade tips. The page stacks the layers and spins only the rotor (src/styles/showroom.css).
//
// Marking a fan (all positions are fractions of the cutout's width and height):
//   hub   [x, y]           the centre the blades turn around
//   r     0.39             face-on fans: blade-area radius, as a fraction of the width
//   axes  [a, b, deg]      face-on fans: blade-area ellipse fitted to the guard (a, b as fractions of the width)
//   tips  [[x, y], ...]    perspective fans: the end of each blade, in order around the hub
//   reach 1.1              blade area as a multiple of the tip distance (blades are wide at the tip)
//   hubR  0.2              still hub, as a fraction of the blade area
//   keep  [[x, y, w, h]]   rectangles that stay still on top (stand neck, oscillation knob, down-rod)
//   blades 5               face-on fans: how many blades (fills the gap a still part leaves; tips give it otherwise)
//   turn  1.1              seconds per turn (the brief caps blades at 1.4 turns a second)

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'src', 'content');
const OUT = path.join(PUBLIC, 'media', 'rotors');

const marks = JSON.parse(await fs.readFile(path.join(CONTENT, 'rotors.json'), 'utf8'));
const cutouts = JSON.parse(await fs.readFile(path.join(CONTENT, 'cutouts.generated.json'), 'utf8')).products;
await fs.mkdir(OUT, { recursive: true });

const inv = ([[a, b], [c, d]]) => { const det = a * d - b * c; return [[d / det, -b / det], [-c / det, a / det]]; };

// The 2x2 matrix that takes the unit circle to the blade circle on screen.
function bladeMatrix(rotor, W, H, centre) {
  if (rotor.r) return [[rotor.r * W, 0], [0, rotor.r * W]];
  if (rotor.axes) {
    // an ellipse fitted to the guard: [a, b] as fractions of the width, turned by ang degrees
    const [a, b, ang] = rotor.axes;
    const t = (ang * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return [[c * a * W, -s * b * W], [s * a * W, c * b * W]];
  }
  // n tips spaced evenly round the hub: least squares fit of tip_i - centre = M * (cos, sin)(2πi/n)
  const n = rotor.tips.length;
  const M = [[0, 0], [0, 0]];
  rotor.tips.forEach(([fx, fy], i) => {
    const px = fx * W - centre[0], py = fy * H - centre[1];
    const ux = Math.cos((2 * Math.PI * i) / n), uy = Math.sin((2 * Math.PI * i) / n);
    M[0][0] += px * ux; M[0][1] += px * uy; M[1][0] += py * ux; M[1][1] += py * uy;
  });
  return M.map((row) => row.map((v) => (v * 2) / n));
}

const result = {};
for (const [id, mark] of Object.entries(marks)) {
  if (id.startsWith('_')) continue;
  const cut = cutouts[id];
  if (!cut) { console.warn(`  ${id}: no cutout, skipped`); continue; }
  const file = path.join(PUBLIC, cut.variants.at(-1).file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const rotors = mark.rotors.map((r) => {
    const centre = [r.hub[0] * W, r.hub[1] * H];
    const M = bladeMatrix(r, W, H, centre);
    return { ...r, centre, M, Mi: inv(M), reach: r.reach ?? (r.tips ? 1.1 : 1), hubR: r.hubR ?? 0.2 };
  });
  const keep = (mark.keep ?? []).map(([x, y, w, h]) => [x * W, y * H, (x + w) * W, (y + h) * H]);

  const inKeep = (x, y) => keep.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  const toDisc = (r, x, y) => {
    const dx = x - r.centre[0], dy = y - r.centre[1];
    return [r.Mi[0][0] * dx + r.Mi[0][1] * dy, r.Mi[1][0] * dx + r.Mi[1][1] * dy];
  };
  const toImage = (r, ux, uy) => [r.M[0][0] * ux + r.M[0][1] * uy + r.centre[0], r.M[1][0] * ux + r.M[1][1] * uy + r.centre[1]];

  const base = Buffer.from(data);
  const top = Buffer.alloc(data.length);
  const layers = rotors.map(() => Buffer.alloc(data.length));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!data[i + 3]) continue;
      let inStill = inKeep(x, y);
      let area = -1;
      rotors.forEach((r, k) => {
        const d = Math.hypot(...toDisc(r, x, y));
        if (d <= r.hubR) inStill = true;
        if (d <= r.reach && area < 0) area = k;
      });
      if (inStill) data.copy(top, i, i, i + 4);
      if (area >= 0) {
        base[i + 3] = 0; // inside a blade area: never left behind as a frozen copy
        if (!inStill) data.copy(layers[area], i, i, i + 4);
      }
    }
  }

  // A still part inside the blade area (a stand neck, a down-rod) leaves a gap in the blade layer, and the gap
  // would travel round as the blades turn. Blades repeat every 360°/n, so the gap is filled with the same
  // fan's own pixels from one blade-step round (never generated).
  rotors.forEach((r, k) => {
    const n = r.blades ?? r.tips?.length ?? 3;
    const layer = layers[k];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inKeep(x, y)) continue;
        const [ux, uy] = toDisc(r, x, y);
        const d = Math.hypot(ux, uy);
        if (d > r.reach || d <= r.hubR) continue;
        for (let step = 1; step < n; step++) {
          const a = (2 * Math.PI * step) / n;
          const [sx, sy] = toImage(r, Math.cos(a) * ux - Math.sin(a) * uy, Math.sin(a) * ux + Math.cos(a) * uy).map(Math.round);
          if (sx < 0 || sy < 0 || sx >= W || sy >= H || inKeep(sx, sy)) continue;
          const j = (sy * W + sx) * 4;
          data.copy(layer, (y * W + x) * 4, j, j + 4); // transparent there too means a gap between blades: correct
          break;
        }
      }
    }
  });

  const key = path.basename(cut.variants.at(-1).file).replace(/-\d+\.webp$/, '');
  const write = async (buf, name) => {
    const variants = [];
    for (const w of [480, 960]) {
      const out = `media/rotors/${key}-${name}-${w}.webp`;
      const res = await sharp(buf, { raw: info }).resize({ width: Math.min(w, W) }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(PUBLIC, out));
      variants.push({ file: `/${out}`, width: res.width, height: res.height });
    }
    return variants;
  };
  const pct = (v, of) => +((v / of) * 100).toFixed(3);
  const css = (m) => [m[0][0], m[1][0], m[0][1], m[1][1]].map((v) => +v.toFixed(5)); // CSS matrix(a, b, c, d)
  result[id] = {
    width: W, height: H,
    base: await write(base, 'base'),
    top: await write(top, 'top'),
    rotors: await Promise.all(rotors.map(async (r, k) => {
      const s = Math.sqrt(Math.abs(r.M[0][0] * r.M[1][1] - r.M[0][1] * r.M[1][0]));
      const L = r.M.map((row) => row.map((v) => v / s)); // same shape, unit size: matrix(L) rotate() matrix(L⁻¹)
      return { image: await write(layers[k], `rotor${k}`), origin: [pct(r.centre[0], W), pct(r.centre[1], H)], L: css(L), Li: css(inv(L)), turn: r.turn ?? 1.1 };
    })),
  };
  console.log(`  ${id}: ${rotors.length} rotor(s)`);
}

await fs.writeFile(path.join(CONTENT, 'rotors.generated.json'), JSON.stringify({
  _generated: 'Made by scripts/make-rotors.mjs from src/content/rotors.json. Do not edit by hand.',
  products: result,
}, null, 2));
console.log(`Rotors: ${Object.keys(result).length} fans`);
