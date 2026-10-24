import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cue } from '../lib/sound';
import { Highlighter } from './ui/highlighter';

type Props = { children: ReactNode; action: 'highlight' | 'underline'; color: string };

/** Scroll distance that draws a mark: about the 600 ms the Highlighter would take at reading pace. */
const DRAW_PX = 240;

/**
 * POLISH (t174): Magic UI Highlighter on a phrase, only with ?polish=1 and motion allowed. It waits until the scroll reveal
 * has un-blurred the phrase's last word, then the hand-drawn strokes follow the scroll: drawing as you read on, undrawing
 * as you scroll back. One soft marker sound on the first forward draw per page view (silent when muted or before a gesture).
 */
export default function Mark({ children, action, color }: Props) {
  const [start, setStart] = useState<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.polish !== 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = ref.current?.querySelectorAll('.word');
    const last = words?.[words.length - 1];
    const check = () => {
      const f = last ? getComputedStyle(last).filter : 'none';
      if (f === 'none' || f.includes('blur(0px)')) { setStart(scrollY); removeEventListener('scroll', check); }
    };
    addEventListener('scroll', check, { passive: true });
    check();
    return () => removeEventListener('scroll', check);
  }, []);

  useEffect(() => {
    if (start === null) return;
    let played = false;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, (scrollY - start) / DRAW_PX));
      const paths = ref.current?.querySelectorAll<SVGPathElement>('svg.rough-annotation path') ?? [];
      paths.forEach((path, k) => {
        const len = path.getTotalLength();
        const local = Math.min(1, Math.max(0, p * paths.length - k));
        path.style.animation = 'none';
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len * (1 - local)}`;
      });
      if (p > 0 && !played && paths.length) { played = true; cue('mark'); }
      if (!paths.length) frame = requestAnimationFrame(paint);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    queue();
    return () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); cancelAnimationFrame(frame); };
  }, [start]);

  return (
    <span ref={ref}>
      {start === null ? children : <Highlighter action={action} color={color}>{children}</Highlighter>}
    </span>
  );
}
