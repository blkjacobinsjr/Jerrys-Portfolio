import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { canUseGL } from '../lib/gl';
import { openLightbox } from '../lib/lightbox';
import type { Screenshot } from '../lib/work';
import { useMedia } from '../lib/useMedia';
import './WorkGallery.css';

type Carousel = typeof import('./FlexCarousel').default;

// The card height as a share of the box; the step buttons line up with the caption under it.
const CARD = 0.56;

/**
 * The screenshots on a project page. React Bits Flex Carousel (WebGL, ogl) once this box is on
 * screen and canUseGL() allows it; until then, and for reduced motion, data saver, no WebGL2 or
 * `?gl=off`, the static strip. Both fill the same box, so the swap shifts nothing. Unmounting the
 * carousel (reduced motion switched on) loses its WebGL context and removes its canvas.
 * Tapping a shot, in either view, opens the lightbox (lib/lightbox.ts, fetched on that first tap).
 */
export default function WorkGallery({ name, shots }: { name: string; shots: Screenshot[] }) {
  const box = useRef<HTMLDivElement>(null);
  const press0 = useRef<[number, number]>([0, 0]);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  // Loaded by hand, not with React.lazy: a Suspense fallback would remount the strip and replay its entrance.
  const [Carousel, setCarousel] = useState<Carousel | null>(null);

  useEffect(() => {
    if (reducedMotion) return undefined;
    let alive = true;
    // A real share of the box, not an edge-adjacent zero-area hit: the box can "intersect" while it is
    // still sliding in, and the carousel would start invisible with its frame loop paused.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry || entry.intersectionRatio < 0.25) return;
        io.disconnect();
        if (!canUseGL()) return;
        // A failed chunk leaves the strip in place.
        import('./FlexCarousel').then((m) => alive && setCarousel(() => m.default), () => undefined);
      },
      { threshold: [0.25, 0.5, 0.75, 1] },
    );
    io.observe(box.current!);
    return () => {
      alive = false;
      io.disconnect();
      setCarousel(null);
    };
  }, [reducedMotion]);

  // The carousel has no imperative API; the buttons press the arrow keys its own keydown handler already steps on.
  const press = (key: 'ArrowLeft' | 'ArrowRight' | 'Home') =>
    box.current?.querySelector('.flex-carousel')?.dispatchEvent(new KeyboardEvent('keydown', { key }));

  // Its first frame snaps to the card nearest x = 0; when the textures are already cached, the narrow phone
  // shot at the end of the loop wins and it opens on the last screenshot. Home, before that frame, starts it on the first.
  useEffect(() => {
    if (Carousel) press('Home');
  }, [Carousel]);

  const lightbox = (index: number, element?: HTMLElement) =>
    void openLightbox(
      shots.map((shot, i) => ({ ...shot.full, alt: shot.alt, element: i === index ? element : undefined })),
      index,
    );

  // The carousel announces "<caption>, 2 of 3"; that is the card in front.
  const current = () => {
    const step = /(\d+) of \d+$/.exec(box.current?.querySelector('.flex-carousel__live')?.textContent ?? '');
    return Math.min(shots.length, Number(step?.[1] ?? 1)) - 1;
  };
  // A tap, not a drag: the carousel flips on pointer drags and arrow keys, so a click that moved belongs to it.
  const tapCarousel = (event: MouseEvent) => {
    const [x, y] = press0.current;
    if ((event.target as Element).closest('button') || Math.hypot(event.clientX - x, event.clientY - y) > 8) return;
    lightbox(current());
  };

  return (
    <div className="work-gallery" ref={box}>
      {!reducedMotion && Carousel ? (
        <div
          className="work-carousel"
          role="group"
          aria-label={`${name} screenshots`}
          style={{ '--card-half': `${CARD * 50}%` } as CSSProperties}
          onPointerDownCapture={(event) => (press0.current = [event.clientX, event.clientY])}
          onClick={tapCarousel}
        >
          <Carousel
            items={shots.map((shot) => ({ src: shot.texture, alt: shot.alt }))}
            cardHeight={CARD}
            radius={parseFloat(getComputedStyle(box.current!).getPropertyValue('--r-tile'))}
            captureWheel={false}
          />
          <button type="button" className="work-carousel-step" data-dir="prev" aria-label="Previous screenshot" onClick={() => press('ArrowLeft')}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="work-carousel-step" data-dir="next" aria-label="Next screenshot" onClick={() => press('ArrowRight')}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="work-carousel-expand" aria-label="View this screenshot full size" onClick={() => lightbox(current())}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="detail-gallery" tabIndex={0} role="group" aria-label={`${name} screenshots`}>
          {shots.map((shot, i) => (
            <a
              key={shot.src}
              className="work-shot-link"
              href={shot.full.src}
              aria-label={`View ${shot.alt || `${name} screenshot ${i + 1}`} full size`}
              onClick={(event) => {
                event.preventDefault();
                lightbox(i, event.currentTarget);
              }}
            >
              <img
                src={shot.src}
                srcSet={shot.srcset}
                sizes="(min-width: 768px) 480px, 90vw"
                width={shot.width}
                height={shot.height}
                alt={shot.alt}
                loading="lazy"
                decoding="async"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
