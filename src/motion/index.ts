import { gsap, jumpTo, startScroll } from '../lib/scroll';

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
    curtain();
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

/** The footer is uncovered from beneath, and its rooftops rise at three depths. */
function curtain() {
  const reveal = { trigger: '#contact', start: 'top bottom', end: 'bottom bottom' } as const;
  gsap.fromTo('[data-curtain]', { yPercent: -45 }, { yPercent: 0, ease: 'none', scrollTrigger: { ...reveal, scrub: true } });
  const rise = { far: 6, mid: 16, near: 30 } as const;
  for (const [depth, amount] of Object.entries(rise)) {
    gsap.fromTo(
      `[data-roof="${depth}"]`,
      { yPercent: amount },
      { yPercent: 0, ease: 'none', scrollTrigger: { ...reveal, scrub: 1 } },
    );
  }
}
