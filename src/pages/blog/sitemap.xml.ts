import type { APIRoute } from 'astro';
import { getBlogPosts } from '../../lib/marketingBlog';

/**
 * Eigene Blog-Sitemap: `@astrojs/sitemap` läuft zur Build-Zeit und kennt die SSR-Blog-Slugs
 * (aus dem CMS) nicht. Dieser Endpoint listet /blog + alle veröffentlichten Beiträge live.
 * In `public/robots.txt` als zweite `Sitemap:`-Zeile referenziert.
 */
export const prerender = false;

const SITE = (import.meta.env.SITE_URL ?? 'https://web-hype.de').replace(/\/+$/, '');

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const iso = (d?: string) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10);
};

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts(200);
  const urls = [
    { loc: `${SITE}/blog`, lastmod: posts[0]?.veroeffentlichtAm },
    ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.updatedAt ?? p.veroeffentlichtAm })),
  ];

  const body = urls
    .map((u) => {
      const lm = iso(u.lastmod);
      return `  <url><loc>${esc(u.loc)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};
