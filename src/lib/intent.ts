const INTENTS = ['pointermove', 'wheel', 'keydown'] as const;

/**
 * Run `fn` once, on the visitor's first pointer move, wheel or key press, after
 * `delay` ms and an idle frame. Heavy one-off setup (WebGL, lens maps) goes here so
 * it lands while someone is reading, not mid-scroll, and never during page load.
 */
export function onFirstIntent(fn: () => void, delay = 0): () => void {
  let timer = 0;
  const go = () => {
    stop();
    timer = window.setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : fn()), delay);
  };
  const stop = () => {
    for (const type of INTENTS) removeEventListener(type, go);
  };
  for (const type of INTENTS) addEventListener(type, go, { once: true, passive: true });
  return () => {
    stop();
    clearTimeout(timer);
  };
}
