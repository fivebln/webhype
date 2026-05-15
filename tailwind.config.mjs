/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F1419',
        surface: '#F5F2EC',
        text: '#0F1419',
        'text-light': '#F5F2EC',
        muted: '#6B6760',
        accent: '#FF5A1F',
        'accent-hover': '#E84800',
        border: '#E5E0D6',
        success: '#2D7A4F',
      },
      fontFamily: {
        sans: [
          'Geist',
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        body: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        // Mobile-first; Desktop-Größen über Utility-Klassen
        'h1-mobile': ['2.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'h1-desktop': ['5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'h2-mobile': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h2-desktop': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'h3-mobile': ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h3-desktop': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        prose: '65ch',
        hero: '1100px',
        content: '1200px',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'accent-underline': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accent-underline': 'accent-underline 1.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
