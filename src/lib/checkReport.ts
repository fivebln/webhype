/**
 * Website-Check — Report-Erzeugung (Urteil, PDF).
 *
 * Gil-Vorgabe 16.08.: Der Report muss auf den ersten Blick verständlich sein („nicht ewig
 * lesen") und als hochwertig gestaltetes PDF an der Mail hängen, das der Kunde behalten
 * und nutzen kann. Der Report soll einladen, nicht erschlagen — und im besten Fall zur
 * Beauftragung führen.
 *
 * Gestaltungs-Prinzip überall gleich: EIN Urteilssatz → drei Zahlen (rot/gelb/grün) →
 * erst danach Details, nach Schwere sortiert. Wer nur drei Sekunden hinschaut, versteht
 * trotzdem, was los ist.
 *
 * PDF: HTML + Chromium-Print (playwright-core). Im Container liegt Chromium unter
 * CHROMIUM_PATH (Dockerfile). Schlägt die Erzeugung fehl, geht die Mail ohne Anhang
 * raus — der Funnel bricht nie am PDF.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { logoSvg } from './brandAssets'
import type { CheckErgebnis, Befund, Stufe } from './websiteCheck'

/* ------------------------------------------------------------------ */
/* Urteil — eine Sprache für Bildschirm, Mail und PDF                  */
/* ------------------------------------------------------------------ */

export type Urteil = {
  ton: 'gut' | 'mittel' | 'kritisch'
  /** Ein Satz, der das Ergebnis trägt. */
  titel: string
  /** Ein Satz Einordnung dahinter. */
  satz: string
}

export function urteil(check: CheckErgebnis): Urteil {
  const b = check.bilanz
  if (b.problem === 0 && b.hinweis <= 1)
    return {
      ton: 'gut',
      titel: 'Deine Website steht technisch gut da.',
      satz: 'Dann geht es bei dir eher um Wirkung und Inhalt als um Reparatur.',
    }
  if (b.problem === 0)
    return {
      ton: 'mittel',
      titel: `${b.hinweis} Punkte haben Luft nach oben.`,
      satz: 'Nichts davon ist dramatisch — aber in Summe kostet es dich Besucher.',
    }
  return {
    ton: 'kritisch',
    titel: b.problem === 1 ? 'Ein Punkt kostet dich gerade Anfragen.' : `${b.problem} Punkte kosten dich gerade Anfragen.`,
    satz: 'Die solltest du zeitnah angehen — sie sind messbar oder rechtlich relevant.',
  }
}

export const STUFEN_WORT: Record<Stufe, string> = {
  ok: 'In Ordnung',
  hinweis: 'Luft nach oben',
  problem: 'Sollte behoben werden',
}

export const STUFEN_FARBE: Record<Stufe, string> = {
  ok: '#12A150',
  hinweis: '#B98900',
  problem: '#D02B20',
}

const RANG: Record<Stufe, number> = { problem: 0, hinweis: 1, ok: 2 }
export const sortiert = (befunde: Befund[]) => [...befunde].sort((a, b) => RANG[a.stufe] - RANG[b.stufe])

const esc = (t: string) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ------------------------------------------------------------------ */
/* Fonts — self-hosted aus node_modules, als data-URL eingebettet      */
/* ------------------------------------------------------------------ */

let fontCssCache: string | null = null

function fontCss(): string {
  if (fontCssCache !== null) return fontCssCache
  const dateien: Array<[string, string, number]> = [
    ['@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff2', 'Geist Sans', 600],
    ['@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff2', 'Geist Sans', 700],
    ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'Inter', 400],
    ['@fontsource/inter/files/inter-latin-600-normal.woff2', 'Inter', 600],
  ]
  const regeln: string[] = []
  for (const [pfad, familie, gewicht] of dateien) {
    try {
      const b64 = readFileSync(join(process.cwd(), 'node_modules', pfad)).toString('base64')
      regeln.push(
        `@font-face{font-family:'${familie}';font-weight:${gewicht};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2')}`,
      )
    } catch {
      /* Font fehlt → Systemschrift, PDF funktioniert trotzdem */
    }
  }
  fontCssCache = regeln.join('\n')
  return fontCssCache
}

