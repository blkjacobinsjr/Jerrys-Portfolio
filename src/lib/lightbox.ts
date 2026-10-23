import pswpCss from 'photoswipe/photoswipe.css?url';
import { lockScroll, OVERLAY_ATTR } from './overlay';
import { cue } from './sound';

export interface LightboxShot {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** The link the shot was opened from: PhotoSwipe zooms out of its image, and focus returns to it. */
  element?: HTMLElement;
}

// Astro does not emit the CSS of a dynamic import inside an island, so its stylesheet is fetched by URL, once, with the code.
function loadStyles(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((done) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: () => done(), onerror: () => done() });
    document.head.append(link);
  });
}

/**
 * The project page's lightbox: PhotoSwipe v5, fetched on the first tap so it never touches LCP.
 * Swipe or arrows between shots; the backdrop, X, Escape or a swipe down closes it. PhotoSwipe traps
 * focus and returns it to the opener; this adds the overlay contract (lib/overlay.ts: page locked,
 * Lenis and the other page-level scroll handlers leave it alone). Open and close follow the Modal recipe
 * (transitions.dev 06): 250ms in, 150ms out, the smooth-out ease. Reduced motion opens it at once.
 */
export async function openLightbox(shots: LightboxShot[], index: number, container?: HTMLElement): Promise<void> {
  const [{ default: PhotoSwipe }] = await Promise.all([import('photoswipe'), loadStyles(pswpCss)]);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pswp = new PhotoSwipe({
    dataSource: shots,
    index,
    showHideAnimationType: still ? 'none' : shots[index]?.element ? 'zoom' : 'fade',
    showAnimationDuration: 250,
    hideAnimationDuration: 150,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    bgOpacity: 0.92,
    wheelToZoom: false,
    // Inside an open modal <dialog> (a Path drawer) the lightbox must live in the dialog's top layer to show above it.
    ...(container ? { appendToEl: container } : {}),
  });
  // Escape closes the lightbox, not the drawer under it.
  const dialog = container?.closest('dialog');
  const keepDialog = (event: Event) => event.preventDefault();
  dialog?.addEventListener('cancel', keepDialog);
  const unlock = lockScroll();
  pswp.on('afterInit', () => {
    pswp.element?.setAttribute(OVERLAY_ATTR, '');
    cue('bloom');
  });
  // Keys and drags are ignored while it opens; `data-opened` says when it is ready for them.
  pswp.on('openingAnimationEnd', () => pswp.element?.setAttribute('data-opened', ''));
  pswp.on('destroy', () => {
    // Let the Escape that closed the lightbox finish before the drawer listens again.
    setTimeout(() => dialog?.removeEventListener('cancel', keepDialog), 0);
    cue('tear');
    unlock();
  });
  pswp.init();
}
