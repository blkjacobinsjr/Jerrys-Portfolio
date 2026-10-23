import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMedia } from '../lib/useMedia';
import type { Spec } from './WorkSpec';

const WorkLiquid = lazy(() => import('./WorkLiquid'));
const WorkRipple = lazy(() => import('./WorkRipple'));
const WorkSpec = lazy(() => import('./WorkSpec'));

const specOf = (face: HTMLElement): Spec | null => {
  try {
    return JSON.parse(face.dataset.spec ?? '') as Spec;
  } catch {
    return null;
  }
};

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
  const [hovered, setHovered] = useState<HTMLElement | null>(face);
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
            setHovered((current) => (current === entry.target ? null : current));
          }
        }
      },
      { threshold: 0.05 },
    );
    const onMove = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      if (event.pointerType !== 'mouse' || !(inView.current.has(target) || visible(target))) return;
      setFace((current) => (current === target ? current : target));
      setHovered((current) => (current === target ? current : target));
    };
    const onLeave = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      setHovered((current) => (current === target ? null : current));
    };
    for (const el of faces) {
      io.observe(el);
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave);
    }
    return () => {
      io.disconnect();
      for (const el of faces) {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      }
    };
  }, []);

  const src = face?.querySelector<HTMLImageElement>('.work-logo')?.getAttribute('src');
  if (!fine || reducedMotion || !face || !src) return null;
  const spec = hovered === face ? specOf(face) : null;
  // One ripple renderer, in the card under the pointer; the spec sheet only while the pointer is on it.
  return createPortal(
    <Suspense fallback={null}>
      <WorkRipple key={`ripple-${src}`} face={face} />
      <WorkLiquid key={src} src={src} />
      {spec && <WorkSpec key={`spec-${src}`} spec={spec} />}
    </Suspense>,
    face,
  );
}
