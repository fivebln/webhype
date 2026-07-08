// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Live-Domain; per Env überschreibbar (Coolify setzt SITE_URL).
const site = process.env.SITE_URL ?? 'https://web-hype.de';

export default defineConfig({
  site,
  output: 'server',
  // Eigenständiger Node-Server für Docker/Coolify (kein Vercel mehr).
  adapter: node({ mode: 'standalone' }),
  integrations: [
    sitemap({
      // noindex-Seiten aus der Sitemap ausschließen (datenschutz, referenzen*, 404, api, og).
      filter: (page) =>
        !page.includes('/api/') &&
        !page.includes('/og/') &&
        !page.includes('/datenschutz') &&
        !page.includes('/referenzen') &&
        !page.includes('/404'),
      changefreq: 'monthly',
      priority: 0.7,
      // Kein globales lastmod=new Date() mehr — das stempelte bei JEDEM Build „heute" auf ALLE URLs
      // (falsches Frische-Signal). Ohne Angabe emittiert @astrojs/sitemap kein irreführendes lastmod.
      serialize(item) {
        if (item.url.includes('/impressum') || item.url.includes('/datenschutz')) {
          item.priority = 0.2;
          // @ts-expect-error EnumChangefreq enum vs. string literal — runtime accepts both
          item.changefreq = 'yearly';
        }
        if (item.url === site || item.url === `${site}/`) {
          item.priority = 1.0;
          // @ts-expect-error EnumChangefreq enum vs. string literal — runtime accepts both
          item.changefreq = 'weekly';
        }
        return item;
      },
    }),
  ],
  vite: {
    // @ts-expect-error Tailwind v4 plugin type uses newer Vite plugin context; runtime is fine
    plugins: [tailwindcss()],
  },
  prefetch: {
    defaultStrategy: 'viewport',
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
