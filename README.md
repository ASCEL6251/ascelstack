# Ascelstack — website (draft 1)

Astro static site for ascelstack.com.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run data     # regenerate src/data/services.json from data/services.csv
```

## Brand
From `ascelstack.com logo and theme.pptx`: Ink `#1D2D3D`, Accent `#5980A6`, Tint `#94BCE3`, Paper `#F2F2F3`.
Logo is "The Layered A" — `public/brand/mark.svg` (light backgrounds), `mark-light.svg` (dark), `public/favicon.svg` (dark tile).
Tokens live in `src/styles/global.css`.

## Structure
- `src/pages/index.astro` — landing: 3D stack hero → business flow → automation → service cards → industries → process → CTA
- `src/scripts/stack-scene.ts` — Three.js Layered A; `src/scripts/motion.ts` — Lenis + GSAP ScrollTrigger
- `src/pages/services/` — full catalogue with search/filter, one page per discipline
- `src/pages/contact.astro` — enquiry form (`?service=ASC-0001` / `?category=slug` prefill). **Not wired to a backend yet.**
- `src/data/catalog.ts` — category metadata (slug, layer, blurb) over the CSV data

## Notes
- The CSV's `category_id` column is off by one on the last row of each category; the site groups by category name instead.
- Anything marked with a dashed `TEMP` tag (email, hours, stats, timelines) is placeholder copy.
# Ascelstack
