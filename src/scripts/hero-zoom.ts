/**
 * t141 hero zoom (preview). One fixed 16:10 copy of the laptop screen is mapped every scroll frame between
 * "full-bleed" (covering the viewport) and the laptop's perspective quad in desk.webp with a matrix3d, so the
 * hand-off lands on the drawn screen exactly. CSS keyframes can't do this: matrix3d interpolates by
 * decomposition, which bends a perspective quad mid-flight, so the quad is solved per frame instead.
 * Transform and opacity only; runs only while scrolling; off under reduced motion (no data-hero-zoom).
 */
type Pt = [number, number];

// The screen's corners in desk.webp source pixels (1192 x 1122): TL, TR, BR, BL.
const QUAD: Pt[] = [
  [338, 204],
  [594, 115],
  [622, 300],
  [369, 392],
];
const SRC_W = 1192;
const SRC_H = 1122;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** matrix3d taking the w x h box (origin top-left) onto quad q (TL, TR, BR, BL). */
export function quadMatrix(w: number, h: number, q: Pt[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0;
  const k = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((n) => +n.toFixed(6)).join(',')})`;
}

export function heroZoom() {
  const root = document.documentElement;
  const mode = root.dataset.heroZoom as 'start-inside' | 'dive-in' | undefined;
  const el = document.querySelector<HTMLElement>('[data-hero-screen]');
  const desk = document.querySelector<HTMLImageElement>('[data-hero-art] img');
  const copy = document.querySelector<HTMLElement>('.hero-copy');
  const work = document.getElementById('work');
  if ((mode !== 'start-inside' && mode !== 'dive-in') || !el || !desk || !copy) return;

  let raf = 0;
  const frame = () => {
    raf = 0;
    const vw = root.clientWidth;
    const vh = innerHeight;
    const pinned = innerWidth >= 900;
    const w = Math.max(vw, vh * 1.6);
    const h = w / 1.6;
    const full: Pt[] = [
      [(vw - w) / 2, (vh - h) / 2],
      [(vw + w) / 2, (vh - h) / 2],
      [(vw + w) / 2, (vh + h) / 2],
      [(vw - w) / 2, (vh + h) / 2],
    ];
    const r = desk.getBoundingClientRect();
    const quad = QUAD.map(([x, y]): Pt => [r.left + (x * r.width) / SRC_W, r.top + (y * r.height) / SRC_H]);
    const y = scrollY;
    // Desktop: the hero is pinned for the travel. Phones: the desk is below the copy, so A lands as the desk
    // comes fully into view and B dives from there.
    const deskBottom = r.bottom + y;
    const landAt = pinned ? vh * 0.7 : Math.max(vh * 0.3, deskBottom - vh);
    let p: number, o: number;
    if (mode === 'start-inside') {
      p = clamp(y / landAt);
      o = 1 - clamp((p - 0.86) / 0.14);
      const c = clamp((p - 0.5) / 0.45);
      copy.style.opacity = String(c);
      copy.style.transform = c < 1 ? `translateY(${((1 - c) * 24).toFixed(1)}px)` : '';
    } else {
      const start = pinned ? 0 : Math.max(0, deskBottom - vh);
      p = clamp((y - start) / (vh * 0.9));
      const past = work ? clamp(-work.getBoundingClientRect().top / (vh * 0.6)) : 0;
      o = y > start + 1 ? 1 - past : 0;
    }
    const t = ease(p);
    const q = mode === 'start-inside' ? full.map((f, i) => lerp(f, quad[i], t)) : quad.map((s, i) => lerp(s, full[i], t));
    const land = mode === 'start-inside' ? t : 1 - t;
    el.style.width = `${w}px`;
    el.style.transform = quadMatrix(w, h, q);
    el.style.borderRadius = `${(land * 18).toFixed(1)}px`;
    el.style.opacity = String(o);
    el.style.visibility = o > 0 ? 'visible' : 'hidden';
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  frame();
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake);
  desk.addEventListener('load', wake);
}
