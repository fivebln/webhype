import type { APIRoute } from 'astro';
import { ImageResponse } from '@vercel/og';

export const prerender = false;

interface OgConfig {
  title: string;
  subtitle: string;
}

const ogContent: Record<string, OgConfig> = {
  default: { title: '7 Tage. Festpreis. Punkt.', subtitle: 'Website in einer Woche · 499 € oder 999 €' },
  index: { title: '7 Tage. Festpreis. Punkt.', subtitle: 'Website in einer Woche · 499 € oder 999 €' },
  pakete: { title: '499 € oder 999 €', subtitle: 'Festpreis. Kein Abo. Keine Stunden.' },
  prozess: { title: '30 Min Briefing. 7 Tage Live.', subtitle: 'So einfach läuft es ab.' },
  'branche-handwerk': { title: 'Website für Handwerker', subtitle: '7 Tage · Festpreis · Mobile-First' },
  'branche-arztpraxis': { title: 'Praxis-Website · DSGVO-konform', subtitle: '7 Tage · Festpreis · vertrauenswürdig' },
  'branche-kanzlei': { title: 'Kanzlei mit Lighthouse 100', subtitle: 'Festpreis · 7 Tage · Conversion-stark' },
  ueber: { title: 'Hinter webhype steht ein Mensch.', subtitle: 'Direkt. Klar. Keine Funnel-Tricks.' },
  kontakt: { title: 'In 30 Minuten gebrieft.', subtitle: 'Schreib uns. Wir antworten heute.' },
};

export const GET: APIRoute = async ({ params }) => {
  const slug = (params.slug ?? 'default') as string;
  const cfg = ogContent[slug] ?? ogContent.default;

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #00102F 0%, #001D63 50%, #002E96 100%)',
          color: '#FFFFFF',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: 16 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#00D4FF',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    },
                    children: 'webhype',
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: 24 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 88,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      letterSpacing: '-0.02em',
                    },
                    children: cfg.title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 28, color: '#C7DCFF', lineHeight: 1.4 },
                    children: cfg.subtitle,
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 20,
                color: '#C7DCFF',
              },
              children: [
                { type: 'div', props: { children: 'webhype.de' } },
                { type: 'div', props: { style: { color: '#00D4FF' }, children: 'Lighthouse 100' } },
              ],
            },
          },
        ],
      },
    } as any,
    { width: 1200, height: 630 },
  );
};
