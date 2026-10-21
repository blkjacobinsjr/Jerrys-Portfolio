// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://jerrys-portfolio.vercel.app',
  integrations: [
    react(),
    {
      name: 'client-afterload',
      hooks: {
        'astro:config:setup': ({ addClientDirective }) =>
          addClientDirective({ name: 'afterload', entrypoint: './src/directives/afterload.ts' }),
      },
    },
  ],
  build: { inlineStylesheets: 'always' },
  vite: {
    // Real targets, not esnext: with esnext, lightningcss folds animation-timeline
    // into the animation shorthand, which browsers reject, silently dropping every
    // scroll-driven animation. Baseline = color-mix() and oklch().
    build: { cssTarget: ['chrome111', 'edge111', 'safari16.4', 'firefox113'] },
  },
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
  ],
});
