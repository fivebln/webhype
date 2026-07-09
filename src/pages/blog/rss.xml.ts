import type { APIRoute } from 'astro';
import { getBlogPosts } from '../../lib/marketingBlog';

// SSR: der Feed spiegelt live den Admin-Stand (kein Rebuild pro Beitrag).
export const prerender = false;

const SITE = (import.meta.env.SITE_URL ?? 'https://web-hype.de').replace(/\/+$/, '');

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts(30);
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.titel)}</title>
      <link>${SITE}/blog/${esc(p.slug)}</link>
      <guid isPermaLink="true">${SITE}/blog/${esc(p.slug)}</guid>
${p.veroeffentlichtAm ? `      <pubDate>${new Date(p.veroeffentlichtAm).toUTCString()}</pubDate>\n` : ''}${p.kategorie ? `      <category>${esc(p.kategorie)}</category>\n` : ''}      <description>${esc(p.teaser)}</description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>webhype-Magazin</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Ehrliche Antworten rund um deine Website — von webhype.</description>
    <language>de-DE</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};
