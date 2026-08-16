/**
 * Website-Check — Kunden-Mail im Newsletter-Standard (Gil-Vorgabe 16.08.).
 *
 * Aufbau wie der Report: Urteil → drei Zahlen → nur die wichtigsten Befunde (max. 3,
 * nie grüne) → Verweis aufs PDF für alles Weitere → ein CTA. Die Mail lädt zum Lesen
 * des Reports ein, sie ersetzt ihn nicht.
 *
 * Technik: Tabellen-Layout + Inline-Styles (Mail-Clients können kein modernes CSS),
 * Wortmarke als Text statt Bild (Bilder sind in Mails oft anfangs blockiert),
 * Breite 600 px, Systemschriften.
 */

import { sortiert, urteil, STUFEN_FARBE, STUFEN_WORT } from './checkReport'
import type { CheckErgebnis } from './websiteCheck'

const esc = (t: string) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Text-Wortmarke — „web" in Ink, „hype" in Markenblau (kein Bild, immer sichtbar). */
const wortmarke = (hell = false) =>
  `<span style="font-family:${FONT};font-weight:800;font-size:26px;letter-spacing:-0.5px;color:${hell ? '#FAF9F9' : '#0A0E1A'};">web<span style="color:${hell ? '#7FB0FF' : '#0051FD'};">hype</span></span>`

export type KundenMailDaten = {
  vorname: string
  firma: string
  check: CheckErgebnis | null
  /** Messung versucht, aber gescheitert — der Grund in Kundensprache. */
  messFehler: string | null
  /** Hängt das PDF an dieser Mail? (steuert den Wortlaut) */
  mitPdf: boolean
}

