// Small helpers shared by the page templates.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Fills "{name}" style placeholders in a copy string.
export const fmt = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

// A responsive <img> for an entry in range.generated.json -> media.
export function picture(media, key, { className = '', sizes = '100vw', eager = false, alt } = {}) {
  const item = media[key];
  if (!item) throw new Error(`Missing image "${key}". Add it to src/content/images.json and run npm run content.`);
  const largest = item.variants.at(-1);
  const srcset = item.variants.map((v) => `${v.file} ${v.width}w`).join(', ');
  return `<img class="${esc(className)}" src="${esc(largest.file)}" srcset="${esc(srcset)}" sizes="${esc(sizes)}"
    width="${largest.width}" height="${largest.height}" alt="${esc(alt ?? item.alt)}"
    style="object-position:${esc(item.position)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

export const pad = (n) => String(n).padStart(2, '0');
