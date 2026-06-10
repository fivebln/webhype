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
      filter: (page) => !page.includes('/api/') && !page.includes('/og/'),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
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
