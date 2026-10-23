import { gsap, hasUserIntent, jumpTo, ScrollTrigger, startScroll } from '../lib/scroll';
import { step, still, type Swing } from '../lib/swing';
import { onScrollLock } from '../lib/overlay';

/**
 * Every scroll-driven effect on the page. Loaded once, after `load` and an
 * idle frame, so none of it competes with the first paint.
 */
export function start() {
  startScroll();
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // GSAP reverts its own tweens when the query stops matching; our loops and listeners clean up here.
    const cleanups = [hero(), keyring()];
    deck();
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  });
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', path);
}

/** The desk drifts up slower than the page and follows a fine pointer. */
function hero() {
  const art = document.querySelector<HTMLElement>('[data-hero-art]');
  const img = art?.querySelector('img');
  if (!art || !img) return;
  gsap.to(art, {
    yPercent: -18,
    rotate: -2,
    scale: 0.94,
    ease: 'none',
    scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: 1 },
  });
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const toX = gsap.quickTo(img, 'x', { duration: 0.9, ease: 'power3.out' });
  const toY = gsap.quickTo(img, 'y', { duration: 0.9, ease: 'power3.out' });
  const follow = (event: PointerEvent) => {
    toX((event.clientX / innerWidth - 0.5) * -18);
    toY((event.clientY / innerHeight - 0.5) * -12);
  };
  addEventListener('pointermove', follow, { passive: true });
  return () => removeEventListener('pointermove', follow);
}

/** Sticky deck: as the next card slides over, the one beneath recedes. */
function deck() {
  const cards = gsap.utils.toArray<HTMLElement>('.work-item');
  cards.slice(0, -1).forEach((card, i) => {
    gsap.fromTo(
      card,
      { scale: 1, '--dim': 0 },
      {
        scale: 0.93,
        '--dim': 1,
        ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 20%', scrub: true },
      },
    );
  });
}

/** Pin the career strip and turn vertical scroll into horizontal travel. */
function path() {
  const pin = document.querySelector<HTMLElement>('[data-path-pin]');
  const track = pin?.querySelector<HTMLElement>('[data-path-track]');
  const ruler = pin?.querySelector<HTMLElement>('.ruler');
  if (!pin || !track || !ruler) return;
  document.documentElement.classList.add('is-pinned');
  // The stage is as wide as the section (no scrollbar), which is where the last stop has to come to rest.
  const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);
  // Where, as progress through the pin, each stop rests in the middle. Layout offsets: the circular gallery bends
  // each stop with a transform, which would skew a bounding box.
  const restAt = (stop: HTMLElement) => gsap.utils.clamp(0, 1, (stop.offsetLeft - track.offsetLeft + stop.offsetWidth / 2 - pin.clientWidth / 2) / distance());

  let held = false;
  let lastInput = -Infinity;
  const input = () => { lastInput = performance.now(); };
  for (const type of ['wheel', 'touchmove', 'keydown'] as const) addEventListener(type, input, { passive: true });
  const travel = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      pin: true,
      start: 'center center',
      end: () => `+=${distance()}`,
      // Lenis already smooths the wheel, and the circular gallery eases the drawn position itself (React Bits scrollEase),
      // so the scrub follows the scroll one to one instead of adding a second second of lag.
      scrub: true,
      // React Bits CircularGallery snap-on-end: once input stops for 140ms, glide to the nearest stop.
      snap: {
        // A press, or an open drawer, holds the wheel where it is: the glide never moves a stop out from under the pointer
        // or scrolls the page behind a scroll-locked drawer.
        snapTo: (progress, self) => {
          // `progress` is velocity-projected, so a hold returns where the wheel actually is, not where it was headed.
          // Only the visitor's own wheel, touch or keys snap: a programmatic scroll (deep link, scrollIntoView, focus) rests where it lands.
          if (held || performance.now() - lastInput > 1200 || document.documentElement.hasAttribute('data-scroll-locked')) return self?.progress ?? progress;
          const rests = [...track.querySelectorAll<HTMLElement>('.stop')].map(restAt);
          return rests.reduce((best, at) => (Math.abs(at - progress) < Math.abs(best - progress) ? at : best), rests[0] ?? progress);
        },
        delay: 0.14,
        duration: { min: 0.25, max: 0.6 },
        ease: 'power2.out',
      },
      invalidateOnRefresh: true,
      onUpdate: (self) => ruler.style.setProperty('--progress', String(self.progress)),
    },
  });

  // ScrollTrigger's getTween(true) is the snap tween, or 0 when none is running (gsap 3.13): never call .kill on 0.
  // A throw here ran inside pointerdown and the lock listener, leaving the page half locked.
  const stopSnap = () => {
    try {
      const tween = travel.scrollTrigger?.getTween(true) as unknown;
      if (tween && typeof (tween as { kill?: unknown }).kill === 'function') (tween as { kill: () => void }).kill();
    } catch {
      // Stopping the glide is best effort; the lock check in snapTo still keeps the page still.
    }
  };
  const hold = () => {
    held = true;
    stopSnap();
  };
  const release = () => requestAnimationFrame(() => { held = false; });
  track.addEventListener('pointerdown', hold);
  const offLock = onScrollLock((locked) => locked && stopSnap());
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // Native anchors resolve before this late pin adds its spacer. Keep untouched
  // deep links aligned through pin refreshes, then leave scrolling to the visitor.
  const alignInitialHash = () => {
    if (hasUserIntent() || location.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    jumpTo(scrollY + target.getBoundingClientRect().top - margin);
  };
  ScrollTrigger.addEventListener('refresh', alignInitialHash);
  alignInitialHash();

  // Each diorama rises to full size as it reaches the middle of the screen.
  for (const img of track.querySelectorAll('.stop-art img')) {
    gsap.fromTo(
      img,
      { scale: 0.78, yPercent: 6 },
      {
        scale: 1,
        yPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: img, containerAnimation: travel, start: 'left 95%', end: 'center 55%', scrub: true },
      },
    );
  }
  // The stop crossing the middle glows faintly in its own main colour.
  for (const glow of track.querySelectorAll<HTMLElement>('.stop-glow')) {
    gsap
      .timeline({ scrollTrigger: { trigger: glow, containerAnimation: travel, start: 'left 80%', end: 'right 20%', scrub: true } })
      .fromTo(glow, { opacity: 0 }, { opacity: 0.7, ease: 'none' })
      .to(glow, { opacity: 0, ease: 'none' });
  }

  // Tabbing to a stop that is still off to the side brings it to the middle, so focus is never hidden.
  const onFocus = (event: FocusEvent) => {
    const stop = (event.target as HTMLElement).closest<HTMLElement>('.stop');
    const st = travel.scrollTrigger;
    // Not for a press: pointerdown also focuses the button, and jumping then moves the stop out from under the
    // pointer, so pointerup lands on a neighbour and the click never opens the drawer. Keys and focus() still jump.
    if (!stop || !st || held) return;
    jumpTo(st.start + restAt(stop) * (st.end - st.start));
  };
  track.addEventListener('focusin', onFocus);

  return () => {
    track.removeEventListener('focusin', onFocus);
    track.removeEventListener('pointerdown', hold);
    offLock();
    for (const type of ['wheel', 'touchmove', 'keydown'] as const) removeEventListener(type, input);
    removeEventListener('pointerup', release);
    removeEventListener('pointercancel', release);
    ScrollTrigger.removeEventListener('refresh', alignInitialHash);
    document.documentElement.classList.remove('is-pinned');
  };
}

