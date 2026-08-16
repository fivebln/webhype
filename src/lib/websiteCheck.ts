/**
 * Website-Schnellcheck — misst eine vom Interessenten angegebene Seite serverseitig.
 *
 * Grundsatz (MARKETING.md §7, UWG §5): Wir zeigen NUR, was wir hier wirklich gemessen
 * haben. Keine hochgerechneten Werte, keine erfundenen Benchmarks, kein Fantasie-Score
 * gegen einen unbelegten Branchendurchschnitt. Jeder Befund nennt, was geprüft wurde.
 *
 * Der Check ersetzt keinen Lighthouse-Lauf und behauptet das auch nicht — er prüft die
 * Dinge, die man an der ausgelieferten Seite ohne Browser zuverlässig sehen kann.
 *
 * Sicherheit: Die URL kommt von außen. Deshalb SSRF-Schutz (nur http/https, keine
 * privaten/lokalen Adressen, Weiterleitungen werden einzeln geprüft), harte Zeit- und
 * Größenlimits.
 */

import { lookup } from 'node:dns/promises'
import net from 'node:net'

const GESAMT_TIMEOUT_MS = 9_000
const EINZEL_TIMEOUT_MS = 6_000
const MAX_BYTES = 2_000_000
const MAX_REDIRECTS = 4
const UA = 'webhype-Website-Check/1.0 (+https://web-hype.de/website-check)'

export type Stufe = 'ok' | 'hinweis' | 'problem'

export type Befund = {
  /** Stabiler Schlüssel — für Auswertung/Mail. */
  schluessel: string
  /** Was geprüft wurde, in Kundensprache. */
  titel: string
  stufe: Stufe
  /** Das Messergebnis in einem Satz, ohne Fachchinesisch. */
  text: string
}

export type CheckErgebnis = {
  ok: true
  gepruefteUrl: string
  endUrl: string
  gemessenAm: string
  befunde: Befund[]
  /** Anzahl Befunde je Stufe — die einzige „Zahl", und sie ist definiert. */
  bilanz: { ok: number; hinweis: number; problem: number }
  ladezeitMs: number
}

export type CheckFehler = {
  ok: false
  grund:
    | 'ungueltige_adresse'
    | 'nicht_erreichbar'
    | 'zeitueberschreitung'
    | 'nicht_erlaubt'
  text: string
}

/* ------------------------------------------------------------------ */
/* URL-Prüfung + SSRF-Schutz                                           */
/* ------------------------------------------------------------------ */

/** Private, lokale und sonst nicht-öffentliche Adressbereiche. */
function istPrivateAdresse(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true // Link-local / Cloud-Metadaten
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT (u. a. Tailscale)
    if (a >= 224) return true // Multicast + reserviert
    return false
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true
    // IPv4-gemappt (::ffff:10.0.0.1) mitprüfen
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (m) return istPrivateAdresse(m[1])
    return false
  }
  return true
}

