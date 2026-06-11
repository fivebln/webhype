import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

interface ContactPayload {
  anrede: 'herr' | 'frau' | 'divers';
  vorname: string;
  nachname: string;
  company: string;
  email: string;
  phone?: string;
  paket: 'starter' | 'business' | 'unsicher';
  branche?: string;
  bestand: 'neu' | 'ersetzen';
  message: string;
  dsgvo: string | boolean;
  company_url?: string; // honeypot
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const paketLabel: Record<string, string> = {
  starter: 'Starter · 499 €',
  business: 'Business · 999 €',
  unsicher: 'Noch unsicher',
};

const brancheLabel: Record<string, string> = {
  handwerk: 'Handwerk',
  arztpraxis: 'Arztpraxis',
  kanzlei: 'Kanzlei / Beratung',
  anderes: 'Anderes Mittelstands-Geschäft',
  keine_angabe: 'Keine Angabe',
};

const bestandLabel: Record<string, string> = {
  neu: 'Keine Website vorhanden',
  ersetzen: 'Bestehende Website soll ersetzt werden',
};

const anredeLabel: Record<string, string> = {
  herr: 'Herr',
  frau: 'Frau',
  divers: 'Divers',
};

export const POST: APIRoute = async ({ request }) => {
  let data: ContactPayload;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  // Honeypot — silently accept but discard
  if (data.company_url && data.company_url.length > 0) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Required-field validation
  if (!data.anrede || !data.vorname || !data.nachname || !data.email || !data.company || !data.paket || !data.bestand || !data.message || !data.dsgvo) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400 });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const fromAddress = import.meta.env.RESEND_FROM ?? 'webhype <no-reply@webhype.de>';
  const toAddress = import.meta.env.CONTACT_INBOX ?? 'hallo@webhype.de';

  if (!apiKey) {
    console.warn('[contact] RESEND_API_KEY not set — payload received but not delivered:', data);
    return new Response(JSON.stringify({ ok: true, warning: 'mail_not_configured' }), { status: 200 });
  }

  const resend = new Resend(apiKey);
  const safeVorname = escapeHtml(data.vorname);
  const safeNachname = escapeHtml(data.nachname);
  const safeAnrede = anredeLabel[data.anrede] ?? '';
  const safeName = `${safeVorname} ${safeNachname}`.trim();
  const safeCompany = escapeHtml(data.company);
  const safeEmail = escapeHtml(data.email);
  const safePhone = data.phone ? escapeHtml(data.phone) : '';
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br/>');

  const internalHtml = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#0A0E1A;line-height:1.6;max-width:600px;">
      <h1 style="font-family:Geist,Inter,sans-serif;color:#0051FD;font-size:24px;margin-bottom:8px;">Neue webhype-Anfrage</h1>
      <p style="color:#4A5168;margin-bottom:24px;">Eingegangen über das Kontaktformular auf webhype.de/kontakt</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;width:140px;">Anrede</td><td style="padding:10px 0;font-weight:500;">${safeAnrede}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Vorname</td><td style="padding:10px 0;font-weight:500;">${safeVorname}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Nachname</td><td style="padding:10px 0;font-weight:500;">${safeNachname}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Geschäft</td><td style="padding:10px 0;font-weight:500;">${safeCompany}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">E-Mail</td><td style="padding:10px 0;"><a href="mailto:${safeEmail}" style="color:#0051FD;">${safeEmail}</a></td></tr>
        ${safePhone ? `<tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Telefon</td><td style="padding:10px 0;">${safePhone}</td></tr>` : ''}
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Paket</td><td style="padding:10px 0;font-weight:500;">${paketLabel[data.paket] ?? data.paket}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Branche</td><td style="padding:10px 0;">${data.branche ? (brancheLabel[data.branche] ?? data.branche) : '—'}</td></tr>
        <tr style="border-bottom:1px solid #E0E3EC;"><td style="padding:10px 0;color:#4A5168;">Bestand</td><td style="padding:10px 0;">${bestandLabel[data.bestand] ?? data.bestand}</td></tr>
      </table>

      <h2 style="font-family:Geist,Inter,sans-serif;font-size:16px;margin-top:32px;margin-bottom:8px;">Was die Website können soll</h2>
      <div style="background:#FAF9F9;border:1px solid #E0E3EC;border-radius:8px;padding:16px;color:#1F2433;">${safeMessage}</div>

      <p style="color:#8A91A6;font-size:12px;margin-top:32px;">DSGVO-Consent: ✓ erteilt · Eingang: ${new Date().toISOString()}</p>
    </div>
  `;

  const customerHtml = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#0A0E1A;line-height:1.6;max-width:600px;">
      <h1 style="font-family:Geist,Inter,sans-serif;color:#0051FD;font-size:24px;margin-bottom:8px;">Danke, ${safeVorname}!</h1>
      <p>Deine Anfrage ist bei uns angekommen.</p>

      <p style="margin-top:20px;"><strong>Was als Nächstes passiert:</strong></p>
      <ol style="padding-left:20px;color:#4A5168;">
        <li>Wir lesen deine Anfrage spätestens am nächsten Werktag.</li>
        <li>Wir schicken dir <strong>drei Terminvorschläge</strong> für ein kurzes Gespräch (max. 30 Minuten).</li>
        <li>Im Call besprechen wir das passende Paket. Danach startet der 7-Tage-Countdown.</li>
      </ol>

      <div style="background:#EAF1FF;border-left:4px solid #0051FD;padding:16px;border-radius:8px;margin-top:24px;">
        <strong style="color:#0051FD;">Deine Eingaben in Kürze:</strong><br/>
        ${safeCompany} · ${paketLabel[data.paket] ?? data.paket} · ${data.branche ? (brancheLabel[data.branche] ?? data.branche) : 'Branche n.a.'}
      </div>

      <p style="margin-top:28px;color:#4A5168;">Falls du Fragen hast, antworte einfach auf diese Mail.</p>

      <p style="margin-top:36px;font-size:14px;color:#8A91A6;border-top:1px solid #E0E3EC;padding-top:16px;">
        webhype — ein Produkt der Gil Miguel Holding UG (haftungsbeschränkt)<br/>
        Westfälische Str. 46 · 10711 Berlin<br/>
        <a href="https://webhype.de" style="color:#0051FD;">webhype.de</a>
      </p>
    </div>
  `;

  try {
    await Promise.all([
      resend.emails.send({
        from: fromAddress,
        to: toAddress,
        replyTo: data.email,
        subject: `Neue Anfrage: ${data.company} (${paketLabel[data.paket] ?? data.paket})`,
        html: internalHtml,
      }),
      resend.emails.send({
        from: fromAddress,
        to: data.email,
        subject: 'Danke für deine Anfrage – wir melden uns binnen 24 h',
        html: customerHtml,
      }),
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[contact] resend error:', err);
    return new Response(JSON.stringify({ error: 'mail_failed' }), { status: 500 });
  }
};
