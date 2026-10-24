import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { canUseGL } from '../lib/gl';
import { useColorScheme } from '../lib/useMedia';
import './FooterGhost.css';

// The WebGL code is its own chunk: it is fetched only after every gate below passes.
const GhostCursor = lazy(() => import('./GhostCursor'));

/**
 * Berlin skyline footer: a ghost trail follows the pointer. Hydrated by `client:visible`, but the WebGL
 * chunk, canvas and RAF loop wait for the first real mouse move over the footer (`armed`), so scrolling
 * past it costs nothing. Skipped for reduced motion, save-data, coarse pointers
 * and browsers without WebGL2 (`canUseGL`). The layer is absolute and pointer-events none: no layout shift.
 * The empty slot is rendered on the server so `client:visible` has a box to observe.
 */
/** `host` is the element whose first mouse move arms the trail: the footer, or the enter screen (ENTER_SCREEN). */
export default function FooterGhost({ host = 'footer' }: { host?: string }) {
  const [on, setOn] = useState(false);
  const [armed, setArmed] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const scheme = useColorScheme();
  useEffect(() => setOn(!matchMedia('(pointer: coarse)').matches && canUseGL()), []);
  useEffect(() => {
    const footer = slot.current?.closest<HTMLElement>(host);
    if (!on || !footer) return;
    const arm = (e: PointerEvent) => e.pointerType === 'mouse' && setArmed(true);
    footer.addEventListener('pointermove', arm, { passive: true, once: true });
    return () => footer.removeEventListener('pointermove', arm);
  }, [on, host]);
  const dark = scheme === 'dark';
  return (
    <div ref={slot} className="footer-ghost" aria-hidden="true">
      {on && armed && (
        <Suspense fallback={null}>
          <GhostCursor theme={dark ? 'dark' : 'light'} color="#FFFFFF" brightness={0.8} turbulence={0.7} grainIntensity={0} bloomStrength={0.3} zIndex={0} intro={false} maxDevicePixelRatio={1} targetPixels={3e5} />
        </Suspense>
      )}
    </div>
  );
}
