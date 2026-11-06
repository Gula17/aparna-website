# Aparna website: milestone M1 (home-page experience)

Scenes 0 to 3 from the brief (`Aparna Website Build Pack (Nov 2026)/.../00_START_HERE_Website_Brief.md`):

0. **Intro:** the diya lights, the silver ring draws, the emblem shrinks onto the fan's hub and three blades unfold. First visit only, real progress, never more than 2.5 s.
1. **Hero:** a real-time 3D Aeroflow BLDC fan (Wood Craft) under "Powerful Breeze, Peaceful Life." Hover, drag or press-and-hold to spin it faster; a 1 to 5 regulator; four finish swatches.
2. **BLDC story:** the room fades to charcoal, the fan tilts to show its underside, six callouts, then the three BLDC models.
3. **Ek naam, poori range:** nine category stations (horizontal on desktop, stacked cards on mobile), each with a real photo, a live model count from the data and a small "moment", then the full category grid.

### Premium layer (added on top of M1)

- **3D loading screen:** the diya emblem, the Aparna wordmark and a live percentage (fonts, hero image, the 3D fan and its shaders, page images). When three.js arrives the emblem becomes the hub of the real spinning fan, seen from below; at 100% the camera pulls back into the hero. Scrolling, a key or "Skip intro" ends it at once.
- **Hero:** larger fan, soft self-shadows and stronger metal reflections on desktop-class machines, and a subtle camera drift that follows the mouse.
- **Scroll story:** the blades speed up while you scroll; on desktop the fan travels to the right of the story cards, turns to new angles per step, and lifts away at the end.
- **Product cards:** float gently, tilt towards the pointer with a moving glare, photo zoom on hover. Clicking opens a quick view: a **360° viewer** (drag or arrow keys, four finishes) for the Aeroflow, the only model with a 3D model, and a close-up lens on the poster for the others. Each has verified specs, features, "Share on WhatsApp" and the catalogue download.
- **Text and sections:** headings rise in word by word as they scroll in, paragraphs fade up, buttons get a sheen and lift, links draw an underline, the range section slides over the dark section on a rounded edge.
- Phones and small GPUs get a lighter render (no shadows, lower resolution). Reduced motion turns all of it off and shows the still image.

### The full catalogue (milestone M2)

All **201** showable products from `aparna-products.json`, in **10** categories, each with its own page:

| URL | What it is |
|---|---|
| `/products/` | Every product: search, filters (category, series, type, size, colour, new), sorting. Filters live in the URL, so a filtered view can be shared. |
| `/products/<category>/` | One category, e.g. `/products/air-coolers/` |
| `/products/<category>/<model>/` | One product: image gallery (swipe, arrows, thumbnails, close-up lens), colour picker, verified specs, features, related models, Save, Share on WhatsApp, catalogue download. The Aeroflow also gets the 360° viewer, and its colour picker changes the 3D finish. |
| `/my-list/` | The visitor's saved models (with the colour they chose), to show at their shop or send on WhatsApp. Stored on their own device. |

Where the pictures come from (`src/content/product-images.json`): each model's own poster and photos, plus a crop of that model from its Catalogue 2026 page, checked by eye one by one. Models with no picture yet (mostly the 2026 newcomers) show a clear "Photo coming soon" placeholder, never another product's photo.

Specs: only verified ones, and also not the ones a product's notes say must be confirmed first (Aerosleek and Ikon BLDC RPM, GoAir RPM and wattage). There is no model-number field in the data yet, so pages say "To be confirmed"; add numbers and descriptions in `src/content/product-overrides.json`.

`node scripts/check-catalogue.mjs` (after a build) compares the website with the product data and clicks through every product page in a browser. See "Checks" below.

### Showroom catalogue (redesign, phase 1)

`/products/` and every category page are a product showroom rather than a printed catalogue:

