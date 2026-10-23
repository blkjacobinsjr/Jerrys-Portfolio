import { useCallback, useEffect, useState } from 'react';
import ModelLoader from './ModelLoader';
import { canUseGL } from '../lib/gl';
import type { LanyardProps } from './Lanyard';

/**
 * The buildspace lanyard from the path drawer, wearing the Leapfrog AI badge. The poster is the page's first
 * paint: the lanyard's own first WebGL frame (tools/consultancy-poster.mjs), at rest, in the same box the canvas
 * fills. The physics (three.js) start when the browser is idle after load, hang from that same pose and swing in.
 * The poster fades out only once that first frame is drawn. Without WebGL or with reduced motion it stays.
 */
export default function ConsultancyBadge({ image, alt, options }: { image: string; alt: string; options: LanyardProps }) {
  const [live, setLive] = useState(false);
  const [covered, setCovered] = useState(true);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!canUseGL()) return undefined;
    let off = false;
    const go = () => !off && setLive(true);
    // Safari has no requestIdleCallback.
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1000 });
    else setTimeout(go, 200);
    return () => {
      off = true;
    };
  }, []);

  // Two frames after the first WebGL frame, so the canvas is on screen before the poster leaves.
  const onStateChange = useCallback((state: string) => {
    if (state === 'ready') requestAnimationFrame(() => requestAnimationFrame(() => setCovered(false)));
  }, []);

  return (
    <div className="badge" data-live={live || undefined}>
      {live && <ModelLoader kind="lanyard" image={image} alt={alt} options={options} onStateChange={onStateChange} />}
      {!gone && (
        <div className="badge-poster" data-covered={covered} onTransitionEnd={() => !covered && setGone(true)}>
          <div className="badge-poster__stage">
            <img src={image} alt={alt} decoding="async" fetchPriority="high" />
          </div>
          {/* Same row as the live "Flip badge" button, so the stage is the same height before and after. */}
          <div className="model-controls" aria-hidden="true" style={{ visibility: 'hidden' }}>
            <button type="button" tabIndex={-1}>Flip badge</button>
          </div>
        </div>
      )}
    </div>
  );
}
