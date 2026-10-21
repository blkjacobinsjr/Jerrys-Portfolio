import type { ClientDirective } from 'astro';

/**
 * Hydrate after the page has loaded and gone idle. Plain `client:idle` can start
 * before `load` and compete with the hero image; nothing on this page needs to be
 * interactive that early.
 */
const afterload: ClientDirective = (load) => {
  const hydrate = async () => (await load())();
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(hydrate, { timeout: 2000 }) : setTimeout(hydrate, 200));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
};

export default afterload;
