// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import { existsSync } from 'node:fs';

// Timeless Serif (timeless.co, Timeless Free Font License 1.2): the files are gitignored because section 6 forbids
// putting the fonts in a public repository. Builds without them fall back to metric-matched Times (no CLS).
const TIMELESS = './src/assets/fonts/timeless/';
/** @type {[any, ...any[]]} The local provider wants a non-empty tuple. */
const timelessVariants = [
  { src: [`${TIMELESS}TimelessSerif-Regular.woff2`], weight: '400', style: 'normal' },
  { src: [`${TIMELESS}TimelessSerif-RegularItalic.woff2`], weight: '400', style: 'italic' },
];
const timeless = existsSync(`${TIMELESS}TimelessSerif-RegularItalic.woff2`) && existsSync(`${TIMELESS}TimelessSerif-Regular.woff2`);

export default defineConfig({
  site: 'https://jerrydoughan.com',
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
    {
      // The typewriter face of the /contact letter; loaded on that page only.
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [{ src: ['@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' }],
      },
    },
    ...(timeless
      ? [
          {
            // Display moments only (enter screen, project titles): unmodified woff2, swapped in over a metric-matched fallback.
            provider: fontProviders.local(),
            name: 'Timeless Serif',
            cssVariable: '--font-display',
            fallbacks: ['Georgia', 'serif'],
            display: /** @type {const} */ ('swap'),
            options: {
              variants: timelessVariants,
            },
          },
        ]
      : []),
  ],
});
