import type { ClientDirective } from 'astro';

// ponytail: a fixed beat, not a paint observer; raise it if a slower hero image ever paints later.
const AFTER_LOAD_MS = 250;

/**
 * Hydrate a beat after the page has loaded, once it has gone idle. Plain
 * `client:idle` can start before `load` and compete with the hero image, and
 * the first frame is often presented after `load`; the beat keeps island
 * scripts out of the hero's paint entirely.
 *
 * An optional media query (`client:afterload="(hover: hover)"`) skips hydration
 * until it matches, so desktop-only islands never load on phones.
 */
const afterload: ClientDirective = (load, opts) => {
  const hydrate = async () => (await load())();
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(hydrate, { timeout: 2000 }) : setTimeout(hydrate, 200));
  const later = () => setTimeout(idle, AFTER_LOAD_MS);
  const start = () => (document.readyState === 'complete' ? later() : addEventListener('load', later, { once: true }));
  const query = typeof opts.value === 'string' ? matchMedia(opts.value) : null;
  if (!query || query.matches) return start();
  const onChange = (event: MediaQueryListEvent) => {
    if (!event.matches) return;
    query.removeEventListener('change', onChange);
    start();
  };
  query.addEventListener('change', onChange);
};

export default afterload;
