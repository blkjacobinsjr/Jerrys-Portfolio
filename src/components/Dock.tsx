import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Mascot from './Mascot';
import { onFirstIntent } from '../lib/intent';
import { scrollToTarget } from '../lib/scroll';
import { useColorScheme, useMedia } from '../lib/useMedia';
import './Dock.css';

const LiquidGlass = lazy(() => import('simple-liquid-glass').then((m) => ({ default: m.LiquidGlass })));

const LINKS = [
  { id: 'work', label: 'Work' },
  { id: 'path', label: 'Path' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
] as const;

type Id = (typeof LINKS)[number]['id'];

/**
 * Progressive disclosure: the dock stays hidden while the hero is on screen,
 * then rises once you start reading. The active tab is a clipped copy of the
 * list (Emil Kowalski's tab technique), so the colour change is one shape.
 */
export default function Dock({ sprite, still }: { sprite: string; still: string }) {
  const [shown, setShown] = useState(false);
  // The liquid glass builds a 512px lens map on mount (~250ms, fixed in the library).
  // Build it on the first sign of intent, before the dock is needed, so it never
  // lands mid-scroll. Touch screens keep the CSS frost the library falls back to there.
  const fine = useMedia('(hover: hover) and (pointer: fine)');
  const [glass, setGlass] = useState(false);
  useEffect(() => (fine ? onFirstIntent(() => setGlass(true)) : undefined), [fine]);
  const [active, setActive] = useState<Id | null>(null);
  const [clip, setClip] = useState('inset(0 100% 0 0 round 999px)');
  const list = useRef<HTMLUListElement>(null);
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    const hero = document.getElementById('top');
    const sections = LINKS.map(({ id }) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const heroIo = new IntersectionObserver(([entry]) => setShown(!entry?.isIntersecting), { threshold: 0, rootMargin: '-35% 0px 0px 0px' });
    if (hero) heroIo.observe(hero);
    const sectionIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id as Id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const section of sections) sectionIo.observe(section);
    return () => {
      heroIo.disconnect();
      sectionIo.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const ul = list.current;
    const link = active && ul?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!ul || !link) return setClip('inset(0 100% 0 0 round 999px)');
    const left = link.offsetLeft;
    const right = ul.offsetWidth - (left + link.offsetWidth);
    setClip(`inset(0 ${right}px 0 ${left}px round 999px)`);
  }, [active]);

  const items = (copy: boolean) =>
    LINKS.map(({ id, label }) => (
      <li key={id}>
        <a
          href={`#${id}`}
          data-id={copy ? undefined : id}
          tabIndex={copy ? -1 : undefined}
          aria-current={!copy && active === id ? 'true' : undefined}
          onClick={(event) => {
            event.preventDefault();
            scrollToTarget(`#${id}`);
            history.replaceState(null, '', `#${id}`);
          }}
        >
          {label}
        </a>
      </li>
    ));

  const nav = (
    <nav className="dock-inner" aria-label="Sections">
      <Mascot sprite={sprite} still={still} size={36} label="Back to top" feelsScroll onPoke={() => scrollToTarget('#top')} />
      <div className="dock-tabs">
        <ul ref={list} className="dock-list">
          {items(false)}
        </ul>
        <ul className="dock-list dock-list-active" aria-hidden="true" style={{ clipPath: clip }}>
          {items(true)}
        </ul>
      </div>
    </nav>
  );

  const frost = <div className="dock-glass dock-frost">{nav}</div>;

  return (
    <div className="dock" data-shown={shown} inert={!shown}>
      {glass ? (
        <Suspense fallback={frost}>
        <LiquidGlass
          radius={28}
          blur={2}
          saturation={160}
          frost={0.08}
          glassColor={dark ? 'rgba(28, 28, 27, 0.42)' : 'rgba(255, 255, 255, 0.28)'}
          borderColor={dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.55)'}
          className="dock-glass"
        >
          {nav}
        </LiquidGlass>
        </Suspense>
      ) : (
        frost
      )}
    </div>
  );
}
