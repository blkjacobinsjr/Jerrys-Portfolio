import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { canUseGL } from '../lib/gl';
import { useMedia } from '../lib/useMedia';
import type { Screenshot } from './Work';
import './WorkGallery.css';

type Carousel = typeof import('./FlexCarousel').default;

// The card height as a share of the box; the step buttons line up with the caption under it.
const CARD = 0.56;

/**
 * The screenshots in a work drawer. React Bits Flex Carousel (WebGL, ogl) once the drawer is open,
 * this box is on screen and canUseGL() allows it; until then, and for reduced motion, data saver,
 * no WebGL2 or `?gl=off`, the static strip. Both fill the same box, so the swap shifts nothing.
 * Closing the drawer unmounts the carousel, which loses its WebGL context and removes its canvas.
 */
export default function WorkGallery({ name, shots, open }: { name: string; shots: Screenshot[]; open: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  // Loaded by hand, not with React.lazy: a Suspense fallback would remount the strip and replay its entrance.
  const [Carousel, setCarousel] = useState<Carousel | null>(null);

  useEffect(() => {
    if (!open || reducedMotion) return undefined;
    let alive = true;
    // A real share of the box, not an edge-adjacent zero-area hit: while the drawer still slides in from
    // off screen the box already "intersects", and the carousel would start invisible with its frame loop paused.
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
  }, [open, reducedMotion]);

  // The carousel has no imperative API; the buttons press the arrow keys its own keydown handler already steps on.
  const press = (key: 'ArrowLeft' | 'ArrowRight' | 'Home') =>
    box.current?.querySelector('.flex-carousel')?.dispatchEvent(new KeyboardEvent('keydown', { key }));

  // Its first frame snaps to the card nearest x = 0; when the textures are already cached, the narrow phone
  // shot at the end of the loop wins and it opens on the last screenshot. Home, before that frame, starts it on the first.
  useEffect(() => {
    if (Carousel) press('Home');
  }, [Carousel]);

  return (
    <div className="work-gallery" ref={box}>
      {open && !reducedMotion && Carousel ? (
        <div className="work-carousel" role="group" aria-label={`${name} screenshots`} style={{ '--card-half': `${CARD * 50}%` } as CSSProperties}>
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
        </div>
      ) : (
        <div className="detail-gallery" style={{ '--i': 4 } as CSSProperties} data-scrollsheet-nested-scroll tabIndex={0} role="group" aria-label={`${name} screenshots`}>
          {shots.map((shot) => (
            <img
              key={shot.src}
              src={shot.src}
              srcSet={shot.srcset}
              sizes="(min-width: 768px) 480px, 90vw"
              width={shot.width}
              height={shot.height}
              alt={shot.alt}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </div>
  );
}