/** Normalisiert die Eingabe („meine-seite.de" → „https://meine-seite.de"). */
export function normalisiereUrl(roh: string): URL | null {
  const s = (roh || '').trim()
  if (!s) return null
  const mitSchema = /^https?:\/\//i.test(s) ? s : `https://${s}`
  let u: URL
  try {
    u = new URL(mitSchema)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  // Hostname muss wie ein Domainname aussehen (mind. ein Punkt, keine reine IP)
  if (net.isIP(u.hostname)) return null
  if (!/^[a-z0-9äöüß.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null
  u.hash = ''
  return u
}

/**
 * Trennt bewusst drei Fälle: erlaubt · nicht auflösbar (Tippfehler in der Domain) ·
 * private Adresse (SSRF-Versuch). Sonst bekäme jemand, der sich vertippt, die Meldung
 * „Diese Adresse können wir nicht prüfen" — was nach Verbot klingt statt nach Tippfehler.
 */
async function hostErlaubt(hostname: string): Promise<'ok' | 'unbekannt' | 'privat'> {
  let adressen: Array<{ address: string }>
  try {
    adressen = await lookup(hostname, { all: true })
  } catch {
    return 'unbekannt'
  }
  if (!adressen.length) return 'unbekannt'
  return adressen.every((a) => !istPrivateAdresse(a.address)) ? 'ok' : 'privat'
}

/* ------------------------------------------------------------------ */
/* Abruf                                                               */
/* ------------------------------------------------------------------ */

type Antwort = {
  status: number
  endUrl: URL
  headers: Headers
  html: string
  ladezeitMs: number
  weiterleitungen: number
  /** true, wenn irgendwo in der Kette unverschlüsselt (http) gesprochen wurde. */
  unverschluesseltUnterwegs: boolean
}

async function holeSeite(start: URL, deadline: number): Promise<Antwort> {
  let aktuell = start
  let weiterleitungen = 0
  let unverschluesseltUnterwegs = start.protocol === 'http:'
  const begonnen = Date.now()

  for (;;) {
    const erlaubnis = await hostErlaubt(aktuell.hostname)
    if (erlaubnis === 'privat') {
      throw Object.assign(new Error('nicht erlaubt'), { code: 'nicht_erlaubt' })
    }
    if (erlaubnis === 'unbekannt') {
      throw Object.assign(new Error('unbekannter Host'), { code: 'nicht_erreichbar' })
    }

    const rest = Math.min(EINZEL_TIMEOUT_MS, deadline - Date.now())
    if (rest <= 0) throw Object.assign(new Error('timeout'), { code: 'zeitueberschreitung' })

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), rest)
    let res: Response
    try {
      res = await fetch(aktuell.toString(), {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      })
    } catch (e: any) {
      throw Object.assign(new Error('nicht erreichbar'), {
        code: e?.name === 'AbortError' ? 'zeitueberschreitung' : 'nicht_erreichbar',
      })
    } finally {
      clearTimeout(t)
    }

    // Weiterleitung? — jeden Sprung erneut prüfen (SSRF via Redirect)
    if (res.status >= 300 && res.status < 400) {
      const ziel = res.headers.get('location')
      if (!ziel || weiterleitungen >= MAX_REDIRECTS) {
        throw Object.assign(new Error('nicht erreichbar'), { code: 'nicht_erreichbar' })
      }
      let naechste: URL
      try {
        naechste = new URL(ziel, aktuell)
      } catch {
        throw Object.assign(new Error('nicht erreichbar'), { code: 'nicht_erreichbar' })
      }
      if (naechste.protocol !== 'http:' && naechste.protocol !== 'https:') {
        throw Object.assign(new Error('nicht erlaubt'), { code: 'nicht_erlaubt' })
      }
      if (naechste.protocol === 'http:') unverschluesseltUnterwegs = true
      aktuell = naechste
      weiterleitungen++
      continue
    }

    const html = await leseBegrenzt(res)
    return {
      status: res.status,
      endUrl: aktuell,
      headers: res.headers,
      html,
      ladezeitMs: Date.now() - begonnen,
      weiterleitungen,
      unverschluesseltUnterwegs,
    }
  }
}

/** Liest höchstens MAX_BYTES — schützt gegen riesige Antworten. */
async function leseBegrenzt(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const teile: Uint8Array[] = []
  let gesamt = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      teile.push(value)
      gesamt += value.byteLength
      if (gesamt >= MAX_BYTES) {
        try {
          await reader.cancel()
        } catch {
          /* egal */
        }
        break
      }
    }
  }
  const puffer = new Uint8Array(gesamt)
  let pos = 0
  for (const t of teile) {
    puffer.set(t.subarray(0, Math.min(t.length, gesamt - pos)), pos)
    pos += t.length
    if (pos >= gesamt) break
  }
  // Zeichensatz aus dem Header, sonst UTF-8 (Meta-Charset-Sonderfälle sind hier egal,
  // wir suchen nur nach Tags und Schlagwörtern).
  const ct = res.headers.get('content-type') || ''
  const m = ct.match(/charset=([\w-]+)/i)
  const enc = (m?.[1] || 'utf-8').toLowerCase()
  try {
    return new TextDecoder(enc, { fatal: false }).decode(puffer)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(puffer)
  }
}

