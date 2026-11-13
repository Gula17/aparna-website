import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

// Loads a template module: through Vite in dev (so edits show up without a restart), directly in a build.
// The header's Products menu: each category with its small cutout thumbnail (npm run menu)
const withMenuThumbs = (categories) => {
  const file = path.join(root, 'src/content/menu.generated.json');
  const menu = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).categories : {};
  return categories.map((c) => ({ ...c, thumb: menu[c.slug]?.variants ?? null }));
};

const load = (ctx, file) => (ctx.server ? ctx.server.ssrLoadModule(file) : import(pathToFileURL(path.join(root, file)).href));

// Renders every page from the copy + product data into its HTML, so each page is complete before any
// JavaScript runs (works with JS off, and search engines see real content).
//   index.html             <!--app-->              the home page
//   products/**, events/**, privacy-policy/  <!--page:kind:key-->  catalogue and event pages (shells: npm run content)
function renderPages() {
  return {
    name: 'aparna-render-pages',
    // Runs before Vite reads the page, so it sees the finished HTML (real image URLs, not placeholders).
    transformIndexHtml: { order: 'pre', handler: async (html, ctx) => {
      const t = readJson('src/content/en.json');
      const range = readJson('src/content/range.generated.json');

      if (html.includes('<!--app-->')) {
        const emblemSvg = fs.readFileSync(path.join(root, 'public/brand/aparna-emblem-diya.svg'), 'utf8');
        const { renderHome } = await load(ctx, '/src/templates/home.js');
        // the same categories and counts as the catalogue pages (it adds Motors, Pumps and coming-soon products)
        const cat = fs.existsSync(path.join(root, 'src/content/catalogue.generated.json')) ? readJson('src/content/catalogue.generated.json').categories : null;
        const catProducts = fs.existsSync(path.join(root, 'src/content/catalogue.generated.json')) ? readJson('src/content/catalogue.generated.json').products : [];
        const homeRange = cat ? { ...range, categories: withMenuThumbs(cat).map((c) => ({ ...range.categories.find((r) => r.name === c.name), ...c })) } : range;
        // the BLDC cards carry their MRP, read from the catalogue data (src/content/mrp.json)
        // the station collages: verified cutouts only, names from the catalogue (hidden products are never in it)
        const homeCutouts = fs.existsSync(path.join(root, 'src/content/cutouts.generated.json')) ? readJson('src/content/cutouts.generated.json').products : {};
        const collageFile = path.join(root, 'src/content/station-collages.json');
        homeRange.stationCollages = Object.fromEntries(Object.entries(fs.existsSync(collageFile) ? readJson('src/content/station-collages.json').stations : {}).map(([station, ids]) => [station,
          ids.map((id) => ({ p: catProducts.find((x) => x.id === id), c: homeCutouts[id] })).filter((x) => x.p && x.c).map(({ p, c }) => ({ id: p.id, name: p.name, alt: c.alt ?? `The Aparna ${p.name}`, variants: c.variants }))]));
        homeRange.bldc = range.bldc.map((m) => ({ ...m, mrp: catProducts.find((p) => p.id === m.id)?.mrp ?? null, cutout: homeCutouts[m.id] ?? null }));
        return html
          .replace('<!--app-->', renderHome({ t, range: homeRange, emblemSvg, events: fs.existsSync(path.join(root, 'src/content/events.generated.json')) ? readJson('src/content/events.generated.json') : null }))
          .replaceAll('%TITLE%', t.meta.title)
          .replaceAll('%DESCRIPTION%', t.meta.description)
          .replaceAll('%LANG%', t.lang);
      }

      const marker = html.match(/<!--page:([^>]+)-->/)?.[1];
      if (!marker) return html;
      const catalogue = readJson('src/content/catalogue.generated.json');
      catalogue.categories = withMenuThumbs(catalogue.categories);
      const colours = readJson('src/content/colours.json');
      // Product cutouts (npm run cutouts). Optional: without them every product shows its normal photo.
      const cutouts = fs.existsSync(path.join(root, 'src/content/cutouts.generated.json')) ? readJson('src/content/cutouts.generated.json').products : {};
      // Fans with turning blades (npm run rotors): their cutout is drawn as still and turning layers.
      if (fs.existsSync(path.join(root, 'src/content/rotors.generated.json'))) {
        for (const [id, rotor] of Object.entries(readJson('src/content/rotors.generated.json').products)) if (cutouts[id]) cutouts[id] = { ...cutouts[id], rotor };
      }
      const pages = await load(ctx, '/src/templates/catalogue.js');
      const eventPages = await load(ctx, '/src/templates/events.js');
      const privacyPage = await load(ctx, '/src/templates/privacy.js');
      const events = fs.existsSync(path.join(root, 'src/content/events.generated.json')) ? readJson('src/content/events.generated.json') : { events: [] };
      const [kind, key] = marker.split(':');
      const body = {
        catalogue: () => pages.renderCatalogue({ t, range, catalogue, colours, cutouts }),
        category: () => pages.renderCatalogue({ t, range, catalogue, colours, cutouts, categorySlug: key }),
        product: () => pages.renderProduct({ t, range, catalogue, colours, cutouts, id: key }),
        events: () => eventPages.renderEvents({ t, range, catalogue, events }),
        event: () => eventPages.renderEvent({ t, range, catalogue, events, id: key }),
        privacy: () => privacyPage.renderPrivacy({ t, range, catalogue }),
      }[kind]();
      const meta = kind === 'privacy' ? privacyPage.privacyMeta({ t })
        : kind === 'events' || kind === 'event' ? eventPages.eventsMeta({ t, events, marker }) : pages.pageMeta({ t, catalogue, marker });
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return html
        .replace(`<!--page:${marker}-->`, body)
        .replaceAll('%TITLE%', esc(meta.title))
        .replaceAll('%DESCRIPTION%', esc(meta.description))
        .replaceAll('%OG_IMAGE%', meta.image ?? '/media/logo-tile-480.png')
        .replaceAll('%LANG%', t.lang);
    } },
    configureServer(server) {
      const watched = ['src/content', 'src/templates'].map((d) => path.join(root, d));
      server.watcher.add(watched);
      server.watcher.on('change', (file) => {
        if (watched.some((d) => file.startsWith(d))) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// Every generated catalogue page is its own build input.
function pageInputs() {
  const inputs = { index: path.join(root, 'index.html') };
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') inputs[path.relative(root, full).replace(/\\/g, '/')] = full;
    }
  };
  walk(path.join(root, 'products'));
  walk(path.join(root, 'events'));
  walk(path.join(root, 'privacy-policy'));
  return inputs;
}

export default defineConfig({
  plugins: [renderPages()],
  appType: 'mpa', // an address with no page is a 404 in dev and preview too (as on Netlify), never the home page
  build: {
    target: ['es2020', 'safari14', 'ios14'], // iOS 14+ Safari can run every bundle (no newer syntax slips through)
    cssTarget: ['safari14', 'ios14'],
    chunkSizeWarningLimit: 700, // three.js chunk; budget is 600 KB gzipped (brief §9), it ships ~130 KB
    rollupOptions: { input: pageInputs() },
  },
  server: { host: true },
});
