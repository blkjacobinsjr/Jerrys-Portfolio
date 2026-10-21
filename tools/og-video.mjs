#!/usr/bin/env node
/**
 * Renders public/og.mp4, the silent looping link-preview reel (og:video; iMessage plays it).
 *
 *   npm run build && npm run og:video
 *
 * Captures the built site frame by frame (so it is deterministic and smooth), then
 * encodes with ffmpeg. The reel: the keyring from the share image (public/og.jpg)
 * gets batted, swings on the site's own pendulum (src/lib/swing.ts) and settles;
 * a few slow beats of the real page follow (hero, work deck, path glide); it ends
 * back on the keyring at rest, which is also the first frame, so the loop is seamless.
 *
 * The baby photo in the locket is pixelated in every frame: each locket image is
 * swapped for a pixelated copy before anything is captured, and the run fails if
 * one is ever visible unswapped.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { step, still } from '../src/lib/swing.ts';

const W = 1200;
const H = 630;
const FPS = 30;
const PORT = 4339;
const ORIGIN = `http://localhost:${PORT}`;
const OUT = 'public/og.mp4';
const BUDGET = 1.5 * 1024 * 1024;
const FADE = 0.3;

// Where the photo sits in src/assets/keys/locket.webp, as fractions of the image.
const PHOTO = { x: 0.6875, y: 0.7367, r: 0.2625, blocks: 8 };

const frames = mkdtempSync(join(tmpdir(), 'og-video-'));
const preview = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore' });

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('astro preview did not start. Run `npm run build` first.');
}

/** Runs in the page: swap every locket image for a pixelated copy, now and whenever one appears. */
function pixelateLockets(photo) {
  const swap = (img) => {
    if (img.dataset.pixelated || !/\/locket\./.test(img.currentSrc || img.src)) return;
    img.loading = 'eager'; // swap it now, long before it could scroll into a frame
    const draw = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const r = photo.r * c.width;
      const x0 = photo.x * c.width - r;
      const y0 = photo.y * c.height - r;
      const tiny = document.createElement('canvas');
      tiny.width = tiny.height = photo.blocks;
      tiny.getContext('2d').drawImage(c, x0, y0, 2 * r, 2 * r, 0, 0, photo.blocks, photo.blocks);
      g.save();
      g.beginPath();
      g.arc(x0 + r, y0 + r, r, 0, Math.PI * 2);
      g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(tiny, 0, 0, photo.blocks, photo.blocks, x0, y0, 2 * r, 2 * r);
      g.restore();
      img.removeAttribute('srcset');
      img.src = c.toDataURL('image/png');
      img.dataset.pixelated = '';
    };
    if (img.complete && img.naturalWidth) draw();
    else img.addEventListener('load', draw, { once: true });
  };
  const scan = () => document.querySelectorAll('img').forEach(swap);
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  addEventListener('DOMContentLoaded', scan);
}

async function assertPixelated(page) {
  const raw = await page.evaluate(() =>
    [...document.querySelectorAll('img')].filter((i) => /\/locket\./.test(i.currentSrc || i.src) && !i.dataset.pixelated).length,
  );
  if (raw) throw new Error(`${raw} locket image(s) not pixelated; refusing to capture`);
}

const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
let index = 0;
async function shoot(page) {
  await assertPixelated(page);
  await page.screenshot({ path: join(frames, `${String(index++).padStart(4, '0')}.png`) });
}

async function newPage(browser, reducedMotion) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion });
  await context.addInitScript(pixelateLockets, PHOTO);
  const page = await context.newPage();
  await page.goto(ORIGIN, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const lockets = [...document.querySelectorAll('img')].filter((i) => /\/locket\./.test(i.currentSrc || i.src) || 'pixelated' in i.dataset);
    return lockets.length > 0 && lockets.every((i) => 'pixelated' in i.dataset);
  });
  return page;
}