/** Ein einzelner Nebenabruf (robots.txt/sitemap.xml) — Fehler sind kein Drama. */
async function kopfAbruf(u: string, deadline: number): Promise<{ status: number; text: string } | null> {
  const rest = Math.min(2_500, deadline - Date.now())
  if (rest <= 0) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), rest)
  try {
    const res = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': UA } })
    // Nur die ersten Zeilen interessieren (robots.txt) — nicht die ganze Sitemap laden.
    const text = res.ok ? (await res.text()).slice(0, 4_000) : ''
    return { status: res.status, text }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/* ------------------------------------------------------------------ */
/* Auswertung des HTML                                                 */
/* ------------------------------------------------------------------ */

const entfernen = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s">]+))`, 'i')
  const m = tag.match(re)
  if (!m) return null
  return (m[2] ?? m[3] ?? m[4] ?? '').trim()
}

function alleTags(html: string, tag: string): string[] {
  return html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []
}

const NAMENSENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', sbquo: '‚', lsquo: '‘', rsquo: '’',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  euro: '€', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•',
}

/**
 * Macht aus „Heizung &amp; Sanitär" wieder „Heizung & Sanitär".
 * Ohne das zählen wir Entities als Zeichen mit und melden Titel als „zu lang",
 * die in Wirklichkeit passen — und zeigen dem Interessenten kaputten Text.
 */
function entschluessle(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (ganz, name) => NAMENSENTITIES[name] ?? ganz)
}

