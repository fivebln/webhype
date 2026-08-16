/**
 * Website-Check — Anfrage-Funnel mit Sofort-Messung.
 *
 * Ablauf: Der Interessent beantwortet 5 Fragen. Hat er eine Website genannt, messen wir
 * sie hier serverseitig (lib/websiteCheck.ts) und geben das Ergebnis mit der Antwort
 * zurück — er sieht es sofort auf dem Bildschirm. Parallel gehen zwei Mails raus:
 * die Anfrage an info@ und eine Bestätigung mit denselben Befunden an ihn.
 *
 * Der persönliche Check binnen 24 h wird in der Mail versprochen — das ist Handarbeit
 * und bleibt es. Die Sofort-Messung ersetzt ihn nicht, sie macht den Einstieg konkret.
 *
 * Encoding (§5): Antworten via JSON.stringify + charset im Header — kein roher Body.
 */

import type { APIRoute } from 'astro'
import nodemailer from 'nodemailer'
import { pruefeWebsite, normalisiereUrl, type CheckErgebnis, type Befund } from '../../lib/websiteCheck'
import { reportPdf, urteil } from '../../lib/checkReport'
import { kundenMailHtml } from '../../lib/checkMail'

export const prerender = false

type Payload = {
  branche?: string
  bestand?: 'ja' | 'nein'
  url?: string
  ziel?: string
  zeithorizont?: string
  anrede?: 'herr' | 'frau' | 'divers'
  vorname?: string
  nachname?: string
  firma?: string
  email?: string
  telefon?: string
  dsgvo?: boolean | string
  company_url?: string // Honeypot
}

const brancheLabel: Record<string, string> = {
  handwerk: 'Handwerk',
  arztpraxis: 'Arzt- oder Zahnarztpraxis',
  kanzlei: 'Kanzlei oder Steuerberatung',
  gastronomie: 'Gastronomie',
  einzelhandel: 'Einzelhandel',
  beauty_fitness: 'Beauty oder Fitness',
  immobilien: 'Immobilien',
  beratung: 'Beratung oder Coaching',
  anderes: 'Anderes Geschäft',
}

const zielLabel: Record<string, string> = {
  anfragen: 'Mehr Anfragen und Anrufe',
  gefunden: 'Bei Google gefunden werden',
  vertrauen: 'Seriöser wirken, Vertrauen aufbauen',
  mitarbeiter: 'Mitarbeiter finden',
  entlastung: 'Weniger Rückfragen, mehr Selbstbedienung',
}

const zeitLabel: Record<string, string> = {
  sofort: 'So schnell wie möglich',
  wochen: 'In den nächsten Wochen',
  quartal: 'In den nächsten Monaten',
  offen: 'Noch offen, erst mal informieren',
}

const anredeLabel: Record<string, string> = { herr: 'Herr', frau: 'Frau', divers: 'Divers' }

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

/* --- einfache Missbrauchsbremse (ein Container, In-Memory reicht) --- */
const zugriffe = new Map<string, number[]>()
const FENSTER_MS = 10 * 60_000
const MAX_PRO_FENSTER = 6

function zuVieleAnfragen(ip: string): boolean {
  const jetzt = Date.now()
  const liste = (zugriffe.get(ip) || []).filter((t) => jetzt - t < FENSTER_MS)
  liste.push(jetzt)
  zugriffe.set(ip, liste)
  if (zugriffe.size > 5000) zugriffe.clear() // simpler Überlaufschutz
  return liste.length > MAX_PRO_FENSTER
}

const stufenWort: Record<Befund['stufe'], string> = {
  ok: 'In Ordnung',
  hinweis: 'Luft nach oben',
  problem: 'Sollte behoben werden',
}
const stufenFarbe: Record<Befund['stufe'], string> = {
  ok: '#12A150',
  hinweis: '#B98900',
  problem: '#D02B20',
}

