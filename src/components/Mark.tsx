import { useEffect, useState, type ReactNode } from 'react';
import { Highlighter } from './ui/highlighter';

type Props = { children: ReactNode; action: 'highlight' | 'underline'; color: string };

/** POLISH (t174): Magic UI Highlighter on a phrase, drawn once it scrolls into view, only with ?polish=1 and motion allowed. */
export default function Mark({ children, action, color }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.dataset.polish === 'on' && !matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  if (!on) return <span>{children}</span>;
  return (
    <Highlighter action={action} color={color} isView iterations={action === 'underline' ? 1 : 2} animationDuration={action === 'underline' ? 700 : 900}>
      {children}
    </Highlighter>
  );
}
