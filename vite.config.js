import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

// Loads a template module: through Vite in dev (so edits show up without a restart), directly in a build.
const load = (ctx, file) => (ctx.server ? ctx.server.ssrLoadModule(file) : import(pathToFileURL(path.join(root, file)).href));

// Renders every page from the copy + product data into its HTML, so each page is complete before any
// JavaScript runs (works with JS off, and search engines see real content).
//   index.html             <!--app-->              the home page
//   products/**, my-list/  <!--page:kind:key-->    catalogue pages (shells written by npm run content)
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
        return html
          .replace('<!--app-->', renderHome({ t, range, emblemSvg }))
          .replaceAll('%TITLE%', t.meta.title)
          .replaceAll('%DESCRIPTION%', t.meta.description)
          .replaceAll('%LANG%', t.lang);
      }

      const marker = html.match(/<!--page:([^>]+)-->/)?.[1];
      if (!marker) return html;
      const catalogue = readJson('src/content/catalogue.generated.json');
      const colours = readJson('src/content/colours.json');
      // Product cutouts (npm run cutouts). Optional: without them every product shows its normal photo.
      const cutouts = fs.existsSync(path.join(root, 'src/content/cutouts.generated.json')) ? readJson('src/content/cutouts.generated.json').products : {};
      // Fans with turning blades (npm run rotors): their cutout is drawn as still and turning layers.
      if (fs.existsSync(path.join(root, 'src/content/rotors.generated.json'))) {
        for (const [id, rotor] of Object.entries(readJson('src/content/rotors.generated.json').products)) if (cutouts[id]) cutouts[id] = { ...cutouts[id], rotor };
      }
      const pages = await load(ctx, '/src/templates/catalogue.js');
      const [kind, key] = marker.split(':');
      const body = {
        catalogue: () => pages.renderCatalogue({ t, range, catalogue, colours, cutouts }),
        category: () => pages.renderCatalogue({ t, range, catalogue, colours, cutouts, categorySlug: key }),
        product: () => pages.renderProduct({ t, range, catalogue, colours, cutouts, id: key }),
        list: () => pages.renderList({ t, range, catalogue, cutouts }),
      }[kind]();
      const meta = pages.pageMeta({ t, catalogue, marker });
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
  walk(path.join(root, 'my-list'));
  return inputs;
}

export default defineConfig({
  plugins: [renderPages()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700, // three.js chunk; budget is 600 KB gzipped (brief §9), it ships ~130 KB
    rollupOptions: { input: pageInputs() },
  },
  server: { host: true },
});
