import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isInsideOverlay, onScrollLock } from './overlay';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | undefined;

/**
 * One clock for everything: Lenis runs on GSAP's ticker and feeds ScrollTrigger,
 * so smoothed scroll and scrubbed animations never drift apart.
 * Touch keeps native scrolling; smoothing only applies to wheels.
 */
export function startScroll(): Lenis | undefined {
  if (lenis || reducedMotion()) return lenis;
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
    autoRaf: false,
    // Overlays own their scrolling (src/lib/overlay.ts). Without this, Lenis cancels
    // every wheel event inside a drawer and scrolls the page behind it instead.
    prevent: isInsideOverlay,
  });
  onScrollLock((locked) => (locked ? lenis?.stop() : lenis?.start()));
  lenis.on('scroll', ({ velocity }) => {
    ScrollTrigger.update();
    for (const listener of velocityListeners) listener(velocity);
  });
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  return lenis;
}

/** Scroll to an element. Uses Lenis when it runs, native scrolling otherwise. */
export function scrollToTarget(target: string | HTMLElement) {
  if (lenis) return lenis.scrollTo(target);
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Scroll to the very end. The footer is a sticky curtain, so its own box is
 * always "in view"; jumping to it by element would not move at all.
 */
export function scrollToEnd() {
  if (lenis) return lenis.scrollTo('bottom');
  scrollTo({ top: document.documentElement.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Jump to a scroll offset with no animation (keyboard-driven moves should not animate). */
export function jumpTo(y: number) {
  if (lenis) return lenis.scrollTo(y, { immediate: true });
  scrollTo({ top: y, behavior: 'instant' });
}

type VelocityListener = (velocity: number) => void;
const velocityListeners = new Set<VelocityListener>();

/** Subscribe to smoothed scroll velocity (px per frame). Returns an unsubscribe function. */
export function onVelocity(listener: VelocityListener) {
  velocityListeners.add(listener);
  return () => velocityListeners.delete(listener);
}
