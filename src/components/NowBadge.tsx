import { lazy, Suspense, useEffect, useState } from 'react';
import { onFirstIntent } from '../lib/intent';

const MetalBadge = lazy(() => import('metal-fx').then((m) => ({ default: m.MetalBadge })));

/**
 * "Now" on the current stop. It starts as a plain label and becomes liquid metal
 * (metal-fx, client-only WebGL) on a fine pointer's first intent, a beat after the
 * dock glass, so neither ~230ms setup lands mid-scroll. Touch and reduced motion keep the label.
 */
export default function NowBadge() {
  const [metal, setMetal] = useState(false);
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    return onFirstIntent(() => setMetal(true), 900);
  }, []);
  const label = <span>Now</span>;
  if (!metal) return label;
  return (
    <Suspense fallback={label}>
      <MetalBadge theme="auto">Now</MetalBadge>
    </Suspense>
  );
}