/* ------------------------------------------------------------------ */
/* PDF-HTML — A4, webhype-CI                                           */
/* ------------------------------------------------------------------ */

export type ReportDaten = {
  vorname: string
  firma: string
  check: CheckErgebnis
}

export function reportHtml({ vorname, firma, check }: ReportDaten): string {
  const u = urteil(check)
  const befunde = sortiert(check.befunde)
  const b = check.bilanz
  const datum = new Date(check.gemessenAm).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const tonFarbe = u.ton === 'gut' ? '#12A150' : u.ton === 'mittel' ? '#B98900' : '#D02B20'

  const zeile = (f: Befund) => `
    <tr>
      <td class="dot-zelle"><span class="dot" style="background:${STUFEN_FARBE[f.stufe]}"></span></td>
      <td class="befund-zelle">
        <p class="befund-titel">${esc(f.titel)} <span class="befund-status" style="color:${STUFEN_FARBE[f.stufe]}">${STUFEN_WORT[f.stufe]}</span></p>
        <p class="befund-text">${esc(f.text)}</p>
      </td>
    </tr>`

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<style>
${fontCss()}
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { font-family: 'Inter', system-ui, sans-serif; color: #0A0E1A; font-size: 10.5pt; line-height: 1.55; }
h1, h2, h3, .zahl { font-family: 'Geist Sans', 'Inter', sans-serif; }

.seite { width: 210mm; min-height: 297mm; position: relative; padding: 0 18mm 24mm; page-break-after: always; }
.seite:last-child { page-break-after: auto; }

/* Kopf */
.kopfband { background: #0051FD; margin: 0 -18mm; padding: 10mm 18mm 9mm; color: #fff; }
.kopfband .logo-box { background: #FAF9F9; display: inline-block; padding: 3.2mm 5mm; border-radius: 3mm; }
.kopf-titel { font-family: 'Geist Sans'; font-weight: 700; font-size: 21pt; letter-spacing: -0.02em; margin-top: 7mm; }
.kopf-meta { margin-top: 2.5mm; font-size: 9.5pt; color: #C7DCFF; }
.kopf-meta strong { color: #fff; font-weight: 600; }

/* Urteil */
.urteil { margin-top: 9mm; padding: 6mm 7mm; border-left: 1.6mm solid ${tonFarbe}; background: #FAF9F9; border-radius: 0 3mm 3mm 0; }
.urteil h2 { font-size: 14.5pt; font-weight: 700; letter-spacing: -0.01em; }
.urteil p { margin-top: 1.5mm; color: #4A5168; }

/* Bilanz-Chips */
.bilanz { margin-top: 6mm; width: 100%; border-collapse: separate; border-spacing: 4mm 0; margin-left: -4mm; }
.chip { border-radius: 3mm; padding: 4.5mm 5mm; width: 33%; }
.chip .zahl { font-size: 20pt; font-weight: 700; line-height: 1.1; }
.chip .wort { font-size: 8.5pt; font-weight: 600; margin-top: 1mm; }
.chip-problem { background: #FBE9E7; color: #D02B20; }
.chip-hinweis { background: #FFF4D6; color: #8A6800; }
.chip-ok { background: #E3F5EA; color: #0E7A3E; }

/* Befunde */
.abschnitt-titel { font-size: 12.5pt; font-weight: 700; margin: 9mm 0 3mm; letter-spacing: -0.01em; }
table.befunde { width: 100%; border-collapse: collapse; }
.dot-zelle { width: 6mm; vertical-align: top; padding-top: 4.4mm; }
.dot { display: inline-block; width: 2.8mm; height: 2.8mm; border-radius: 50%; }
.befund-zelle { padding: 3.2mm 0; border-bottom: 0.3mm solid #E0E3EC; }
tr:last-child .befund-zelle { border-bottom: none; }
.befund-titel { font-weight: 600; font-size: 10.5pt; }
.befund-status { font-weight: 600; font-size: 8pt; margin-left: 1.5mm; }
.befund-text { color: #4A5168; font-size: 9.5pt; margin-top: 0.8mm; }

/* Grüne Kompaktliste */
.ok-raster { margin-top: 2mm; width: 100%; border-collapse: collapse; }
.ok-raster td { width: 50%; padding: 1.6mm 0; font-size: 9.5pt; color: #1F2433; }
.haken { display: inline-block; width: 3.2mm; height: 3.2mm; margin-right: 1.8mm; vertical-align: -0.3mm; }

/* Nächste Schritte */
.schritt { margin-top: 4mm; }
.schritt .nr { display: inline-block; width: 6.5mm; height: 6.5mm; border-radius: 50%; background: #EAF1FF; color: #0051FD; font-family: 'Geist Sans'; font-weight: 700; font-size: 9.5pt; text-align: center; line-height: 6.5mm; margin-right: 2.5mm; }
.schritt p { display: inline; }
.schritt .s-titel { font-weight: 600; }
.schritt .s-text { color: #4A5168; }

/* Angebots-Box */
.angebot { margin-top: 9mm; background: #0A0E1A; color: #fff; border-radius: 4mm; padding: 7mm 8mm; }
.angebot h3 { font-size: 13pt; font-weight: 700; letter-spacing: -0.01em; }
.angebot p { color: #C7DCFF; margin-top: 2mm; font-size: 9.5pt; }
.angebot .preis { margin-top: 4mm; font-size: 10.5pt; color: #fff; }
.angebot .preis strong { font-family: 'Geist Sans'; font-weight: 700; }
.angebot .cta { display: inline-block; margin-top: 4.5mm; background: #0051FD; color: #fff; font-weight: 600; padding: 3mm 6mm; border-radius: 2.5mm; text-decoration: none; font-size: 10pt; }

/* Fußzeile */
.fuss { position: absolute; bottom: 9mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; font-size: 8pt; color: #8A91A6; border-top: 0.3mm solid #E0E3EC; padding-top: 2.5mm; }
.hinweis { margin-top: 6mm; font-size: 8pt; color: #8A91A6; line-height: 1.5; }
</style></head>
<body>

<div class="seite">
  <div class="kopfband">
    <span class="logo-box">${logoSvg(132)}</span>
    <div class="kopf-titel">Dein Website-Check</div>
    <div class="kopf-meta">für <strong>${esc(firma)}</strong> · geprüft: <strong>${esc(check.endUrl)}</strong> · ${datum}</div>
  </div>

  <div class="urteil">
    <h2>${esc(u.titel)}</h2>
    <p>${esc(u.satz)}</p>
  </div>

  <table class="bilanz"><tr>
    <td class="chip chip-problem"><div class="zahl">${b.problem}</div><div class="wort">${b.problem === 1 ? 'Problem' : 'Probleme'}</div></td>
    <td class="chip chip-hinweis"><div class="zahl">${b.hinweis}</div><div class="wort">mit Luft nach oben</div></td>
    <td class="chip chip-ok"><div class="zahl">${b.ok}</div><div class="wort">in Ordnung</div></td>
  </tr></table>

  ${
    befunde.some((f) => f.stufe !== 'ok')
      ? `<div class="abschnitt-titel">Das haben wir gefunden</div>
         <table class="befunde">${befunde.filter((f) => f.stufe !== 'ok').map(zeile).join('')}</table>`
      : ''
  }

  <div class="abschnitt-titel">Das ist bereits in Ordnung</div>
  <table class="ok-raster">
    ${(() => {
      const oks = befunde.filter((f) => f.stufe === 'ok')
      let rows = ''
      for (let i = 0; i < oks.length; i += 2) {
        rows += `<tr><td><svg class="haken" viewBox="0 0 12 12" fill="none" stroke="#12A150" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6.5 4.8 9.2 10 3"/></svg>${esc(oks[i].titel)}</td><td>${oks[i + 1] ? `<svg class="haken" viewBox="0 0 12 12" fill="none" stroke="#12A150" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6.5 4.8 9.2 10 3"/></svg>${esc(oks[i + 1].titel)}` : ''}</td></tr>`
      }
      return rows
    })()}
  </table>

  <div class="fuss"><span>webhype · Website-Check</span><span>Seite 1 von 2</span></div>
</div>

<div class="seite">
  <div style="height:14mm"></div>
  <div class="abschnitt-titel" style="margin-top:0">Was du jetzt tun kannst</div>
  <div class="schritt"><span class="nr">1</span><p><span class="s-titel">Die roten Punkte zuerst.</span> <span class="s-text">Die kosten dich Besucher oder sind rechtlich heikel — alles andere hat Zeit.</span></p></div>
  <div class="schritt"><span class="nr">2</span><p><span class="s-titel">Einmal selbst mit dem Handy testen.</span> <span class="s-text">Ruf deine Seite unterwegs im Mobilfunknetz auf. Was dich dort stört, stört deine Kunden auch.</span></p></div>
  <div class="schritt"><span class="nr">3</span><p><span class="s-titel">Entscheiden: reparieren oder neu.</span> <span class="s-text">Ab drei roten Punkten ist ein Neubau meist günstiger als Flickwerk — muss aber nicht bei uns sein.</span></p></div>

  <div class="angebot">
    <h3>Wenn du es nicht selbst machen willst: 7 Tage, fester Preis.</h3>
    <p>Ein Gespräch von 30 Minuten, mehr brauchen wir von dir nicht. Wir bauen deine Website neu — individuell, schnell auf dem Handy, mit sauberen Pflichtangaben. Texte schreiben wir, ändern kannst du sie später selbst.</p>
    <p class="preis">Starter <strong>499&nbsp;€</strong> · Business <strong>999&nbsp;€</strong> — einmalig, netto, vorher bekannt.</p>
    <a class="cta" href="https://web-hype.de/kontakt">Erstgespräch anfragen → web-hype.de/kontakt</a>
  </div>

  <p class="hinweis">
    Zur Einordnung: Geprüft wurde die Startseite von ${esc(check.endUrl)} am ${datum}, automatisch und in wenigen
    Sekunden. Dieser Schnellcheck ersetzt keine vollständige Analyse — Inhalt, Aufbau und Wirkung deiner Seite
    schauen wir uns im persönlichen Check an, den du innerhalb von 24 Stunden von uns bekommst. Er ist kostenlos
    und verpflichtet dich zu nichts. Rechtliche Befunde sind Orientierung, keine Rechtsberatung.
  </p>

  <div class="fuss"><span>webhype · Westfälische Str. 46 · 10711 Berlin · web-hype.de</span><span>Seite 2 von 2</span></div>
</div>

</body></html>`
}

/* ------------------------------------------------------------------ */
/* PDF-Erzeugung — Chromium, seriell (eine Instanz zur Zeit)           */
/* ------------------------------------------------------------------ */

function chromiumPfad(): string | null {
  const kandidaten = [process.env.CHROMIUM_PATH, '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean) as string[]
  for (const p of kandidaten) {
    try {
      readFileSync(p, { flag: 'r' })
      return p
    } catch {
      /* nächster Kandidat */
    }
  }
  return null
}

let warteschlange: Promise<unknown> = Promise.resolve()

/** Erzeugt das Report-PDF. `null`, wenn kein Chromium verfügbar oder die Erzeugung scheitert. */
export async function reportPdf(daten: ReportDaten): Promise<Buffer | null> {
  const pfad = chromiumPfad()
  if (!pfad) return null

  const auftrag = async (): Promise<Buffer | null> => {
    let browser: any = null
    try {
      const { chromium } = await import('playwright-core')
      const flags = ['--no-sandbox', '--disable-gpu']
      // Im Docker-Container ist /dev/shm nur 64 MB — dort auf /tmp ausweichen.
      // (Auf claude-vps NIE setzen: /tmp ist dort eine RAM-Disk, CLAUDE.md §11.1.)
      if (process.env.CHROMIUM_IN_DOCKER === '1') flags.push('--disable-dev-shm-usage')
      browser = await chromium.launch({ executablePath: pfad, args: flags })
      const page = await browser.newPage()
      await page.setContent(reportHtml(daten), { waitUntil: 'load', timeout: 15_000 })
      const pdf = await page.pdf({ format: 'A4', printBackground: true, timeout: 15_000 })
      return Buffer.from(pdf)
    } catch (err) {
      console.error('[website-check] PDF-Erzeugung fehlgeschlagen:', err)
      return null
    } finally {
      try {
        await browser?.close()
      } catch {
        /* egal */
      }
    }
  }

  const ergebnis = warteschlange.then(auftrag, auftrag)
  warteschlange = ergebnis.catch(() => {})
  return ergebnis as Promise<Buffer | null>
}