/**
 * The keyring swings with the momentum of the page: scroll acceleration kicks
 * the carabiner one way and its charms the other, a breeze keeps it alive, and
 * a pointer can bat a charm. Runs only while the keyring is on screen.
 */
function keyring() {
  const root = document.querySelector<HTMLElement>('[data-keyring]');
  if (!root) return;
  const parts = [...root.querySelectorAll<HTMLElement>('[data-swing]')].map((el, i) => ({
    el,
    rest: Number(el.dataset.rest ?? 0),
    mass: Number(el.dataset.mass ?? 1),
    sign: i === 0 ? 1 : i % 2 ? -1 : 1,
    phase: i * 1.7,
    swing: still as Swing,
    kick: 0,
  }));
  const [rig, ...charms] = parts;
  if (!rig) return;

  let frame = 0;
  let visible = false;
  let last = 0;
  let lastY = scrollY;
  let lastV = 0;

  const tick = (now: number) => {
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    const v = scrollY - lastY;
    const a = v - lastV;
    lastY = scrollY;
    lastV = v;
    const scroll = a * 1.6 + v * 0.06;
    const before = rig.swing.velocity;

    for (const part of parts) {
      const breeze = Math.sin(now / 1250 + part.phase) * 0.35;
      // Charms hang off the rig, so they lag behind whatever the rig just did.
      const drag = part === rig ? 0 : -(rig.swing.velocity - before) / Math.max(dt, 1 / 120) * 0.5;
      part.swing = step(part.swing, (scroll * part.sign + part.kick) / part.mass + breeze + drag, dt);
      part.kick = 0;
      part.el.style.rotate = `${part.rest + part.swing.angle * (180 / Math.PI)}deg`;
    }
    frame = visible ? requestAnimationFrame(tick) : 0;
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible && !frame) {
      last = 0;
      lastY = scrollY;
      lastV = 0;
      frame = requestAnimationFrame(tick);
    }
  });
  io.observe(root);

  // Bat a charm: horizontal pointer speed becomes a kick on the piece under it.
  const bat = (event: PointerEvent) => {
    const hit = (event.target as Element).closest<HTMLElement>('[data-swing]');
    const part = parts.find((p) => p.el === hit) ?? charms[0];
    if (part) part.kick += event.movementX * 22;
  };
  root.addEventListener('pointermove', bat, { passive: true });

  return () => {
    io.disconnect();
    root.removeEventListener('pointermove', bat);
    cancelAnimationFrame(frame);
    for (const part of parts) part.el.style.rotate = `${part.rest}deg`;
  };
}