/** Bekannte Dienste, die ohne Einwilligung nicht geladen werden dürfen (§9.9 / TTDSG §25). */
const EINWILLIGUNGSPFLICHTIG: Array<{ muster: RegExp; name: string }> = [
  { muster: /googletagmanager\.com|google-analytics\.com|\/gtag\/js/i, name: 'Google Analytics / Tag Manager' },
  { muster: /connect\.facebook\.net|facebook\.com\/tr/i, name: 'Meta-Pixel' },
  { muster: /fonts\.googleapis\.com|fonts\.gstatic\.com/i, name: 'Google Fonts (vom Google-Server)' },
  { muster: /maps\.google\.|maps\.googleapis\.com|google\.com\/maps\/embed/i, name: 'Google Maps' },
  { muster: /youtube\.com\/embed|youtu\.be\//i, name: 'YouTube-Video' },
  { muster: /player\.vimeo\.com/i, name: 'Vimeo-Video' },
  { muster: /hotjar\.com|clarity\.ms/i, name: 'Besucher-Aufzeichnung' },
  { muster: /calendly\.com|cal\.com\/embed/i, name: 'Termin-Widget' },
]

function pruefeHtml(a: Antwort): Befund[] {
  const befunde: Befund[] = []
  const html = a.html
  const ohneCode = entfernen(html)
  const kopf = html.slice(0, 60_000)

  /* --- Erreichbarkeit / Verschlüsselung --- */
  befunde.push({
    schluessel: 'verschluesselung',
    titel: 'Sichere Verbindung',
    stufe: a.endUrl.protocol === 'https:' && !a.unverschluesseltUnterwegs ? 'ok' : 'problem',
    text:
      a.endUrl.protocol === 'https:' && !a.unverschluesseltUnterwegs
        ? 'Die Seite wird verschlüsselt ausgeliefert (https). So gehört es sich.'
        : a.endUrl.protocol === 'https:'
          ? 'Die Seite landet zwar bei https, ein Zwischenschritt lief aber unverschlüsselt. Das sollte direkt weitergeleitet werden.'
          : 'Die Seite läuft unverschlüsselt (http). Browser zeigen Besuchern dafür eine Warnung an.',
  })

  /* --- Tempo --- */
  const ms = a.ladezeitMs
  befunde.push({
    schluessel: 'tempo',
    titel: 'Antwortzeit des Servers',
    stufe: ms < 800 ? 'ok' : ms < 2000 ? 'hinweis' : 'problem',
    text:
      `Der Server hat die Startseite in ${ms} ms geliefert` +
      (a.weiterleitungen ? ` (inklusive ${a.weiterleitungen} Weiterleitung${a.weiterleitungen > 1 ? 'en' : ''})` : '') +
      '. ' +
      (ms < 800
        ? 'Das ist schnell.'
        : ms < 2000
          ? 'Das ist in Ordnung, aber da geht deutlich mehr.'
          : 'Das ist langsam — viele Besucher springen vorher ab.'),
  })

  /* --- Seitengewicht --- */
  const kb = Math.round(new TextEncoder().encode(html).byteLength / 1024)
  const skripte = alleTags(html, 'script').filter((t) => attr(t, 'src')).length
  befunde.push({
    schluessel: 'gewicht',
    titel: 'Umfang der Startseite',
    stufe: kb < 150 && skripte < 12 ? 'ok' : kb < 400 && skripte < 25 ? 'hinweis' : 'problem',
    text: `Die Startseite bringt ${kb} KB Grundgerüst mit und lädt ${skripte} externe Skript${skripte === 1 ? '' : 'e'} nach. ${
      kb < 150 && skripte < 12
        ? 'Schlank.'
        : kb < 400 && skripte < 25
          ? 'Etwas viel, aber noch vertretbar.'
          : 'Das bremst besonders auf dem Handy und im Mobilfunknetz.'
    }`,
  })

  /* --- Mobil --- */
  const viewport = alleTags(kopf, 'meta').find((t) => (attr(t, 'name') || '').toLowerCase() === 'viewport')
  befunde.push({
    schluessel: 'mobil',
    titel: 'Für Handys eingerichtet',
    stufe: viewport ? 'ok' : 'problem',
    text: viewport
      ? 'Die Seite sagt dem Handy, wie sie dargestellt werden soll — die Grundvoraussetzung für mobile Darstellung ist erfüllt.'
      : 'Der Seite fehlt die Angabe für die Handy-Darstellung. Auf dem Smartphone wird sie dadurch meist winzig dargestellt — und über die Hälfte deiner Besucher kommt vom Handy.',
  })

  /* --- Titel --- */
  const titel = entschluessle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
  befunde.push({
    schluessel: 'titel',
    titel: 'Titel bei Google',
    stufe: !titel ? 'problem' : titel.length < 25 || titel.length > 65 ? 'hinweis' : 'ok',
    text: !titel
      ? 'Die Seite hat keinen Titel. Google hat damit nichts, was es im Suchergebnis anzeigen kann.'
      : `Der Titel lautet „${titel.slice(0, 80)}" (${titel.length} Zeichen). ${
          titel.length < 25
            ? 'Das ist sehr kurz — hier verschenkst du die wichtigste Zeile im Suchergebnis.'
            : titel.length > 65
              ? 'Das ist zu lang, Google schneidet im Suchergebnis ab.'
              : 'Gute Länge.'
        }`,
  })

  /* --- Beschreibung --- */
  const beschr = alleTags(kopf, 'meta')
    .filter((t) => (attr(t, 'name') || '').toLowerCase() === 'description')
    .map((t) => entschluessle(attr(t, 'content') || '').replace(/\s+/g, ' ').trim())
    .find(Boolean)
  befunde.push({
    schluessel: 'beschreibung',
    titel: 'Beschreibung im Suchergebnis',
    stufe: !beschr ? 'problem' : beschr.length < 60 || beschr.length > 165 ? 'hinweis' : 'ok',
    text: !beschr
      ? 'Es gibt keine Beschreibung. Google denkt sich dann selbst einen Textausschnitt aus — meist einen schlechten.'
      : `Die Beschreibung ist ${beschr.length} Zeichen lang. ${
          beschr.length < 60
            ? 'Zu kurz, um zu überzeugen.'
            : beschr.length > 165
              ? 'Zu lang, sie wird abgeschnitten.'
              : 'Passende Länge.'
        }`,
  })

  /* --- Überschrift --- */
  const h1 = (ohneCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []).length
  befunde.push({
    schluessel: 'ueberschrift',
    titel: 'Hauptüberschrift',
    stufe: h1 === 1 ? 'ok' : 'hinweis',
    text:
      h1 === 0
        ? 'Die Seite hat keine erkennbare Hauptüberschrift. Für Google und für Screenreader fehlt damit die Antwort auf „worum geht es hier?".'
        : h1 === 1
          ? 'Es gibt genau eine Hauptüberschrift — richtig so.'
          : `Es gibt ${h1} Hauptüberschriften. Eine reicht; mehrere verwässern, worum es auf der Seite geht.`,
  })

  /* --- Bilder ohne Alternativtext --- */
  const bilder = alleTags(html, 'img')
  const ohneAlt = bilder.filter((t) => attr(t, 'alt') === null).length
  if (bilder.length > 0) {
    befunde.push({
      schluessel: 'bilder',
      titel: 'Bilder mit Beschreibung',
      stufe: ohneAlt === 0 ? 'ok' : ohneAlt / bilder.length > 0.3 ? 'problem' : 'hinweis',
      text:
        ohneAlt === 0
          ? `Alle ${bilder.length} Bilder haben einen Alternativtext — gut für Blinde und für Google.`
          : `${ohneAlt} von ${bilder.length} Bildern haben keinen Alternativtext. Blinde Besucher erfahren dort nicht, was zu sehen ist — und seit Juni 2025 ist Barrierefreiheit für viele Anbieter Pflicht.`,
    })
  }

  /* --- Rechtliche Pflichtseiten (DE) --- */
  const linkText = ohneCode.toLowerCase()
  const hatImpressum = /impressum/.test(linkText)
  const hatDatenschutz = /datenschutz|privacy/.test(linkText)
  befunde.push({
    schluessel: 'pflichtseiten',
    titel: 'Impressum und Datenschutz',
    stufe: hatImpressum && hatDatenschutz ? 'ok' : 'problem',
    text:
      hatImpressum && hatDatenschutz
        ? 'Impressum und Datenschutzerklärung sind von der Startseite aus verlinkt.'
        : !hatImpressum && !hatDatenschutz
          ? 'Von der Startseite aus ist weder ein Impressum noch eine Datenschutzerklärung verlinkt. Beides ist in Deutschland Pflicht und wird regelmäßig abgemahnt.'
          : !hatImpressum
            ? 'Ein Impressum ist von der Startseite aus nicht verlinkt. In Deutschland ist es Pflicht und ein beliebter Abmahngrund.'
            : 'Eine Datenschutzerklärung ist von der Startseite aus nicht verlinkt. Pflicht ist sie, sobald überhaupt Daten verarbeitet werden — und das ist praktisch immer der Fall.',
  })

  /* --- Einwilligungspflichtige Drittdienste --- */
  const gefunden = EINWILLIGUNGSPFLICHTIG.filter((d) => d.muster.test(html)).map((d) => d.name)
  const hatBanner = /cookie|einwilligung|consent|zustimm/i.test(kopf) || /cookie|consent/i.test(ohneCode.slice(0, 40_000))
  if (gefunden.length) {
    befunde.push({
      schluessel: 'einwilligung',
      titel: 'Dienste, die eine Einwilligung brauchen',
      stufe: hatBanner ? 'hinweis' : 'problem',
      text: `Die Seite bindet ein: ${gefunden.join(', ')}. ${
        hatBanner
          ? 'Ein Hinweis zur Einwilligung ist erkennbar — ob die Dienste wirklich erst nach dem Klick laden, prüfen wir persönlich für dich.'
          : 'Ein Einwilligungs-Banner ist nicht erkennbar. Ohne aktive Zustimmung vorher dürfen diese Dienste nicht laden (TTDSG §25).'
      }`,
    })
  }

  /* --- Teilen in sozialen Netzen --- */
  const ogBild = alleTags(kopf, 'meta').some((t) => (attr(t, 'property') || '').toLowerCase() === 'og:image')
  befunde.push({
    schluessel: 'teilen',
    titel: 'Vorschaubild beim Teilen',
    stufe: ogBild ? 'ok' : 'hinweis',
    text: ogBild
      ? 'Wird die Seite bei WhatsApp oder LinkedIn geteilt, erscheint ein Vorschaubild.'
      : 'Beim Teilen über WhatsApp oder LinkedIn erscheint kein Vorschaubild — der Link sieht dort nackt aus und wird seltener geklickt.',
  })

  return befunde
}

/* ------------------------------------------------------------------ */
/* Öffentliche Schnittstelle                                           */
/* ------------------------------------------------------------------ */

export async function pruefeWebsite(rohUrl: string): Promise<CheckErgebnis | CheckFehler> {
  const start = normalisiereUrl(rohUrl)
  if (!start) {
    return {
      ok: false,
      grund: 'ungueltige_adresse',
      text: 'Das sieht nicht nach einer Internetadresse aus. Beispiel: meine-firma.de',
    }
  }

  const deadline = Date.now() + GESAMT_TIMEOUT_MS

  let antwort: Antwort
  try {
    antwort = await holeSeite(start, deadline)
  } catch (e: any) {
    const code = e?.code as CheckFehler['grund'] | undefined
    if (code === 'nicht_erlaubt') {
      return { ok: false, grund: 'nicht_erlaubt', text: 'Diese Adresse können wir nicht prüfen.' }
    }
    if (code === 'zeitueberschreitung') {
      return {
        ok: false,
        grund: 'zeitueberschreitung',
        text: 'Die Seite hat zu lange gebraucht. Das kann an ihr liegen — wir schauen sie uns persönlich an.',
      }
    }
    return {
      ok: false,
      grund: 'nicht_erreichbar',
      text: 'Wir konnten die Seite gerade nicht erreichen. Prüf bitte die Schreibweise — oder lass uns persönlich draufschauen.',
    }
  }

  if (antwort.status >= 400) {
    return {
      ok: false,
      grund: 'nicht_erreichbar',
      text: `Die Seite antwortet mit einem Fehler (${antwort.status}). Wir schauen uns das persönlich an.`,
    }
  }

  const befunde = pruefeHtml(antwort)

  // Auffindbarkeit — ein paar billige Nebenabrufe, nur wenn noch Zeit ist.
  // Wichtig: Es gibt drei übliche Orte für die Seitenübersicht. Wer nur /sitemap.xml
  // prüft, meldet bei jeder Astro-Seite fälschlich „keine Sitemap" (sie heißt dort
  // sitemap-index.xml) — das ist uns bei der eigenen Seite aufgefallen.
  const basis = `${antwort.endUrl.protocol}//${antwort.endUrl.host}`
  const [robots, sitemap, sitemapIndex] = await Promise.all([
    kopfAbruf(`${basis}/robots.txt`, deadline),
    kopfAbruf(`${basis}/sitemap.xml`, deadline),
    kopfAbruf(`${basis}/sitemap-index.xml`, deadline),
  ])
  if (robots !== null || sitemap !== null || sitemapIndex !== null) {
    const hatSitemap =
      (sitemap !== null && sitemap.status < 400) ||
      (sitemapIndex !== null && sitemapIndex.status < 400) ||
      (robots !== null && robots.status < 400 && /^\s*sitemap\s*:/im.test(robots.text))
    befunde.push({
      schluessel: 'auffindbarkeit',
      titel: 'Wegweiser für Google',
      stufe: hatSitemap ? 'ok' : 'hinweis',
      text: hatSitemap
        ? 'Es gibt eine Seitenübersicht (Sitemap) — Google findet damit alle Unterseiten zuverlässig.'
        : 'Eine Seitenübersicht (Sitemap) ist unter der üblichen Adresse nicht hinterlegt. Google muss sich dann selbst durchklicken und übersieht dabei häufig Unterseiten.',
    })
  }

  const bilanz = {
    ok: befunde.filter((b) => b.stufe === 'ok').length,
    hinweis: befunde.filter((b) => b.stufe === 'hinweis').length,
    problem: befunde.filter((b) => b.stufe === 'problem').length,
  }

  return {
    ok: true,
    gepruefteUrl: start.toString(),
    endUrl: antwort.endUrl.toString(),
    gemessenAm: new Date().toISOString(),
    befunde,
    bilanz,
    ladezeitMs: antwort.ladezeitMs,
  }
}