- **Dark showroom header.** On `/products/`, one lit stage per category; on a category page, its spotlight product shown large, lifting away as you scroll.
- **Product cutouts.** `npm run cutouts` removes the background from each product's own first image (on-device model, `@imgly/background-removal-node`), drops stray printed text and logos, and saves transparent WebP files. The product pixels are the original photo; nothing is generated. Event photos of whole rows of products keep a framed photo. A cutout that looks wrong can be turned off in `src/content/cutouts.json`.
- **Per-product motion (2.5D).** Each kind of product moves in its own way: ceiling fans hang and sway with air rings below, table/wall/pedestal fans turn like an oscillating head, coolers turn slowly with cool mist, heaters and cooktops glow with rising heat, irons glide with steam, the washing machine rumbles. On hover the product steps forward and turns towards the cursor, light sweeps across it (masked to its own shape) and its shadow moves. Only cards on screen animate.
- **No sidebar.** A sticky glass bar holds search, filter dropdowns (category, series, type, size, colour, new launches) and sorting. On phones the filters open as a bottom drawer.
- **Turning blades.** `npm run rotors` splits a fan's cutout into still parts (stand, guard ring, hub and logo), the blade area, and turns only the blade area, in the fan's own plane: a circle for face-on fans (fitted to the guard), an ellipse worked out from the blade tips for a ceiling fan seen from below. A still part inside the blade area (a stand neck) is filled behind with the same fan's own blade pixels from one blade-step round, so no gap travels with the blades. Marks live in `src/content/rotors.json`. 22 fans turn: every face-on table, wall, pedestal, high-speed and cabin fan with a clean cutout, plus IKON BLDC. Fans photographed at an angle and the close-up ceiling-fan shots were tried and left out: their perspective tears the blades apart.
- **Real-time 3D models** (360° viewer on the product page, home quick view and the /products/ showcase): 154 products, every product that has a usable picture. Each is modelled in code from that product's own posters and catalogue picture; sides the pictures don't show follow the visible design. Files: `src/three/aeroflow-model.js`, `bldc-models.js` (Aerosleek, IKON BLDC), `ceiling-fans.js` (61 ceiling fans with the data's colours: the colour picker repaints the model and starts on the colour in the picture), `front-fans.js` (table, wall, pedestal, high-speed, all-purpose, fresh-air and ventilation fans), `coolers.js` (Pearl, Discovery, Ultima), `appliances.js` (hot plates, cooktops, heaters, water heaters, irons, the Cabin Fan). The product-to-model list is `src/three/models.js`. Not modelled: the 45 products with no picture, the washing machine and the commercial coolers (event photos only).
- **Honest 3D.** Everything else is depth effects on real photos, and nothing is generated or redrawn.

### Showroom phase 2: product pages and featured showcase

- **Product pages** open on a dark showroom panel: the gallery leads with the real-time 3D model (Aeroflow), then the product on its animated stage, then every original picture with a close-up lens. Name, colours, Save / WhatsApp / catalogue and "where to buy" sit beside it. Below: verified specs as large numbers that count up, the full spec table, features and related models.
- **Featured showcase** on `/products/` (between the showroom and the grid): Aeroflow and Vistara (real 3D, blades turning), Discovery 1201 and Prime. Each rises in, turns and settles as you scroll, then lifts away; the light behind them changes colour with the product. Pick the four in `FEATURED` in `src/templates/catalogue.js`.
- Files: `src/styles/product.css`, `src/scenes/showcase.js`.

## Run it

```bash
npm install
npm run content   # reads the build pack, writes product counts + optimised images
npm run cutouts   # cuts each product out of its photo (first run ~30 min on CPU, then only new ones)
npm run rotors    # splits marked fans into still and turning layers (seconds)
npm run dev       # http://localhost:5173
npm run build     # production build in dist/, then checks the hard rules
```

Useful URL options: `?no3d` shows the still-image fallback; `?force3d` forces 3D on a low-end device.

Other scripts:
- `npm run still` renders the 3D fan to `public/media/fan-still.png` (the hero's first paint and the no-3D fallback). Re-run after changing the model.
- `npm run shots` screenshots every scene at 360×800 and 1440×900 into `screenshots/`. `USE_BUILD=1` runs it against `dist/`.
- `node scripts/check-interactions.mjs` (after a build) walks through the loader, card hover, 360° viewer, drag, Esc-to-close and a poster quick view, and reports console errors.

## Where things live

| Folder / file | What it is |
|---|---|
| `src/content/en.json` | Every word on the page. Hindi/Marathi files go beside it later. |
| `src/content/images.json` | Which pack image is used where, with alt text. Swap a file here, run `npm run content`. |
| `src/content/range.generated.json` | Made by `npm run content` from `aparna-products.json`. Never edit by hand. |
| `src/styles/showroom.css` | Catalogue showroom: stages, per-product motion, filter bar, product cards. |
| `src/scenes/showroom.js` | Showroom motion: pointer depth, scroll depth, GSAP scroll reveals. |
| `src/content/cutouts.json` | Cutouts turned off by eye (product ids). |
| `src/content/rotors.json` | Fans whose blades turn, with their hub, blade area and still parts. |
| `src/styles/tokens.css` | Brand colours (copied from the pack) and type. |
| `src/templates/` | The page HTML, rendered at build time so it works with JavaScript off. |
| `src/three/` | The 3D fan: `aeroflow-model.js` (geometry, finishes), `fan-scene.js` (camera, lights, airflow, speed). |
| `src/scenes/` | Motion: `loader.js` (intro), `fan-journey.js` (scroll-driven fan), `range.js` (parade), `products.js` (cards, quick view, 360° viewer), `reveal.js` (text animations). |
| `src/three/models.js` | Which product ids have a 3D model (and so get the 360° viewer). |
| `scripts/` | Content prep, still render, screenshots, build check. |

## Rules the build enforces (`scripts/check-build.mjs`)

- No `₹`, `Rs`, `MRP`, price, offer, EMI, discount or "buy" words in any built file.
- No product with status `confirm`, no Bliss or Alpha water heater, nothing from `unverified_from_sheet`.
- `noindex` on every page (plus `robots.txt` and an `X-Robots-Tag` header for Netlify and Vercel).
- JS size reported against the budget (initial ~71 KB gzipped of 200; 3D chunk ~132 KB of 600).

## Decisions worth knowing

- **Vite + plain JavaScript, three.js and GSAP** instead of Next.js + React Three Fiber. M1 is one page; this keeps the initial JS small (about a quarter of the budget) and the code easy to follow. The templates are plain functions, so moving to Astro for M2's generated product pages is straightforward.
- **Native scrolling and CSS `position: sticky`** for the pinned sections instead of Lenis or JS pinning. More reliable on iOS Safari, never traps scroll, works with the keyboard.
- **Procedural fan (brief §8 option b).** No Blender model in the pack. Exactly three blades are built in code (`BLADE_COUNT = 3`) and turned by real rotation, capped at 1.4 turns a second so blades never strobe or ghost.
- **No shop features.** There is no price, cart, checkout, "Buy now" or quantity selector, by design: the client brief (§2, §3) says Aparna sells only through its dealers, the site must never sell or show a rupee figure, and the product data has no prices. In their place: **My list** (a wishlist that can be shown at a shop or sent on WhatsApp), Share on WhatsApp, the catalogue download and "ask at your nearest electrical shop". If Aparna ever decides to sell online, the product ids and saved-list structure are ready to build on.
- **Colour photos.** No product has a separate photo per colour yet, so choosing a colour updates the label (and the 3D model's finish for the Aeroflow) but never swaps in a picture that doesn't show that colour. When colour photos arrive, tag them in `product-images.json` and the gallery jumps to them.
- **Motion instead of Framer Motion.** Framer Motion needs React; `motion` is the same team's framework-free version (same animation engine), so it fits this plain-JS site without a rewrite. three.js is used directly rather than through React Three Fiber for the same reason.
- **No ceiling shadow.** A soft blade shadow on the ceiling was tried; seen from below it reads as a second, ghost fan, which the brief forbids. Shadows stay on the fan itself.
- **3D turns off** for reduced motion, `deviceMemory <= 2`, `hardwareConcurrency <= 4` (as the brief asks; note this also excludes some 4-core laptops and phones) and no WebGL 2.
