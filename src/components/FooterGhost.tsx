import { lazy, Suspense, useEffect, useState } from 'react';
import { canUseGL } from '../lib/gl';
import { useColorScheme } from '../lib/useMedia';
import './FooterGhost.css';

// The WebGL code is its own chunk: it is fetched only after every gate below passes.
const GhostCursor = lazy(() => import('./GhostCursor'));

/**
 * Berlin skyline footer: a ghost trail follows the pointer. Hydrated by `client:visible`, so nothing
 * loads until the footer nears the viewport. Skipped for reduced motion, save-data, coarse pointers
 * and browsers without WebGL2 (`canUseGL`). The layer is absolute and pointer-events none: no layout shift.
 * The empty slot is rendered on the server so `client:visible` has a box to observe.
 */
export default function FooterGhost() {
  const [on, setOn] = useState(false);
  const scheme = useColorScheme();
  useEffect(() => setOn(!matchMedia('(pointer: coarse)').matches && canUseGL()), []);
  const dark = scheme === 'dark';
  return (
    <div className="footer-ghost" aria-hidden="true">
      {on && (
        <Suspense fallback={null}>
          <GhostCursor theme={dark ? 'dark' : 'light'} color={dark ? '#B497CF' : '#E0662E'} zIndex={0} />
        </Suspense>
      )}
    </div>
  );
}
