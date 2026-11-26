// Colour preview on a product page: when a colour is chosen that has no photo of its own, the product's own cutout
// (its real photo with the background removed) is recoloured on screen: the painted body takes the chosen colour,
// keeping the photo's light and shade; parts in other colours (the red logo, copper or chrome rings, the motor's
// dark gaps) stay as they are. A "Colour preview" label is shown with it, so it is never taken for a real photo.
// Products without a cutout (a framed photo with its background) can't be recoloured cleanly: they show a line
// saying a photo of that colour is coming soon instead.

// ---- sRGB <-> CIELAB (D65)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
function toLab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function toRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fi(fx) * 0.95047, y = fi(fy), z = fi(fz) * 1.08883;
  const R = 3.2406 * x - 1.5372 * y - 0.4986 * z, G = -0.9689 * x + 1.8758 * y + 0.0415 * z, B = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [R, G, B].map((c) => Math.round(255 * Math.min(1, Math.max(0, gam(Math.max(0, c))))));
}
const hexRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cache = new Map();

// The cutout recoloured to `hex`, as an object URL (cached per picture and colour).
export async function recolour(src, hex) {
  const key = `${src}|${hex}`;
  if (cache.has(key)) return cache.get(key);
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const n = w * h;
  const lab = new Float32Array(n * 3);
  const As = [], Bs = [];
  for (let i = 0; i < n; i++) {
    if (px[i * 4 + 3] < 8) continue;
    const [L, a, b] = toLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    lab.set([L, a, b], i * 3);
    if (px[i * 4 + 3] > 200 && L > 25 && i % 3 === 0) { As.push(a); Bs.push(b); }
  }
  // the body's colour: the most common colour of the product (its painted body covers most of it)
  const med = (v) => { const s = v.sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
  const ma = med(As), mb = med(Bs);
  const Ls = [];
  for (let i = 0; i < n; i += 2) if (px[i * 4 + 3] > 200 && Math.hypot(lab[i * 3 + 1] - ma, lab[i * 3 + 2] - mb) < 12) Ls.push(lab[i * 3]);
  Ls.sort((x, y) => x - y);
  const bodyL = Ls[Math.floor(Ls.length * 0.7)] ?? 70; // a well-lit part of the body
  const [Lt, at, bt] = toLab(...hexRgb(hex));
  for (let i = 0; i < n; i++) {
    if (px[i * 4 + 3] < 8) continue;
    const L = lab[i * 3], a = lab[i * 3 + 1], b = lab[i * 3 + 2];
    // how much this pixel belongs to the body: close to its colour, and not one of the dark gaps
    const wgt = (1 - smooth(10, 22, Math.hypot(a - ma, b - mb))) * smooth(bodyL * 0.3, bodyL * 0.5, L);
    if (wgt <= 0.01) continue;
    // keep the photo's shading: darker than the body stays darker, lighter stays lighter
    const nL = Lt * (L / bodyL); // the same shading, scaled to the new colour (highlights may reach full white)
    const shade = Math.min(1, L / bodyL);
    const [r, g, bb] = toRgb(Math.min(100, Math.max(0, nL)), at * shade, bt * shade);
    px[i * 4] = Math.round(px[i * 4] + (r - px[i * 4]) * wgt);
    px[i * 4 + 1] = Math.round(px[i * 4 + 1] + (g - px[i * 4 + 1]) * wgt);
    px[i * 4 + 2] = Math.round(px[i * 4 + 2] + (bb - px[i * 4 + 2]) * wgt);
  }
  ctx.putImageData(data, 0, 0);
  const url = await new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/webp', 0.9));
  cache.set(key, url);
  return url;
}

// page: the product page; returns update(input) for the chosen colour's radio button
export function setupColourPreview(page) {
  const slide = page.querySelector('.gallery__slide--stage');
  const img = slide?.querySelector('.stage__product--cutout .stage__img');
  const badge = page.querySelector('[data-colour-preview]');
  const soon = page.querySelector('[data-colour-soon]');
  const pictured = slide?.dataset.pictured ?? '';
  const original = img ? { src: img.getAttribute('src'), srcset: img.getAttribute('srcset') } : null;
  let token = 0;
  const restore = () => {
    if (img && img.getAttribute('src') !== original.src) { img.setAttribute('srcset', original.srcset); img.setAttribute('src', original.src); }
    if (badge) badge.hidden = true;
  };
  return async function update(input) {
    const mine = ++token;
    const colour = input.value;
    const hasPhoto = input.dataset.photo === '1' || colour === pictured;
    if (soon) { soon.hidden = hasPhoto; soon.textContent = soon.dataset.template.replace('{colour}', colour); }
    if (hasPhoto || !img || !input.dataset.hex) { restore(); return; }
    // the largest cutout, recoloured
    const largest = original.srcset.split(',').map((s) => s.trim().split(' ')[0]).at(-1) ?? original.src;
    try {
      const url = await recolour(largest, input.dataset.hex);
      if (mine !== token) return; // another colour was chosen meanwhile
      img.removeAttribute('srcset');
      img.setAttribute('src', url);
      if (badge) { badge.textContent = badge.dataset.template.replace('{colour}', colour); badge.hidden = false; }
      if (soon) soon.hidden = true; // the preview says it already
    } catch {
      restore(); // could not recolour: the real photo, with the "coming soon" line
    }
  };
}
