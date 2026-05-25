// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.SITE_URL ?? 'https://webhype.de';

export default defineConfig({
  site,
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
    edgeMiddleware: false,
    imageService: true,
    imagesConfig: {
      sizes: [360, 768, 1024, 1440, 1920],
      formats: ['image/avif', 'image/webp'],
    },
    isr: {
      expiration: 60 * 60 * 24, // 24h
      exclude: ['/api/.*'],
    },
  }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/') && !page.includes('/og/'),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        // URLs in the sitemap have a trailing slash (e.g. /impressum/) — match both forms
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
