/**
 * Ultramock laptop (preview, ULTRAMOCK_LAPTOP + ?um=1): the E3 hero with a real MacBook Pro instead of the
 * code-built one. 90 WebP frames (public/hero-um, ~1.5 MB, rendered in Ultramock and baked so each frame turns the
 * laptop by the same angle) are scrubbed by the same scroll as hero-laptop.ts. An ease-out maps scroll to frame, so
 * the spin is quick at first and settles into the landing pose, which holds before the canvas hands off to the
 * drawn desk. The landing frame is placed on the drawing with one similarity transform (SIFT match against
 * desk-v3, 70 inliers), so the hand-off has no jump. Desktop only, after the first intent; phones never get here.
 */
const N = 90;
const FW = 578, FH = 493;
// Frame px -> desk px (desk source is 1192 wide): canvas setTransform order a, b, c, d, e, f.
const A = [0.99373, -0.07432, 0.07432, 0.99373, 140.93644, 84.65634] as const;
const SRC_W = 1192;
const SPIN_FROM = 0.08, SPIN_TO = 0.8;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function heroFrames() {
  const root = document.documentElement;
  if (root.dataset.heroZoom !== 'laptop') return;
  const desk = document.querySelector<HTMLImageElement>('[data-hero-art] > picture img');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-laptop]');
  const ctx = canvas?.getContext('2d');
  if (!desk || !canvas || !ctx) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const frames: (HTMLImageElement | undefined)[] = new Array(N);
  let vw = 0, vh = 0, dpr = 1, shown = -1;
  const size = () => {
    dpr = Math.min(devicePixelRatio, 2);
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    shown = -1;
  };
  const progress = () => clamp(scrollY / (innerHeight * 0.9));
  const indexAt = (p: number) => (still ? N - 1 : Math.round(easeOut(clamp((p - SPIN_FROM) / (SPIN_TO - SPIN_FROM))) * (N - 1)));
  // Nearest frame that has loaded, so a fast scroll never shows an empty canvas.
  const nearest = (i: number) => {
    for (let d = 0; d < N; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  };
  const draw = (p: number) => {
    // The canvas is display:none until data-hero3d, so its size is (re)read here, not only on resize.
    if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) size();
    const i = nearest(indexAt(p));
    if (i < 0 || i === shown) return;
    shown = i;
    // Desk position in the canvas's own pixels (the canvas is sticky in the pin, not fixed).
    const r = desk.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const s = (r.width / SRC_W) * dpr;
    const ox = (r.left - c.left) * dpr, oy = (r.top - c.top) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(A[0] * s, A[1] * s, A[2] * s, A[3] * s, ox + A[4] * s, oy + A[5] * s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frames[i]!, 0, 0, FW, FH);
  };

  let cur = -1, raf = 0;
  const frame = () => {
    raf = 0;
    const target = progress();
    cur = cur < 0 ? target : cur + (target - cur) * 0.2;
    if (Math.abs(target - cur) < 0.0005) cur = target;
    if (cur < 1) draw(cur);
    if (cur !== target) raf = requestAnimationFrame(frame);
  };
  const wake = (force = false) => {
    if (force) {
      cur = -1;
      shown = -1;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const load = (i: number) =>
    new Promise<void>((done) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = `/hero-um/f${String(i).padStart(2, '0')}.webp`;
      img.decode().then(
        () => {
          frames[i] = img;
          done();
        },
        () => done(),
      );
    });
  // The current frame first (it hands off from the overlay), then the landing frame, then the rest in order,
  // a few at a time so the first paint is not queued behind 90 requests.
  (async () => {
    const first = indexAt(progress());
    await load(first);
    if (!frames[first]) return;
    // The attribute shows the canvas; the first frame is drawn in the same task, before the next paint, so the
    // overlay never hands off to an empty canvas.
    root.dataset.hero3d = 'ready';
    draw(progress());
    if (still) return;
    await load(N - 1);
    const rest = Array.from({ length: N }, (_, i) => i).filter((i) => !frames[i]);
    for (let k = 0; k < rest.length; k += 6) {
      await Promise.all(rest.slice(k, k + 6).map(load));
      wake();
    }
  })();

  addEventListener('scroll', () => wake(), { passive: true });
  addEventListener('resize', () => {
    size();
    wake(true);
  });
}