/** The share image's stage: the real keyring, alone on warm paper, name and address below. */
async function stage(page) {
  await page.evaluate(() => {
    const ring = document.querySelector('[data-keyring]');
    const stage = document.createElement('div');
    stage.id = 'og-stage';
    stage.innerHTML = '<span class="og-floor"></span><span class="og-name">Jerry Doughan</span><span class="og-url">jerrydoughan.com</span>';
    stage.prepend(ring);
    document.body.append(stage);
    for (const img of ring.querySelectorAll('img')) img.loading = 'eager';
    const css = document.createElement('style');
    css.textContent = `
      html, body { overflow: hidden !important; }
      body > :not(#og-stage) { visibility: hidden !important; }
      #og-stage { position: fixed; inset: 0; z-index: 2147483647; overflow: hidden; color: #1b1a18;
        background: radial-gradient(120% 90% at 50% 20%, #f7f2ec 0%, #f1ebe2 55%, #ebe3d7 100%); }
      #og-stage [data-keyring] { left: 50%; --cord: 50px; scale: 1.28; transform-origin: 0 0; }
      #og-stage .og-floor { position: absolute; left: 50%; top: 516px; width: 320px; height: 26px; translate: -50% 0;
        border-radius: 50%; background: radial-gradient(closest-side, rgb(60 40 20 / 0.16), transparent); filter: blur(6px); }
      #og-stage .og-name { position: absolute; left: 50px; bottom: 54px; font: 500 34px/1 var(--font-sans), system-ui, sans-serif; letter-spacing: -0.02em; }
      #og-stage .og-url { position: absolute; right: 52px; bottom: 58px; font: 400 21px/1 var(--font-sans), system-ui, sans-serif; color: #77706a; }`;
    document.head.append(css);
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#og-stage img')].every((i) => i.complete && i.naturalWidth));
  await page.evaluate(() => document.fonts.ready);
}

/** Bat the keyring once and let the site's pendulum carry it; angles per frame for each piece. */
function swingFrames(parts, seconds) {
  const dt = 1 / FPS;
  const state = parts.map(() => still);
  const out = [];
  for (let f = 0; f < seconds * FPS; f++) {
    const batted = f >= 6 && f < 9; // a quick flick, like a pointer passing through
    const before = state[0].velocity;
    parts.forEach((part, i) => {
      const kick = batted ? (i === 0 ? 48 : -36 * part.sign) : 0;
      const drag = i === 0 ? 0 : (-(state[0].velocity - before) / dt) * 0.5;
      state[i] = step(state[i], kick / part.mass + drag, dt);
    });
    out.push(state.map((s) => s.angle));
  }
  return out;
}

async function keyringSegment(page, seconds, moving) {
  const parts = await page.evaluate(() =>
    [...document.querySelectorAll('#og-stage [data-swing]')].map((el, i) => ({
      rest: Number(el.dataset.rest ?? 0),
      mass: Number(el.dataset.mass ?? 1),
      sign: i === 0 ? 1 : i % 2 ? -1 : 1,
    })),
  );
  const angles = moving ? swingFrames(parts, seconds) : Array.from({ length: seconds * FPS }, () => parts.map(() => 0));
  for (const frame of angles) {
    await page.evaluate(
      ([frame, parts]) =>
        document.querySelectorAll('#og-stage [data-swing]').forEach((el, i) => {
          el.style.rotate = `${parts[i].rest + frame[i] * (180 / Math.PI)}deg`;
        }),
      [frame, parts],
    );
    await shoot(page);
  }
}

/** A slow, eased scroll across part of the live page; the site's own scroll motion does the rest. */
async function scrollSegment(page, from, to, seconds) {
  const n = Math.round(seconds * FPS);
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), from);
  await page.waitForTimeout(1200);
  for (let f = 0; f < n; f++) {
    const y = from + (to - from) * ease(f / (n - 1));
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(30);
    await shoot(page);
  }
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch();
  const segments = [];
  const mark = (seconds) => segments.push(seconds);

  // 1. The keyring, batted, swinging and settling.
  const ring = await newPage(browser, 'reduce'); // the site's own keyring loop stays off; we drive it
  await stage(ring);
  await keyringSegment(ring, 3, true);
  mark(3);

  // 2. A few beats of the real page.
  const site = await newPage(browser, 'no-preference');
  await site.waitForFunction(() => document.documentElement.classList.contains('is-pinned'), null, { timeout: 15_000 });
  const at = await site.evaluate(() => {
    const top = (s) => document.querySelector(s).getBoundingClientRect().top + scrollY;
    return { work: top('#work'), path: top('#path') };
  });
  await scrollSegment(site, 0, H * 0.55, 1.4);
  mark(1.4);
  await scrollSegment(site, at.work + 40, at.work + H * 1.3, 1.4);
  mark(1.4);
  await scrollSegment(site, at.path, at.path + H * 1.4, 1.4);
  mark(1.4);

  // 3. Back to the keyring at rest: the same picture as frame one.
  await keyringSegment(ring, 1, false);
  mark(1);
  await browser.close();

  // Cross-fade between segments with ffmpeg; the loop point needs no fade (rest to rest).
  const inputs = [];
  let start = 0;
  for (const seconds of segments) {
    inputs.push('-framerate', String(FPS), '-start_number', String(start), '-i', join(frames, '%04d.png'));
    start += Math.round(seconds * FPS);
  }
  let filter = '';
  let last = '[0:v]';
  let offset = 0;
  segments.forEach((seconds, i) => {
    filter += `[${i}:v]trim=end_frame=${Math.round(seconds * FPS)},setpts=PTS-STARTPTS,format=yuv420p[s${i}];`;
  });
  last = '[s0]';
  for (let i = 1; i < segments.length; i++) {
    offset += segments[i - 1] - FADE;
    filter += `${last}[s${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[x${i}];`;
    last = `[x${i}]`;
  }
  filter = filter.replace(/;$/, '');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', ...inputs,
    '-filter_complex', filter, '-map', last,
    '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'veryslow', '-crf', '26',
    '-r', String(FPS), '-movflags', '+faststart', OUT,
  ]);

  const size = statSync(OUT).size;
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,width,height,pix_fmt:format=duration', '-of', 'json', OUT]);
  console.log(`${OUT}: ${(size / 1024).toFixed(0)} KB`, JSON.stringify(JSON.parse(probe)));
  if (size > BUDGET) console.warn(`Warning: over the ${BUDGET / 1024} KB budget; raise -crf.`);
}

try {
  await main();
} finally {
  preview.kill();
  rmSync(frames, { recursive: true, force: true });
}
