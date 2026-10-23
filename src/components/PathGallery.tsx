import { useEffect, useRef } from 'react';
import { canUseGL } from '../lib/gl';
import { useMedia } from '../lib/useMedia';
import type { PathStop } from '../lib/path-gallery';

/**
 * The canvas half of the path's circular gallery. The strip around it is the real, static markup and stays
 * the fallback: this draws the dioramas over it only once the stage is near, WebGL2 is allowed (not reduced
 * motion, data saver or `?gl=off`) and the engine chunk has loaded. It adds no layout, so nothing shifts when it starts.
 */
export default function PathGallery({ stops }: { stops: PathStop[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (reducedMotion || !canUseGL()) return undefined;
    let alive = true;
    let stop: (() => void) | undefined;
    // A failed chunk leaves the static strip in place.
    import('../lib/path-gallery').then(
      (m) => {
        if (alive) stop = m.startPathGallery(canvas.current!, stops);
      },
      () => undefined,
    );
    return () => {
      alive = false;
      stop?.();
    };
  }, [stops, reducedMotion]);

  return <canvas ref={canvas} className="path-canvas" aria-hidden="true" />;
}
