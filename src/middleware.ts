import { defineMiddleware } from 'astro:middleware';

/**
 * Encoding-Härtung (QA/QM): erzwingt `charset=utf-8` auf jeder HTML-Antwort.
 *
 * Astro/@astrojs/node liefert SSR-HTML teils nur als `text/html` ohne charset aus.
 * Moderne Browser fallen dann auf das <meta charset>-Tag zurück (das vorhanden ist),
 * aber der HTTP-Header hat Vorrang und ist die robustere Quelle — vor allem hinter
 * Proxies/älteren Clients. Diese Middleware schließt die Lücke einheitlich.
 *
 * Reine Härtung: ändert nur den Content-Type-Header von HTML-Antworten, sonst nichts.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const ct = response.headers.get('content-type');
  if (ct && ct.toLowerCase().startsWith('text/html') && !/charset/i.test(ct)) {
    response.headers.set('content-type', 'text/html; charset=utf-8');
  }
  return response;
});
