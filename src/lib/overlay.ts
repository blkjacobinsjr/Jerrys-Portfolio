/**
 * The one contract every overlay on the site follows (see AGENTS.md, "Overlays").
 *
 * An overlay is marked with `data-overlay` and owns its scrolling: wheel and touch
 * events that start inside it scroll it natively, and every page-level handler
 * (Lenis, the pinned path, anything new) leaves them alone. While any overlay is
 * open the page behind it is locked in place and comes back exactly where it was.
 */
export const OVERLAY_ATTR = 'data-overlay';
export const LOCK_ATTR = 'data-scroll-locked';

interface Closest {
  closest?: (selector: string) => unknown;
}

/** True for events that start inside an overlay; page-level scroll handlers must ignore them. */
export function isInsideOverlay(target: EventTarget | null): boolean {
  const node = target as Closest | null;
  return typeof node?.closest === 'function' && node.closest(`[${OVERLAY_ATTR}], dialog[open]`) !== null;
}

type LockListener = (locked: boolean) => void;
const listeners = new Set<LockListener>();

/** Hear when the page locks or unlocks, e.g. to pause a smooth-scroll engine. Returns an unsubscribe. */
export function onScrollLock(listener: LockListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface ScrollWindow {
  scrollX: number;
  scrollY: number;
  scrollTo: (options: { left: number; top: number; behavior: 'instant' }) => void;
}

interface LockState {
  count: number;
  x: number;
  y: number;
}
const states = new WeakMap<HTMLElement, LockState>();

/**
 * Lock the page while an overlay is open. Locks nest (two overlays need two
 * unlocks); the returned unlock is safe to call more than once.
 */
export function lockScroll(root: HTMLElement = document.documentElement, win: ScrollWindow = window): () => void {
  const state = states.get(root) ?? { count: 0, x: 0, y: 0 };
  states.set(root, state);
  if (state.count === 0) {
    state.x = win.scrollX;
    state.y = win.scrollY;
    root.setAttribute(LOCK_ATTR, '');
    for (const listener of listeners) listener(true);
  }
  state.count += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (state.count > 0) return;
    root.removeAttribute(LOCK_ATTR);
    for (const listener of listeners) listener(false);
    if (win.scrollX !== state.x || win.scrollY !== state.y) win.scrollTo({ left: state.x, top: state.y, behavior: 'instant' });
  };
}
