import { useCallback, useEffect, useRef, useState } from 'react';
import LiquidObject from './LiquidObject';

/**
 * Thin wrapper around Canvas UI LiquidObject for the selected-work cards.
 * Forwards pointer motion from the parent `.work-face` so the full card stays clickable
 * through `Sheet.Trigger` while cursor movement ripples the 3D extruded project mark.
 * Pauses when the document is hidden (`visibilitychange`) and unmounts when the card leaves view.
 */
const SYNTHETIC_POINTER = 9001;

export default function WorkLiquid({ src }: { src: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const face = root?.closest<HTMLElement>('.work-face');
    const canvas = root?.querySelector('canvas');
    if (!face || !canvas) return undefined;

    const forward = (event: PointerEvent) => {
      const faceRect = face.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      if (faceRect.width < 1 || faceRect.height < 1 || canvasRect.width < 1 || canvasRect.height < 1) return;
      const u = (event.clientX - faceRect.left) / faceRect.width;
      const v = (event.clientY - faceRect.top) / faceRect.height;
      canvas.dispatchEvent(
        new PointerEvent(event.type, {
          clientX: canvasRect.left + u * canvasRect.width,
          clientY: canvasRect.top + v * canvasRect.height,
          // A synthetic id, never the real one: a forwarded pointerdown with the live id let the canvas capture the
          // pointer, so the pointerup and click landed on the canvas instead of the card link (work-click-through.spec).
          pointerId: SYNTHETIC_POINTER,
          pointerType: event.pointerType,
        }),
      );
    };

    face.addEventListener('pointermove', forward, { passive: true });
    face.addEventListener('pointerleave', forward, { passive: true });
    face.addEventListener('pointercancel', forward, { passive: true });
    return () => {
      face.removeEventListener('pointermove', forward);
      face.removeEventListener('pointerleave', forward);
      face.removeEventListener('pointercancel', forward);
    };
  }, []);

  const handleLoad = useCallback(() => {
    setReady(true);
    const canvas = rootRef.current?.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: rect.left + rect.width * 0.42,
        clientY: rect.top + rect.height * 0.56,
        pointerId: 1,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: rect.left + rect.width * 0.56,
        clientY: rect.top + rect.height * 0.44,
        pointerId: 1,
      }),
    );
  }, []);

  return (
    <div
      ref={rootRef}
      className="work-liquid"
      data-ready={ready}
      data-paused={hidden}
      aria-hidden="true"
      style={hidden ? { display: 'none' } : undefined}
    >
      <LiquidObject
        className="work-liquid-stage"
        src={src}
        orbit={false}
        zoom={false}
        wobble={0.35}
        depth={0.12}
        bevel={0.65}
        scale={2.8}
        yOffset={0}
        onLoad={handleLoad}
      />
    </div>
  );
}
