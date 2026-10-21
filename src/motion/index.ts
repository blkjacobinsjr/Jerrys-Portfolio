import { gsap, jumpTo, startScroll } from '../lib/scroll';
import { step, still, type Swing } from '../lib/swing';

/**
 * Every scroll-driven effect on the page. Loaded once, after `load` and an
 * idle frame, so none of it competes with the first paint.
 */
export function start() {
  startScroll();
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    hero();
    deck();
    keyring();
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
  const distance = () => Math.max(0, track.scrollWidth - innerWidth);

  const travel = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      pin: true,
      start: 'center center',
      end: () => `+=${distance()}`,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => ruler.style.setProperty('--progress', String(self.progress)),
    },
  });

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
    if (!stop || !st) return;
    const offset = stop.getBoundingClientRect().left - track.getBoundingClientRect().left;
    const progress = gsap.utils.clamp(0, 1, (offset + stop.offsetWidth / 2 - innerWidth / 2) / distance());
    jumpTo(st.start + progress * (st.end - st.start));
  };
  track.addEventListener('focusin', onFocus);

  return () => {
    track.removeEventListener('focusin', onFocus);
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
