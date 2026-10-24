import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Highlighter } from './ui/highlighter';

type Props = { children: ReactNode; action: 'highlight' | 'underline'; color: string };

/** POLISH (t174): Magic UI Highlighter on a phrase, only with ?polish=1 and motion allowed. It draws once the scroll reveal
 *  has un-blurred the phrase's last word, so the mark lands on readable text instead of the blur. */
export default function Mark({ children, action, color }: Props) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (document.documentElement.dataset.polish !== 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = ref.current?.querySelectorAll('.word');
    const last = words?.[words.length - 1];
    const check = () => {
      const f = last ? getComputedStyle(last).filter : 'none';
      if (f === 'none' || f.includes('blur(0px)')) { setOn(true); removeEventListener('scroll', check); }
    };
    addEventListener('scroll', check, { passive: true });
    check();
    return () => removeEventListener('scroll', check);
  }, []);
  if (!on) return <span ref={ref}>{children}</span>;
  return (
    <Highlighter action={action} color={color} isView iterations={action === 'underline' ? 1 : 2} animationDuration={action === 'underline' ? 700 : 900}>
      {children}
    </Highlighter>
  );
}
