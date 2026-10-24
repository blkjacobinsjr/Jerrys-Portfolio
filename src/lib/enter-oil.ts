// The enter screen's oil lens: transitive-bullshit/apple-music-effect (vendored, unmodified) rendering Jerry's name
// and the 'Enter with sound' label. This file is only the adapter: rasterize the DOM text, fit it with the repo's
// own fitLogo, size a canvas so the logo lands exactly on the text, play the repo's film, crossfade back to the DOM.
// Desktop with a fine pointer and motion allowed only; anything that fails leaves the plain text showing.
import { fitLogo } from '../vendor/apple-music-effect/src/brand';
import { Engine } from '../vendor/apple-music-effect/src/engine';
import { APPLE_MUSIC, type Film } from '../vendor/apple-music-effect/src/scene';

const WORDMARK = APPLE_MUSIC.shots[1]!;
/** the wordmark slot's box in world units (brand.ts SLOTS.wordmark), and the frame is 2 units tall */
const SLOT = { w: 1.09, h: 0.34, cy: 0.01 };

type Raster = { url: string; rect: DOMRect };

/** Draws `parts` (text elements inside `box`) to a transparent canvas with their computed fonts, at 3x. */
function raster(box: Element, parts: Element[]): Raster {
  const rect = box.getBoundingClientRect();
  const s = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(rect.width * s);
  canvas.height = Math.ceil(rect.height * s);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  for (const el of parts) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const text = (el.textContent ?? '').trim();
    const shown = cs.textTransform === 'uppercase' ? text.toUpperCase() : text;
    const m = ctx.measureText(shown);
    // Baseline from the line box: half-leading above the font's ascent.
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    const y = r.top - rect.top + (lh - (asc + desc)) / 2 + asc;
    ctx.fillText(shown, r.left - rect.left, y);
  }
  return { url: canvas.toDataURL(), rect };
}

/** Visible bounds of a raster, as a page rect. */
async function visible({ url, rect }: Raster) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3]! >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const k = rect.width / c.width;
  return { x: rect.left + x0 * k, y: rect.top + y0 * k, w: (x1 + 1 - x0) * k, h: (y1 + 1 - y0) * k };
}

type Player = { play(from: number): Promise<void>; dispose(): void };

/**
 * A canvas positioned so the film's wordmark sits exactly on the element's text. `film` is the repo's film with
 * our logos; playback renders t from `from` to the film's end at 2 subframes and stops.
 */
async function player(host: HTMLElement, box: Element, parts: Element[], kind: 'name' | 'label', icon?: string): Promise<Player> {
  const r = raster(box, parts);
  const v = await visible(r);
  const aspect = v.w / v.h;
  const units = Math.min(SLOT.w, SLOT.h * aspect); // the visible width in world units, as fitLogo fits it
  const ppu = v.w / units; // CSS px per world unit
  const H = 2 * ppu, W = H * APPLE_MUSIC.aspect;
  const hostRect = host.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.className = `enter-oil enter-oil-${kind}`;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    left: `${v.x + v.w / 2 - W / 2 - hostRect.left}px`,
    top: `${v.y + v.h / 2 + SLOT.cy * ppu - H / 2 - hostRect.top}px`,
    width: `${W}px`,
    height: `${H}px`,
  });
  const shots = [{ ...WORDMARK, logo: await fitLogo('wordmark', r.url, 'alpha') }];
  if (icon) shots.unshift({ ...APPLE_MUSIC.shots[0]!, logo: await fitLogo('icon', icon, 'alpha') });
  const film: Film = { ...APPLE_MUSIC, shots };
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let scale = 1;
  const engine = await Engine.create(canvas, film, { width: W * dpr, height: H * dpr });
  host.append(canvas);
  let raf = 0;
  return {
    play(from) {
      cancelAnimationFrame(raf);
      return new Promise((done) => {
        const t0 = performance.now();
        let slow = 0;
        const tick = (now: number) => {
          const t = from + (now - t0) / 1000;
          const t1 = performance.now();
          engine.render(Math.min(t, film.duration - 1e-3), { subframes: scale < 1 ? 1 : 2 });
          // Frame budget: two slow frames drop the resolution once (as the repo's player adapts).
          if (performance.now() - t1 > 22 && ++slow === 2 && scale === 1) {
            scale = 0.6;
            engine.resize(W * dpr * scale, H * dpr * scale);
          }
          // Once the visitor has chosen, stop rendering: the click's sounds and the leave own the main thread.
          if (t < film.duration && document.documentElement.dataset.enter === 'open') raf = requestAnimationFrame(tick);
          else done();
        };
        raf = requestAnimationFrame(tick);
      });
    },
    dispose() {
      cancelAnimationFrame(raf);
      engine.dispose();
      canvas.remove();
    },
  };
}

/** A 'J' for the film's first shot (the app-tile lens), in the title's own font. */
function monogram(el: Element) {
  const cs = getComputedStyle(el);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.font = `${cs.fontWeight} 400px ${cs.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((el.textContent ?? 'J').trim()[0] ?? 'J', 256, 270);
  return c.toDataURL();
}

/** Boots the effect on the gate. Returns false (and changes nothing) if WebGL2 float targets are missing. */
export async function startEnterOil(gate: HTMLElement): Promise<boolean> {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe?.getExtension('EXT_color_buffer_float')) return false;
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  await document.fonts.ready;
  const root = document.documentElement;
  const title = gate.querySelector<HTMLElement>('.enter-title')!;
  const first = title.querySelector('.enter-first')!;
  const last = title.querySelector('.enter-last')!;
  const button = gate.querySelector<HTMLElement>('.enter-go')!;
  const label = button.querySelector('.enter-go-label') ?? button;

  // If the 3 s fallback already showed the plain name, don't hide it again: only the label gets the lens.
  if (root.dataset.enterOil === 'wait') {
    const name = await player(gate, title, [first, last], 'name', monogram(first));
    root.dataset.enterOil = 'name';
    await name.play(0);
    root.dataset.enterOil = 'settled';
    setTimeout(() => name.dispose(), 600);
  }

  // The label: the wordmark shot on hover or keyboard focus, never more than once per run.
  let label$: Promise<Player> | undefined;
  let running = false;
  const run = async () => {
    if (running || root.dataset.enter !== 'open') return;
    running = true;
    label$ ??= player(gate, button, [label], 'label');
    const p = await label$;
    button.dataset.oil = 'on';
    await p.play(WORDMARK.start);
    button.dataset.oil = '';
    setTimeout(() => (running = false), 400);
  };
  button.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && void run());
  button.addEventListener('focus', () => button.matches(':focus-visible') && void run());
  return true;
}
