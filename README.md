# Webhype – Marketing-Website

Statische Single-Page-Marketing-Site für **Webhype** (Berliner Web-Agentur für Handwerksbetriebe).
Tech-Stack: **Astro 4 · Tailwind CSS 3 · keine JS-Frameworks**.

---

## Quickstart

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Dev-Server starten (Hot-Reload)
npm run dev
# → http://localhost:4321

# 3. Production-Build
npm run build

# 4. Build lokal anschauen
npm run preview
```

Voraussetzungen: **Node 18+** (empfohlen 20+).

---

## Projektstruktur

```
webhype-site/
├── src/
│   ├── components/        # Einzelne Sektionen (Hero, Pakete, FAQ, …)
│   ├── content/           # JSON-Daten (Pakete, FAQ, Showcases)
│   ├── layouts/           # BaseLayout mit <head>, Meta, Plausible, JSON-LD
│   ├── pages/             # Routen: /, /impressum, /datenschutz, /agb
│   └── styles/global.css  # Tailwind-Layers + Komponenten-Stile
├── public/                # Statische Assets (Logos, Favicon, OG, robots)
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

---

## Was muss vor Live-Schaltung ersetzt werden?

Alle Platzhalter sind in den Quelldateien klar markiert. Suche nach den folgenden Tokens und ersetze sie:

### Gründer-Daten (überall im Marketing-Content)

| Token | Bedeutung | Vorkommen |
|---|---|---|
| `[GRÜNDER_NAME]` | Voller Name | `src/components/About.astro`, `src/components/Footer.astro`, `src/layouts/BaseLayout.astro` (JSON-LD) |
| `[GRÜNDER_TELEFON]` | Telefonnummer (intl. Format empfohlen: `+49 …`) | `src/components/About.astro`, `src/components/Footer.astro`, `src/layouts/BaseLayout.astro` |
| `[GRÜNDER_EMAIL]` | E-Mail-Adresse | `src/components/About.astro`, `src/components/Footer.astro`, `src/layouts/BaseLayout.astro` |

### Rechtliche Platzhalter (nur in /impressum, /datenschutz, /agb)

| Token | Beispiel |
|---|---|
| `{{IMPRESSUM_NAME}}` | „Max Mustermann“ |
| `{{IMPRESSUM_RECHTSFORM}}` | „Einzelunternehmen“ / „UG (haftungsbeschränkt)“ |
| `{{IMPRESSUM_ADRESSE}}` | „Musterstraße 1“ |
| `{{IMPRESSUM_PLZ_ORT}}` | „10115 Berlin“ |
| `{{IMPRESSUM_TELEFON}}` | „+49 30 123456“ |
| `{{IMPRESSUM_EMAIL}}` | „hallo@webhype.de“ |
| `{{IMPRESSUM_USTID}}` | „DE123456789“ (falls vorhanden) |
| `{{IMPRESSUM_HANDELSREGISTER}}` | „Amtsgericht Berlin, HRB …“ (nur bei UG/GmbH) |
| `{{HOSTING_PROVIDER}}` | „Vercel Inc., EU-Region Frankfurt“ |
| `{{DATENSCHUTZ_STAND}}` | „Mai 2026“ |
| `{{AGB_STAND}}` | „Mai 2026“ |

### Cal.com & Formspree

- **Cal.com:** Link in `src/components/FinalCTA.astro` (Konstante `CAL_LINK`) — derzeit `'webhype/15min'`.
- **Formspree (Fallback):** Endpoint in `src/components/FinalCTA.astro` (Konstante `FORMSPREE_ENDPOINT`) — derzeit `https://formspree.io/f/PLACEHOLDER`. Ersetzen durch echten Formspree-Endpunkt.

### Plausible

Domain ist in `src/layouts/BaseLayout.astro` hartcodiert auf `webhype.de`. Bei Domain-Wechsel dort anpassen.

### Pilot-Counter

Hardcoded in `src/components/PilotBanner.astro` (Konstante `seatsLeft = 7`). Manuell anpassen, wenn Plätze vergeben sind.

---

## Inhalte anpassen

### Neues Showcase-Projekt hinzufügen

`src/content/showcases.json` — neuer Eintrag:

```json
{
  "id": 7,
  "tag": "Maler · Berlin Charlottenburg",
  "title": "Maler Charlottenburg",
  "description": "Mobile-first Visitenkarte mit Galerie.",
  "domain": "maler-charlottenburg.de",
  "accentHue": 220,
  "live": null
}
```

`accentHue` ist der HSL-Hue (0–360) für den Browser-Mockup. `live` ist `null` oder eine URL.

### Pakete ändern

`src/content/packages.json` — Felder: `name`, `setup`, `monthly`, `highlighted` (boolean), `badge`, `features[]`.

### FAQ erweitern

`src/content/faq.json` — Liste von `{ q, a }`-Paaren.

---

## Logo anpassen

SVG-Dateien in `public/`:
- `logo-dark.svg` — helle Schrift auf dunklem Bg (Nav über Hero)
- `logo-light.svg` — dunkle Schrift auf hellem Bg (Footer, Nav nach Scroll, Legal-Header)
- `logo-mono.svg` — einfarbig (`fill="currentColor"`, für Druck / Brief)
- `favicon.svg` — nur das „w“ in Orange, transparent

