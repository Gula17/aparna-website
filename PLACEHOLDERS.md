# Placeholders still in the site

Everything below is waiting on Gage Labs or Aparna (brief §13). Each one is easy to find and change.

| What | Where it shows | Placeholder used | Where to change it |
|---|---|---|---|
| Legal company name | Footer | `© [Company name]` | `src/content/en.json` → `footer.copyright` |
| "Made in India" | Footer | `Made in India [to confirm]` | `src/content/en.json` → `footer.madeIn` |
| Social media links | Footer icons | `#` links | `src/templates/home.js` → `footer()` |
| Model numbers | Every product page, "Model number" row | "To be confirmed" | `src/content/product-overrides.json` → `{ "<product id>": { "modelNumber": "..." } }` |
| Product descriptions | Every product page | One plain sentence built from the data (type, size, series) | `src/content/product-overrides.json` → `description` |
| Photos for 44 products | Their cards and pages | "Photo coming soon" placeholder (the diya emblem) | Add the files to the pack and list them in `src/content/product-images.json`, then `npm run content` |
| Per-colour photos | Colour picker on product pages | Colour name changes; the photo stays (it is the model, not a colour) | Tag colour photos in `product-images.json` |
| Specs held back by the data's notes | Aerosleek, Ikon BLDC (RPM); GoAir AC-DC 12" and 16" (RPM, wattage) | Row left out | Remove the rule in `scripts/catalogue-data.mjs` → `SPEC_HOLDS` once Aparna confirms |
| Updated catalogue (dated 28-10-2026) | Header, hero, closing band | Catalogue 2026 PDF, served as `/downloads/aparna-catalogue.pdf` | Replace the PDF in the pack (or point `prepare-content.mjs` at the new one) and run `npm run content` |
| Washing machine models | Range station 6, end card | "New launch · Models coming soon" | Comes from the product JSON automatically when models are added |
| Signature Series / Aerosleek / Ikon BLDC colours | BLDC model cards | Colour row hidden when the data has none | Product JSON |
| Aerosleek and Ikon BLDC RPM | Not shown | RPM left off all three BLDC cards (catalogue says 405, May sheet says 380) | `scripts/prepare-content.mjs` → `bldc` mapping, once Aparna confirms |
| Per-model studio photos | BLDC cards use Aparna's posters; range stations use Utsav '26 display photos; irons use a catalogue page | — | `src/content/images.json`, then `npm run content` |
| Founding line, trust numbers | Not used yet (Scene 5 is milestone M3) | — | — |
| Hindi and Marathi | — | English only; all copy is in one file with stable keys | Add `src/content/hi.json` / `mr.json` beside `en.json` |
