import { useSyncExternalStore } from 'react';

/** Live media query match. Returns `server` during SSR and hydration, then the real value. */
export function useMedia(query: string, server = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
    () => server,
  );
}

/** Live light/dark preference; "light" on the server. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useMedia('(prefers-color-scheme: dark)');
  // POLISH theme toggle: html.dark decides while ?polish=1 is on.
  const forced = useSyncExternalStore(
    (onChange) => {
      const mo = new MutationObserver(onChange);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => mo.disconnect();
    },
    () => (document.documentElement.dataset.polish === 'on' ? document.documentElement.classList.contains('dark') : null),
    () => null,
  );
  return (forced ?? system) ? 'dark' : 'light';
}
