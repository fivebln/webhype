# webhype.de — Source Code

> Astro 5 + Tailwind 4 + Vercel · Source-of-truth for everything that runs in production.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro 5 | Static-first, component islands, optimal Lighthouse |
| Styling | Tailwind 4 (Vite plugin) | CSS-first config matches our token system |
| Adapter | `@astrojs/vercel` | Server output, ISR, image optimization |
| Forms | `/api/contact` → Resend | Native API route, no third-party form vendor lock-in |
| OG Images | `@vercel/og` | Dynamic per-page social cards |
| Sitemap | `@astrojs/sitemap` | Auto-generated on build |
| CMS | Sanity (optional, post-launch) | See `/docs/sanity-integration.md` (TBD) |

## Local Development

```bash
npm install
npm run dev          # → http://localhost:4321
npm run build        # → production build to ./dist
npm run preview      # serve the build locally
npm run lighthouse   # → ./lighthouse-report.html
```

## Project Structure

```
src/
├── components/         # Reusable UI (Logo, Button, PaketCard, ...)
│   ├── Logo.astro      # Renders <use href="#logo-..."> from sprite
│   ├── LogoSprite.astro # Inline SVG <symbol> definitions (once per page)
│   ├── Header.astro
│   ├── Footer.astro
│   └── ...
├── layouts/
│   └── BaseLayout.astro # Meta, OG, JSON-LD, header + footer wrapper
├── lib/
│   └── schema.ts        # JSON-LD helpers (Organization, Service, FAQ, ...)
├── pages/
│   ├── index.astro                 # /
│   ├── pakete.astro                # /pakete
│   ├── prozess.astro               # /prozess
│   ├── ueber.astro                 # /ueber
│   ├── kontakt.astro               # /kontakt
│   ├── impressum.astro
│   ├── datenschutz.astro
│   ├── 404.astro
│   ├── branchen/
│   │   ├── handwerk.astro
│   │   ├── arztpraxis.astro
│   │   └── kanzlei.astro
│   ├── api/
│   │   └── contact.ts              # POST → Resend
│   └── og/
│       └── [slug].png.ts           # Dynamic OG images
├── styles/
│   └── global.css                  # Tailwind 4 + design tokens
└── public/
    ├── robots.txt
    ├── llms.txt
    ├── ai.txt
    └── favicon.svg
```

## Environment Variables

Configure in Vercel project settings (Production + Preview):

| Variable | Example | Required | Purpose |
|---|---|---|---|
| `SITE_URL` | `https://webhype.de` | optional | Used for canonical URLs / sitemap |
| `RESEND_API_KEY` | `re_...` | yes (prod) | Mail delivery |
| `RESEND_FROM` | `webhype <no-reply@webhype.de>` | yes (prod) | Verified sender |
| `CONTACT_INBOX` | `hallo@webhype.de` | yes (prod) | Where internal notifications go |

**Local dev:** copy `.env.example` → `.env.local`.

## Design Tokens

All tokens (colors, typography, spacing, motion) are defined in `src/styles/global.css` inside `@theme { ... }`.

Source-of-truth: [`webhype/01_brand/ci-guide.md`](../01_brand/ci-guide.md) §13.

## Logo

Three inline SVG variants, defined once via `<LogoSprite />` and referenced via `<Logo variant="..." />`:

- `primary` — `.st1` = ink-900 (for light backgrounds)
- `dark` — `.st1` = warm-white (for dark backgrounds)
- `icon` — square `>>` symbol mark only

Source SVGs: [`webhype/01_brand/logo-final/`](../01_brand/logo-final/).

## Performance Budget (hard cap)

| Asset | Budget |
|---|---|
| HTML (initial) | < 15 KB gzip |
| Critical CSS (inline) | < 14 KB |
| JS (initial) | < 70 KB gzip |
| Fonts | < 60 KB (subset WOFF2) |
| Hero image | < 80 KB AVIF |
| **Total initial** | **< 250 KB** |

See [`webhype/00_analyse/`](../00_analyse/) for the full strategy.

## Deployment

Pushes to `main` deploy to production. Every PR creates a Preview URL automatically.

```bash
# First-time setup
vercel link
vercel env pull .env.local
```

## QA Checklist (before merging to main)

- [ ] `npm run build` succeeds
- [ ] Lighthouse: Performance 100, SEO 100, A11y ≥ 95, BP ≥ 95 (mobile + desktop)
- [ ] All forms submit successfully (E2E test: form → Resend → inbox)
- [ ] JSON-LD validates with Google Rich Results Test (0 errors)
- [ ] `axe-core` reports 0 violations
- [ ] All routes return 200 (no broken links)
- [ ] `robots.txt`, `llms.txt`, `ai.txt`, `sitemap-index.xml` accessible

## License

Private. © Gil Miguel Holding UG (haftungsbeschränkt).
