import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMedia } from '../lib/useMedia';

const WorkLiquid = lazy(() => import('./WorkLiquid'));

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};

/**
 * The selected-work cards are static Astro markup (WorkCards.astro). Their script loads this host only after the
 * visitor's first intent, on a fine pointer, behind the GL gate (lib/work-liquid.ts), so a first visit fetches none of
 * it. The host tracks which `.work-face` is in view (in a ref, so scrolling never re-renders) and portals one
 * WorkLiquid into the hovered card: at most one WebGL renderer exists at a time.
 */
export default function WorkLiquidHost() {
  const fine = useMedia('(hover: hover) and (pointer: fine)', true);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const [face, setFace] = useState<HTMLElement | null>(() => {
    const hovered = document.querySelector<HTMLElement>('.work-list .work-face:hover');
    return hovered && visible(hovered) ? hovered : null;
  });
  const inView = useRef(new Set<Element>());

  useEffect(() => {
    const faces = [...document.querySelectorAll<HTMLElement>('.work-list .work-face')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.current.add(entry.target);
          else {
            inView.current.delete(entry.target);
            setFace((current) => (current === entry.target ? null : current));
          }
        }
      },
      { threshold: 0.05 },
    );
    const onMove = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      if (event.pointerType !== 'mouse' || !(inView.current.has(target) || visible(target))) return;
      setFace((current) => (current === target ? current : target));
    };
    for (const el of faces) {
      io.observe(el);
      el.addEventListener('pointermove', onMove, { passive: true });
    }
    return () => {
      io.disconnect();
      for (const el of faces) el.removeEventListener('pointermove', onMove);
    };
  }, []);

  const src = face?.querySelector<HTMLImageElement>('.work-logo')?.getAttribute('src');
  if (!fine || reducedMotion || !face || !src) return null;
  return createPortal(
    <Suspense fallback={null}>
      <WorkLiquid key={src} src={src} />
    </Suspense>,
    face,
  );
}