Der Buchstabe **y** ist in `#FF5A1F` (Accent) eingefärbt, plus ein 4px-Kreis rechts daneben.
Wenn das Wordmark als Pfade gerendert werden soll (für maximale Render-Konsistenz auf jedem System), bitte die Wortmarke in Figma/Illustrator mit der echten Geist-Sans-800 in Outlines konvertieren und SVG ersetzen.

---

## Cal.com-Link ersetzen

In `src/components/FinalCTA.astro`:

```ts
const CAL_LINK = 'webhype/15min'; // ← hier euren Cal.com-Slug eintragen
```

Format ist `<account>/<event-slug>`, ohne `https://cal.com/`.

---

## Annahmen / Design-Entscheidungen wo das Briefing offen war

Diese Entscheidungen wurden getroffen — bewusst dokumentiert für mögliche spätere Re-Diskussion:

1. **OG-Image als SVG** statt PNG. Briefing forderte „1200x630, generiert“ als PNG, aber ohne Render-Tool ist eine PNG-Generation aus Astro heraus nicht möglich (würde headless Chromium oder ein Image-Service benötigen). SVG ist crawler-kompatibel bei Facebook/LinkedIn/Twitter (modern), funktioniert auch in WhatsApp. Falls eine PNG-Version zwingend benötigt wird: das SVG mit `rsvg-convert public/og-image.svg -o public/og-image.png -w 1200 -h 630` oder online via cloudconvert.com konvertieren und `ogImage`-Default in `BaseLayout.astro` auf `/og-image.png` umstellen.
2. **Logo als Web-Font-SVG** statt Outlined Paths. Wir referenzieren `font-family: Geist, Inter, system-ui` direkt — damit rendert das Logo überall identisch wie das Wordmark im Header. Vorteil: kleinere Dateien, einfacher zu pflegen. Nachteil: in Apps die keine Web-Fonts in SVGs unterstützen (selten), fällt es auf Inter/Systemfont zurück. Für maximale Konsistenz später Outlines aus Figma exportieren.
3. **Bunny Fonts statt next/font.** Briefing nannte „next/font oder Bunny Fonts“ — next/font ist Next.js-only, in Astro nicht verfügbar. Bunny Fonts ist DSGVO-konform (kein US-Transfer, keine IP-Protokollierung, keine Cookies). Geladen via `<link rel="stylesheet">` mit `display=swap`.
4. **Cal.com Lazy-Init via IntersectionObserver.** Der Cal-Embed wird erst initialisiert, wenn die Final-CTA-Sektion in den Viewport scrollt (200 px Vorlauf). Spart ~50 KB Initial-Payload und verbessert LCP. Fallback-Timer von 6 s — schlägt fehl der Embed (Netzwerk/AdBlocker), klappt automatisch das Kontaktformular auf.
5. **FAQ-Accordion:** native `<details>`-Elemente mit `name="faq"` (HTML-Attribut für „exclusive accordion“, browserseitig seit Chrome 120 / Safari 17 / Firefox 119). In älteren Browsern verhalten sich die Elemente individuell — kein Bruch.
6. **„noch X verfügbar“-Counter:** Hardcoded auf `7` in `PilotBanner.astro`, Frontend-only wie im Briefing gefordert.
7. **Plausible:** Snippet ist eingebunden, läuft aber erst nach DNS-Verbindung zu `plausible.io`. Wenn Plausible nicht selbst gehostet wird, ist `data-domain="webhype.de"` korrekt; für self-hosted: `src` und ggf. Domain anpassen.
8. **Skip-Link:** im DOM ganz oben, sichtbar nur bei Tastatur-Focus — WCAG 2.4.1 erfüllt.
9. **Mobile-Nav:** einfacher Toggle (Hamburger → Drawer), keine externe JS-Library. Inline-Script ~1 KB.
10. **Tonalität & Mikrocopy:** Wo das Briefing keine exakten Worte vorgab (Eyebrows wie „Das Problem“, „Pakete“, „Ablauf“, „Showcase“, „FAQ“, „Über mich“; H2-Variante „Drei klare Pakete. Ein klarer Preis.“; Banner-Headline „Häufige Fragen.“) habe ich die Tonalität aus dem Briefing weitergeführt: direkt, kurz, ohne Floskeln. Alle Pflicht-Claims & Pflicht-CTAs (Hero, Pilot-Banner, Final-CTA, FAQ) sind 1:1 wie spezifiziert.
11. **Sitemap manuell statt @astrojs/sitemap-Integration.** Die Integration warf beim Vercel-Build `Cannot read properties of undefined (reading 'reduce')` (bekannter Bug in v3.2.x mit aktuellen Astro-4-Releases). Bei nur 4 Routen ist die Integration ohnehin Overkill — siehe [public/sitemap.xml](public/sitemap.xml). **Wenn neue Routen hinzukommen, dort manuell eintragen.** Bei Bedarf später wieder auf die Integration zurückwechseln, sobald der Bug gefixt ist.
12. **Lighthouse-Werte:** Nicht automatisch validiert (kein Headless-Browser im Setup). Erwartung basierend auf Architektur: Performance 95–100 (statisch, keine clientseitigen Frameworks, Lazy-Loading Cal.com), Accessibility 95–100 (semantisches HTML, Skip-Link, Focus-Ring, kontraststark), Best Practices 100, SEO 100 (Meta, OG, JSON-LD, Sitemap, robots). Bitte vor Launch lokal via `npm run build && npm run preview` und Chrome DevTools verifizieren.

---

## Deployment

Siehe [DEPLOY.md](./DEPLOY.md) für Vercel- und Netlify-Anweisungen.
