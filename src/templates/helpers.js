// Small helpers shared by the page templates.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// An MRP in Indian digit grouping, e.g. ₹10,395 (catalogue pages and the home page's BLDC cards).
export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Turns a mention of Utsav '26 in an already-escaped line into a link to its event page.
export const linkEvents = (html) => html.replace(/Utsav &#39;26/g, '<a class="event-link" href="/events/utsav-26/">Utsav &#39;26</a>');

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