function befundeAlsHtml(check: CheckErgebnis): string {
  return check.befunde
    .map(
      (b) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #E0E3EC;vertical-align:top;width:22px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${stufenFarbe[b.stufe]};"></span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #E0E3EC;">
          <strong style="color:#0A0E1A;">${esc(b.titel)}</strong>
          <span style="color:${stufenFarbe[b.stufe]};font-size:12px;"> · ${stufenWort[b.stufe]}</span><br/>
          <span style="color:#4A5168;font-size:14px;">${esc(b.text)}</span>
        </td>
      </tr>`,
    )
    .join('')
}

function befundeAlsText(check: CheckErgebnis): string {
  return check.befunde.map((b) => `- [${stufenWort[b.stufe]}] ${b.titel}: ${b.text}`).join('\n')
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let data: Payload
  try {
    data = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // Honeypot — stillschweigend annehmen, nichts tun.
  if (data.company_url) return json({ ok: true, check: null }, 200)

  if (
    !data.branche ||
    !data.bestand ||
    !data.ziel ||
    !data.zeithorizont ||
    !data.anrede ||
    !data.vorname ||
    !data.nachname ||
    !data.firma ||
    !data.email ||
    !data.dsgvo
  ) {
    return json({ error: 'missing_fields' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return json({ error: 'invalid_email' }, 400)

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unbekannt'
  if (zuVieleAnfragen(ip)) return json({ error: 'zu_viele_anfragen' }, 429)

  /* --- Messung (nur wenn eine Adresse genannt wurde) --- */
  let check: Awaited<ReturnType<typeof pruefeWebsite>> | null = null
  if (data.bestand === 'ja' && data.url && normalisiereUrl(data.url)) {
    try {
      check = await pruefeWebsite(data.url)
    } catch (err) {
      console.error('[website-check] Messung fehlgeschlagen:', err)
      check = null
    }
  }

  /* --- Mails --- */
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER_INFO || 'info@web-hype.de'
  const pass = process.env.SMTP_PASS_INFO
  const empfaenger = process.env.CONTACT_INBOX || 'info@web-hype.de'

  const gemessen = check && check.ok ? check : null
  const messFehler = check && !check.ok ? check.text : null

  if (!host || !pass) {
    console.warn(
      '[website-check] SMTP nicht konfiguriert — Anfrage empfangen, aber nicht zugestellt:',
      JSON.stringify({ firma: data.firma, email: data.email, url: data.url }),
    )
    return json({ ok: true, check, pdf: false, warning: 'mail_not_configured' }, 200)
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const name = `${data.vorname} ${data.nachname}`
  const brancheTxt = brancheLabel[data.branche] ?? data.branche
  const zielTxt = zielLabel[data.ziel] ?? data.ziel
  const zeitTxt = zeitLabel[data.zeithorizont] ?? data.zeithorizont
  const seiteTxt = data.bestand === 'ja' ? data.url || '(keine Adresse angegeben)' : 'Noch keine Website vorhanden'

  const internHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0A0E1A;line-height:1.6;max-width:640px;">
      <h1 style="color:#0051FD;font-size:22px;margin-bottom:4px;">Neuer Website-Check</h1>
      <p style="color:#4A5168;margin-top:0;">Über den Funnel auf web-hype.de/website-check</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;width:150px;">Name</td><td style="padding:9px 0;font-weight:500;">${esc(anredeLabel[data.anrede] ?? '')} ${esc(name)}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Geschäft</td><td style="padding:9px 0;font-weight:500;">${esc(data.firma)}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">E-Mail</td><td style="padding:9px 0;"><a href="mailto:${esc(data.email)}" style="color:#0051FD;">${esc(data.email)}</a></td></tr>
        ${data.telefon ? `<tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Telefon</td><td style="padding:9px 0;">${esc(data.telefon)}</td></tr>` : ''}
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Branche</td><td style="padding:9px 0;">${esc(brancheTxt)}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Bestehende Seite</td><td style="padding:9px 0;">${esc(seiteTxt)}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Hauptziel</td><td style="padding:9px 0;">${esc(zielTxt)}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:9px 0;color:#4A5168;">Zeithorizont</td><td style="padding:9px 0;"><strong>${esc(zeitTxt)}</strong></td></tr>
      </table>
      ${
        gemessen
          ? `<h2 style="font-size:16px;margin-top:28px;">Automatische Messung (${gemessen.bilanz.problem} Problem(e), ${gemessen.bilanz.hinweis} Hinweis(e), ${gemessen.bilanz.ok} in Ordnung)</h2>
             <table style="width:100%;border-collapse:collapse;">${befundeAlsHtml(gemessen)}</table>`
          : messFehler
            ? `<p style="margin-top:24px;color:#D02B20;"><strong>Messung nicht möglich:</strong> ${esc(messFehler)}</p>`
            : '<p style="margin-top:24px;color:#4A5168;">Keine Messung (noch keine Website).</p>'
      }
      <p style="margin-top:28px;padding:14px;background:#EAF1FF;border-left:4px solid #0051FD;border-radius:6px;">
        <strong>Zugesagt:</strong> persönlicher Check binnen 24 Stunden.
      </p>
    </div>`

  const internText =
    `Neuer Website-Check (web-hype.de/website-check)\n\n` +
    `Name: ${anredeLabel[data.anrede] ?? ''} ${name}\nGeschäft: ${data.firma}\nE-Mail: ${data.email}\n` +
    `${data.telefon ? `Telefon: ${data.telefon}\n` : ''}Branche: ${brancheTxt}\n` +
    `Bestehende Seite: ${seiteTxt}\nHauptziel: ${zielTxt}\nZeithorizont: ${zeitTxt}\n\n` +
    (gemessen
      ? `Messung:\n${befundeAlsText(gemessen)}\n`
      : messFehler
        ? `Messung nicht möglich: ${messFehler}\n`
        : 'Keine Messung (noch keine Website).\n') +
    `\nZugesagt: persönlicher Check binnen 24 Stunden.`

  // PDF-Report erzeugen (nur bei erfolgreicher Messung; Scheitern bricht nichts).
  const pdf = gemessen ? await reportPdf({ vorname: data.vorname, firma: data.firma, check: gemessen }) : null

  const kundeHtml = kundenMailHtml({
    vorname: data.vorname,
    firma: data.firma,
    check: gemessen,
    messFehler,
    mitPdf: !!pdf,
  })

  try {
    await Promise.all([
      transporter.sendMail({
        from: `webhype <${user}>`,
        to: empfaenger,
        replyTo: data.email,
        subject: `Website-Check: ${data.firma} (${zeitTxt})`,
        text: internText,
        html: internHtml,
      }),
      transporter.sendMail({
        from: `webhype <${user}>`,
        to: data.email,
        subject: gemessen ? `Dein Website-Check: ${urteil(gemessen).titel.replace(/\.$/, '')}` : 'Dein Website-Check ist unterwegs',
        html: kundeHtml,
        attachments: pdf
          ? [{ filename: 'website-check-webhype.pdf', content: pdf, contentType: 'application/pdf' }]
          : [],
      }),
    ])
  } catch (err) {
    console.error('[website-check] SMTP-Fehler:', err)
    // Die Messung ist trotzdem gelaufen — der Interessent soll sie sehen.
    return json({ ok: true, check, pdf: false, warning: 'mail_failed' }, 200)
  }

  return json({ ok: true, check, pdf: !!pdf }, 200)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
