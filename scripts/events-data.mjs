// Builds the events pages' data from src/content/events.json (hand-edited, see its _read_me).
// Used by prepare-content.mjs. Output: src/content/events.generated.json (never edit it by hand) and the
// pictures and loops in public/media/events/<event id>/.
//
// Photos are resized to WebP (640 and 1280 px wide); a video loop is copied as it is. Captions and alt
// text come from the file names ("What it shows - CAMERA123.jpg" -> "What it shows").

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
const PHOTO = /\.(jpe?g|png|webp)$/i;
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const caption = (file) => {
  const base = path.basename(file, path.extname(file)).replace(/\s+-\s+[A-Z]{2,}\d+$/, '').trim();
  return /^\d+$/.test(base) ? '' : base.charAt(0).toUpperCase() + base.slice(1);
};

export async function buildEvents({ root, pack, publicDir, contentDir }) {
  const source = JSON.parse(await fs.readFile(path.join(contentDir, 'events.json'), 'utf8'));
  const resolve = (p) => (p.startsWith('pack:') ? path.join(pack, p.slice(5)) : path.join(root, p));
  const events = [];

  for (const e of source.events) {
    const outDir = path.join(publicDir, 'media', 'events', e.id);
    await fs.mkdir(outDir, { recursive: true });
    const done = new Map();
    let n = 0; // numbers each picture once, in call order (photos are processed in parallel)

    async function photo(file, alt) {
      if (done.has(file)) return done.get(file);
      const key = `${slug(path.basename(file, path.extname(file))).slice(0, 60)}-${n++}`;
      const input = await fs.readFile(file);
      const variants = [];
      for (const w of [640, 1280]) {
        const out = path.join(outDir, `${key}-${w}.webp`);
        const info = await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(out);
        variants.push({ file: `/media/events/${e.id}/${key}-${w}.webp`, width: info.width, height: info.height });
      }
      const text = e.captions?.[path.basename(file)] ?? caption(file);
      const entry = { variants, alt: alt || text || e.name, caption: text };
      done.set(file, entry);
      return entry;
    }
    async function folder(dir) {
      const files = (await fs.readdir(resolve(dir))).filter((f) => PHOTO.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      return Promise.all(files.map((f) => photo(path.join(resolve(dir), f))));
    }

    const photos = e.photos ? await folder(e.photos) : [];
    const galleries = [];
    for (const g of e.galleries ?? []) {
      const items = await folder(g.folder);
      items.forEach((it, i) => { if (!it.caption) it.alt = `${e.name}, ${g.title}: ${i + 1} of ${items.length}`; });
      galleries.push({ title: g.title, subtitle: g.subtitle ?? '', items });
    }
    const cover = e.cover ? await photo(resolve(e.cover)) : photos[0] ?? galleries[0]?.items[0] ?? null;

    let video = null;
    if (e.video) {
      const name = `${slug(path.basename(e.video, path.extname(e.video))).slice(0, 40)}.mp4`;
      const out = path.join(outDir, name);
      const [a, b] = await Promise.all([fs.stat(resolve(e.video)), fs.stat(out).catch(() => null)]);
      if (!b || b.size !== a.size) await fs.copyFile(resolve(e.video), out);
      video = `/media/events/${e.id}/${name}`;
    }

    events.push({
      id: e.id, url: `/events/${e.id}/`, name: e.name, when: e.when, date: e.date, kicker: e.kicker ?? '',
      summary: e.summary, cover, video, afterMovie: e.afterMovie ?? null, photos, galleries, launches: e.launches ?? [],
      count: photos.length + galleries.reduce((n, g) => n + g.items.length, 0),
    });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { events };
}
