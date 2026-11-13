// Builds the events pages' data from src/content/events.json (hand-edited, see its _read_me).
// Used by prepare-content.mjs. Output: src/content/events.generated.json (never edit it by hand) and the
// pictures and loops in public/media/events/<event id>/.
//
// Photos are resized to WebP (640 and 1280 px wide); a video loop is copied as it is. Captions and alt
// text come from the file names ("What it shows - CAMERA123.jpg" -> "What it shows").

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

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
    // start from a clean set of pictures, so hidden or removed photos never linger in the build (loops are kept)
    for (const f of await fs.readdir(outDir)) if (f.endsWith('.webp')) await fs.rm(path.join(outDir, f));
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
      // e.hide: photos left out of the page (by folder/file name, or just file name); the originals stay in the pack
      const hidden = new Set(e.hide ?? []);
      const files = (await fs.readdir(resolve(dir))).filter((f) => PHOTO.test(f) && !hidden.has(f) && !hidden.has(`${path.basename(resolve(dir))}/${f}`))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      return Promise.all(files.map((f) => photo(path.join(resolve(dir), f))));
    }

    const photos = e.photos ? await folder(e.photos) : [];
    const galleries = [];
    for (const g of e.galleries ?? []) {
      const items = await folder(g.folder);
      items.forEach((it, i) => { if (!it.caption) it.alt = `${e.name}, ${g.title}: ${i + 1} of ${items.length}`; });
      galleries.push({ title: g.title, subtitle: g.subtitle ?? '', items });
    }
    // the launch card's photo: trimmed at the source when asked (crop: fractions), then shown at its own shape
    let launchPhoto = null;
    if (e.launchPhoto) {
      const lp = e.launchPhoto;
      let img = sharp(await fs.readFile(resolve(lp.file))).rotate();
      if (lp.crop) {
        const m = await sharp(await img.toBuffer()).metadata();
        const [l, t, w, h] = lp.crop;
        img = sharp(await img.toBuffer()).extract({ left: Math.round(l * m.width), top: Math.round(t * m.height), width: Math.round(w * m.width), height: Math.round(h * m.height) });
      }
      const input = await img.toBuffer();
      const variants = [];
      for (const w of [640, 1280]) {
        const out = path.join(outDir, `launch-${w}.webp`);
        const info = await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
        variants.push({ file: `/media/events/${e.id}/launch-${w}.webp`, width: info.width, height: info.height });
      }
      launchPhoto = { variants, alt: lp.alt ?? e.name, caption: '' };
    }

    const cover = e.cover ? await photo(resolve(e.cover)) : photos[0] ?? galleries[0]?.items[0] ?? null;

    // video loops: the original is copied as it is (H.264 MP4, fast-start); phones get a 720p H.264 copy (Main
    // profile, yuv420p, fast-start, no sound) made once with ffmpeg, a few MB instead of 12-21 MB
    async function copyVideo(file) {
      const base = slug(path.basename(file, path.extname(file))).slice(0, 40);
      const out = path.join(outDir, `${base}.mp4`);
      const small = path.join(outDir, `${base}-720.mp4`);
      const [a, b, c] = await Promise.all([fs.stat(resolve(file)), fs.stat(out).catch(() => null), fs.stat(small).catch(() => null)]);
      if (!b || b.size !== a.size) await fs.copyFile(resolve(file), out);
      if (!c || c.mtimeMs < a.mtimeMs) {
        await run(ffmpegPath, ['-y', '-i', resolve(file), '-an', '-vf', 'scale=-2:720', '-c:v', 'libx264', '-profile:v', 'main', '-level', '3.1',
          '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '27', '-maxrate', '1600k', '-bufsize', '3200k', '-movflags', '+faststart', small]);
      }
      return { src: `/media/events/${e.id}/${base}.mp4`, small: `/media/events/${e.id}/${base}-720.mp4` };
    }
    const video = e.video ? await copyVideo(e.video) : null;
    const drones = [];
    for (const d of e.drones ?? []) drones.push({ label: d.label, video: await copyVideo(d.file), poster: d.poster ? await photo(resolve(d.poster)) : cover });

    events.push({
      id: e.id, url: `/events/${e.id}/`, name: e.name, when: e.when, date: e.date, kicker: e.kicker ?? '',
      summary: e.summary, marquee: e.marquee?.length ? e.marquee : [e.kicker, `${e.name} · ${e.when}`].filter(Boolean), cover, video, drones, afterMovie: e.afterMovie ?? null, photos, galleries, launches: e.launches ?? [], launchPhoto,
      count: photos.length + galleries.reduce((n, g) => n + g.items.length, 0),
    });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { events };
}
