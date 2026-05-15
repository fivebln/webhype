# Deployment

Die Site ist eine statische Astro-Build (Output: `dist/`). Sie kann auf **jedem** statischen Hoster laufen. Empfohlen für DSGVO-Konformität: Vercel (EU-Region Frankfurt) oder Netlify (EU-Region).

---

## Vercel (1-Klick)

### Variante A — über Git-Repo (empfohlen)

1. Repo zu GitHub/GitLab/Bitbucket pushen.
2. <https://vercel.com/new> → Repo importieren.
3. Vercel erkennt Astro automatisch:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Im Schritt „Configure Project“ unter **Region** → `fra1` (Frankfurt) wählen.
5. Deploy.

### Variante B — über CLI

```bash
npm i -g vercel
vercel login
vercel             # Erste Bereitstellung (Preview)
vercel --prod      # Produktions-Bereitstellung
```

Region per `vercel.json` festlegen (optional, falls aus dem Vercel-UI nicht gewählt):

```json
{
  "regions": ["fra1"]
}
```

### Domain verbinden

Vercel Dashboard → Project → Settings → Domains → `webhype.de` hinzufügen, DNS-Records bei der Registrar-Stelle entsprechend setzen (Vercel zeigt sie an).

---

## Netlify (1-Klick)

### Variante A — über Git-Repo (empfohlen)

1. Repo zu GitHub/GitLab/Bitbucket pushen.
2. <https://app.netlify.com/start> → Repo verbinden.
3. Build-Settings (Netlify erkennt Astro automatisch, sonst manuell):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Im Site-Setup unter „Site configuration → Build & deploy → Build settings → Production branch deploy → Deploy contexts“ die **Build Region** auf `eu-central-1` (Frankfurt) setzen. (Auf Pro-Plans verfügbar; auf Free-Plan baut Netlify global, das ist okay — gehostet wird über das EU-CDN, wenn der Traffic aus der EU kommt.)
5. Deploy.

### Variante B — über CLI

```bash
npm i -g netlify-cli
netlify login
netlify init     # Site initial verbinden
netlify deploy   # Preview-Deploy
netlify deploy --prod
```

### Domain verbinden

Netlify Dashboard → Site → Domain management → `webhype.de` hinzufügen, DNS-Records gemäß Netlify-Vorgabe setzen.

---

## Eigenes Hosting (statisches Verzeichnis)

```bash
npm run build
# alles aus dist/ via SFTP/rsync auf Webspace
rsync -avz --delete dist/ user@server:/var/www/webhype.de/
```

Webserver-Config: jede unbekannte Route auf `404.html` mappen (Astro generiert keine SSR). Für Apache reicht ein Standard-Setup; für nginx:

```nginx
location / {
  try_files $uri $uri/index.html =404;
}
```

---

## Nach dem ersten Deploy

1. **Lighthouse-Audit** (Mobile + Desktop) auf der Live-URL durchführen.
2. **OG-Preview** prüfen unter <https://www.opengraph.xyz/url/https%3A%2F%2Fwebhype.de>.
3. **Plausible-Domain** im Plausible-Dashboard registrieren (`webhype.de`), sonst kommen keine Events an.
4. **Cal.com-Slug** verifizieren (`https://cal.com/webhype/15min` muss real existieren).
5. **Formspree-Endpoint** in `src/components/FinalCTA.astro` durch echten Endpoint ersetzen.
6. **Sitemap** verfügbar prüfen: `https://webhype.de/sitemap-index.xml`.
7. **Google Search Console** → Eigentum bestätigen, Sitemap einreichen.
