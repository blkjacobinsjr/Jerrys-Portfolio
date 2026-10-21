// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://jerrys-portfolio.vercel.app',
  integrations: [react()],
  build: { inlineStylesheets: 'always' },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-sans',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: {
        variants: [{ src: ['@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' }],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [{ src: ['@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' }],
      },
    },
  ],
});