export function kundenMailHtml({ vorname, firma, check, messFehler, mitPdf }: KundenMailDaten): string {
  const inhalt = check ? mitMessung(vorname, check, mitPdf) : ohneMessung(vorname, messFehler)

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EEF1F7;">
<div style="display:none;max-height:0;overflow:hidden;">Dein Website-Check ist fertig — das Ergebnis in 10 Sekunden.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F7;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Kopf -->
  <tr><td style="padding:0 8px 14px;">${wortmarke()}</td></tr>

  <!-- Karte -->
  <tr><td style="background:#ffffff;border-radius:14px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0051FD;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:32px 36px 8px;">
        ${inhalt}
      </td></tr>
    </table>
  </td></tr>

  <!-- Fuß -->
  <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;color:#8A91A6;line-height:1.6;">
    webhype · Westfälische Str. 46 · 10711 Berlin ·
    <a href="https://web-hype.de" style="color:#0051FD;text-decoration:none;">web-hype.de</a><br>
    Du bekommst diese Mail, weil du auf web-hype.de einen Website-Check für „${esc(firma)}" angefragt hast.
    <a href="https://web-hype.de/impressum" style="color:#8A91A6;">Impressum</a> ·
    <a href="https://web-hype.de/datenschutz" style="color:#8A91A6;">Datenschutz</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

/* ------------------------------------------------------------------ */

function mitMessung(vorname: string, check: CheckErgebnis, mitPdf: boolean): string {
  const u = urteil(check)
  const b = check.bilanz
  const tonFarbe = u.ton === 'gut' ? '#12A150' : u.ton === 'mittel' ? '#B98900' : '#D02B20'
  const wichtig = sortiert(check.befunde).filter((f) => f.stufe !== 'ok').slice(0, 3)

  const chip = (zahl: number, wort: string, bg: string, farbe: string) => `
    <td width="32%" style="background:${bg};border-radius:10px;padding:14px 8px;text-align:center;">
      <div style="font-family:${FONT};font-size:26px;font-weight:800;color:${farbe};line-height:1;">${zahl}</div>
      <div style="font-family:${FONT};font-size:11px;font-weight:600;color:${farbe};margin-top:5px;">${wort}</div>
    </td>`

  return `
    <p style="font-family:${FONT};font-size:14px;color:#4A5168;margin:0 0 6px;">Hallo ${esc(vorname)},</p>
    <h1 style="font-family:${FONT};font-size:24px;line-height:1.25;letter-spacing:-0.3px;color:#0A0E1A;margin:0 0 8px;">
      ${esc(u.titel)}
    </h1>
    <p style="font-family:${FONT};font-size:15px;line-height:1.6;color:#4A5168;margin:0 0 22px;">
      ${esc(u.satz)} Geprüft haben wir <strong style="color:#0A0E1A;">${esc(check.endUrl)}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${chip(b.problem, b.problem === 1 ? 'Problem' : 'Probleme', '#FBE9E7', '#D02B20')}
      <td width="2%"></td>
      ${chip(b.hinweis, 'Luft nach oben', '#FFF4D6', '#8A6800')}
      <td width="2%"></td>
      ${chip(b.ok, 'in Ordnung', '#E3F5EA', '#0E7A3E')}
    </tr></table>

    ${
      wichtig.length
        ? `<p style="font-family:${FONT};font-size:13px;font-weight:700;color:#0A0E1A;margin:26px 0 4px;">Die wichtigsten Punkte:</p>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${wichtig
             .map(
               (f) => `<tr>
                 <td width="18" style="vertical-align:top;padding:10px 0;">
                   <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${STUFEN_FARBE[f.stufe]};"></span>
                 </td>
                 <td style="padding:8px 0;border-bottom:1px solid #EEF1F7;font-family:${FONT};">
                   <span style="font-size:14px;font-weight:600;color:#0A0E1A;">${esc(f.titel)}</span>
                   <span style="font-size:11px;font-weight:600;color:${STUFEN_FARBE[f.stufe]};"> · ${STUFEN_WORT[f.stufe]}</span>
                 </td>
               </tr>`,
             )
             .join('')}
           </table>`
        : `<p style="font-family:${FONT};font-size:14px;color:#4A5168;margin:24px 0 0;">Alle geprüften Punkte sind in Ordnung — Details stehen im Report.</p>`
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr><td style="background:#FAF9F9;border-left:4px solid ${tonFarbe};border-radius:0 10px 10px 0;padding:16px 18px;font-family:${FONT};">
        <span style="font-size:14px;line-height:1.6;color:#1F2433;">
          ${
            mitPdf
              ? '📎 <strong>Der vollständige Report hängt an dieser Mail</strong> — mit jedem Befund, was er bedeutet und was du tun kannst. Zwei Seiten, zum Behalten und Weitergeben.'
              : 'Den vollständigen Report mit jedem Befund bekommst du mit unserer persönlichen Einschätzung.'
          }
        </span>
      </td></tr>
    </table>

    <p style="font-family:${FONT};font-size:15px;line-height:1.6;color:#4A5168;margin:24px 0 0;">
      Innerhalb von <strong style="color:#0A0E1A;">24 Stunden</strong> schauen wir zusätzlich persönlich auf deine Seite
      und schicken dir die drei Punkte, die bei dir am meisten bringen. Ohne Verkaufsgespräch.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 30px;"><tr>
      <td style="background:#0051FD;border-radius:8px;">
        <a href="https://web-hype.de/kontakt" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Lass uns kurz sprechen&nbsp;&nbsp;&rarr;</a>
      </td>
      <td style="padding-left:16px;">
        <a href="https://web-hype.de/referenzen" style="font-family:${FONT};font-size:14px;font-weight:600;color:#0051FD;text-decoration:none;">Echte Kundenbeispiele</a>
      </td>
    </tr></table>`
}

function ohneMessung(vorname: string, messFehler: string | null): string {
  return `
    <p style="font-family:${FONT};font-size:14px;color:#4A5168;margin:0 0 6px;">Hallo ${esc(vorname)},</p>
    <h1 style="font-family:${FONT};font-size:24px;line-height:1.25;letter-spacing:-0.3px;color:#0A0E1A;margin:0 0 8px;">
      Dein Website-Check ist unterwegs.
    </h1>
    <p style="font-family:${FONT};font-size:15px;line-height:1.6;color:#4A5168;margin:0 0 20px;">
      ${
        messFehler
          ? `Automatisch messen konnten wir deine Seite gerade nicht (${esc(messFehler)}) — macht nichts, wir übernehmen das persönlich.`
          : 'Du startest ohne bestehende Website — das ist kein Nachteil. Du musst nichts reparieren, wir fangen direkt richtig an.'
      }
      Innerhalb von <strong style="color:#0A0E1A;">24 Stunden</strong> bekommst du unsere persönliche Einschätzung
      mit den drei Punkten, die bei dir am meisten bringen. Ohne Verkaufsgespräch.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 30px;"><tr>
      <td style="background:#0051FD;border-radius:8px;">
        <a href="https://web-hype.de/pakete" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Pakete &amp; Preise ansehen&nbsp;&nbsp;&rarr;</a>
      </td>
      <td style="padding-left:16px;">
        <a href="https://web-hype.de/referenzen" style="font-family:${FONT};font-size:14px;font-weight:600;color:#0051FD;text-decoration:none;">Echte Kundenbeispiele</a>
      </td>
    </tr></table>`
}
