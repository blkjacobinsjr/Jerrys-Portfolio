#!/usr/bin/env node
/**
 * Renders src/assets/lanyard/leapfrog-poster.webp, the still /consultancy paints first.
 *
 *   npm run build && node tools/consultancy-poster.mjs
 *
 * It is the lanyard's own first WebGL frame (components/Lanyard.tsx, at rest, before any physics step), taken from
 * the built page with animation frames frozen. The stage is sized to the aspect where the camera stops being
 * limited by height and starts being limited by width (card width / 0.72 over card height / size), so
 * `object-fit: contain` in any stage reproduces the canvas framing. Rebuild it after changing the badge textures,
 * the card, `size` or `strapLength` in pages/consultancy.astro.
 */
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PORT = 4338;
const ORIGIN = `http://localhost:${PORT}`;
const OUT = new URL('../src/assets/lanyard/leapfrog-poster.webp', import.meta.url).pathname;
const SIZE = 0.62; // `size` in pages/consultancy.astro
const ASPECT = 1.6 / 0.72 / (2.25 / SIZE); // card width / 0.72 over card height / size
const HEIGHT = 784;

const preview = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) break;
    } catch {}
    if (i > 100) throw new Error('astro preview did not start. Run `npm run build` first.');
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 2 });
  // Nothing after the first frame: no physics step, no breeze.
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto(`${ORIGIN}/consultancy`);
  await page.addStyleTag({
    content: `html,body,.badge-stage{background:transparent!important}.badge-poster{display:none!important}`,
  });
  await page.locator('.model-loader[data-model-state="ready"]').waitFor({ timeout: 30000 });
  // The live stage is the box above the Flip row: size the page so that box is HEIGHT tall.
  const controls = await page.locator('.lanyard .model-controls').evaluate((el) => el.offsetHeight);
  await page.addStyleTag({
    content: `.badge-stage{width:${Math.round(HEIGHT * ASPECT)}px!important;height:${HEIGHT + controls}px!important;margin:0!important}`,
  });
  await page.waitForTimeout(500);
  const png = await page.locator('.lanyard-stage canvas').screenshot({ omitBackground: true });
  await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
  await browser.close();
} finally {
  preview.kill();
  // `astro preview` detaches; stop the daemon it left behind.
  spawnSync('npx', ['astro', 'preview', 'stop'], { stdio: 'ignore' });
}
