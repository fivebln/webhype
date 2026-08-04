import { defineMiddleware } from 'astro:middleware';

/**
 * Middleware der Marketing-Site. Zwei Aufgaben, beide reine Härtung.
 *
 * 1) www. → ohne www. (seit 04.08.2026)
 *    Jede Seite war unter drei Adressen mit HTTP 200 erreichbar: mit Schrägstrich,
 *    ohne, und mit `www.`. Google hat daraus 11 „Alternative Seite mit richtigem
 *    kanonischen Tag" gemacht — kein Fehler, aber verschwendete Crawl-Zeit auf
 *    Duplikaten. Die Kundenseiten (Medau, Studio H, Kropp) leiten längst um, nur
 *    web-hype.de selbst tat es nicht.
 *
 *    ⚠️ Die Schrägstrich-Variante lässt sich hier NICHT lösen: vorgerenderte Seiten
 *    werden vom statischen Handler des Node-Adapters ausgeliefert, bevor diese
 *    Middleware läuft (lokal geprüft — `/pakete` liefert 200 statt 301). Sie bleibt
 *    unkritisch, weil das Canonical korrekt auf die Variante mit Schrägstrich zeigt
 *    und Google sie richtig zuordnet. Wer es beheben will, muss an den Proxy
 *    (Traefik-Regel NUR für diesen Host — global wäre falsch, die Next.js-Seiten
 *    von Studio H und dem CRM arbeiten ohne Schrägstrich).
 *
 * 2) Encoding-Härtung (QA/QM)
 *    Astro/@astrojs/node liefert SSR-HTML teils nur als `text/html` ohne charset aus.
 *    Browser fallen dann auf das <meta charset> zurück, aber der HTTP-Header hat
 *    Vorrang und ist die robustere Quelle — vor allem hinter Proxies/älteren Clients.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // Hinter dem Coolify-Proxy ist url.host die interne Bind-Adresse — der echte Host
  // steht im Header. (Gleicher Fallstrick wie bei den Route-Handler-Redirects, §9.3.)
  const host = (context.request.headers.get('host') ?? '').split(':')[0];

  if (host.startsWith('www.')) {
    const url = new URL(context.request.url);
    return new Response(null, {
      status: 301,
      headers: { Location: `https://${host.slice(4)}${url.pathname}${url.search}` },
    });
  }

  const response = await next();
  const ct = response.headers.get('content-type');
  if (ct && ct.toLowerCase().startsWith('text/html') && !/charset/i.test(ct)) {
    response.headers.set('content-type', 'text/html; charset=utf-8');
  }
  return response;
});
