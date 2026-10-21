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
  return useMedia('(prefers-color-scheme: dark)') ? 'dark' : 'light';
}
