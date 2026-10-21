import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Sheet, type DetentSpec } from 'scrollsheet/auto';
import '../styles/sheet.css';
import './PathSheet.css';
import { useMedia } from '../lib/useMedia';
import { useMachine } from '@xstate/react';
import { interactionMachine, type InteractionState } from '../lib/interaction';
import OptionWheel from './OptionWheel';
import ModelLoader from './ModelLoader';

export interface Picture {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
}

export interface StopView {
  id: string;
  code: string;
  when: string;
  place: string;
  title: string;
  where: string;
  notes: string[];
  glow: string;
  story?: string;
  model: Picture;
  photos: Picture[];
  link?: { href: string; label: string };
  badge?: { front: string; back: string; strap: string };
  modelKind?: 'desk';
}

const PHONE_DETENTS: DetentSpec[] = [0.72, 'full'];
const DRAWER_DETENTS: DetentSpec[] = ['520px'];
const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * One drawer for every stop on the path. The strip's buttons carry
 * `data-stop`; a delegated click opens this sheet with that stop, the same
 * drawer the work cards use, with the building standing in it as a model.
 */
export default function PathSheet({ stops }: { stops: StopView[] }) {
  const [open, setOpen] = useState(false);
  const [drawerSnapshot, sendDrawer, drawerActor] = useMachine(interactionMachine);
  const [id, setId] = useState<string | null>(null);
  // Bumped on every open from the strip, so the wheel starts on that stop.
  const [visit, setVisit] = useState(0);
  const desktop = useMedia('(min-width: 768px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const model = useRef<HTMLImageElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const startDrawer = useCallback(() => {
    sendDrawer({ type: drawerActor.getSnapshot().matches('error') ? 'RETRY' : 'START' });
  }, [drawerActor, sendDrawer]);
  const changeDrawerOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (next) startDrawer();
    else sendDrawer({ type: 'CLOSE' });
  }, [sendDrawer, startDrawer]);
  const reportDrawerState = useCallback((state: InteractionState) => {
    if (state === 'loading') startDrawer();
    else if (state === 'ready') sendDrawer({ type: 'READY' });
    else if (state === 'error') sendDrawer({ type: 'FAIL', message: 'The selected preview could not be started.' });
  }, [sendDrawer, startDrawer]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>('[data-stop]');
      if (!button?.dataset.stop) return;
      setId(button.dataset.stop);
      setVisit((n) => n + 1);
      changeDrawerOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      clearTimeout(settle.current);
    };
  }, [changeDrawerOpen]);

  // The wheel reports every stop it passes; switch once it comes to rest.
  const pick = (index: number) => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      startDrawer();
      setId(stops[index]?.id ?? null);
    }, 180);
  };

  // A fine pointer turns the model a few degrees, like picking it up off a shelf.
  const tilt = (event: PointerEvent<HTMLElement>) => {
    const img = model.current;
    if (!img || reduced || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    img.style.setProperty('--ry', `${-14 + x * 16}deg`);
    img.style.setProperty('--rx', `${10 - y * 12}deg`);
  };
  const untilt = () => {
    model.current?.style.removeProperty('--ry');
    model.current?.style.removeProperty('--rx');
  };

  const stop = stops.find((s) => s.id === id);
  const labels = useMemo(() => stops.map((s) => `${s.when} · ${s.place}`), [stops]);

  return (
    <Sheet.Root open={open} onOpenChange={changeDrawerOpen} side="bottom" desktopSide="right" detents={desktop ? DRAWER_DETENTS : PHONE_DETENTS}>
      <Sheet.Content className="sheet path-sheet" style={{ '--glow': stop?.glow } as CSSProperties}>
        <Sheet.Handle />
        <Sheet.Close />
        {stop && (
          <div className="sheet-body" data-state={open ? 'open' : 'closed'} data-drawer-state={open ? drawerSnapshot.value : 'idle'}>
            {stop.modelKind === 'desk' && open ? (
              <figure key={`${stop.id}-desk`} className="model model-interactive">
                <span className="model-glow" aria-hidden="true" />
                <ModelLoader
                  kind="desk"
                  image={stop.model.src}
                  alt={stop.model.alt}
                  onStateChange={reportDrawerState}
                />
                <figcaption className="sr-only">A spinnable relief of my Berlin desk. Drag to turn it, or use the rotation buttons.</figcaption>
              </figure>
            ) : stop.badge && open ? (
              // The badge, recreated from the photos, hangs on its buildspace lanyard: drag it, flip it.
              <figure key={`${stop.id}-badge`} className="model model-interactive model-badge">
                <span className="model-glow" aria-hidden="true" />
                <ModelLoader
                  kind="lanyard"
                  image={stop.badge.front}
                  alt="Buildspace badge"
                  options={{
                    frontImage: stop.badge.front,
                    backImage: stop.badge.back,
                    strapImage: stop.badge.strap,
                    strapColor: '#111111',
                    finish: 'glossy',
                    metal: 'silver',
                    cornerRadius: 0.25,
                    size: 0.62,
                    strapLength: 0.42,
                    breeze: 0
                  }}
                  onStateChange={reportDrawerState}
                />
                <figcaption className="sr-only">
                  My nights and weekends season 5 badge, recreated in 3D on a buildspace lanyard. The back is my grad badge.
                </figcaption>
                <span className="model-code" aria-hidden="true">
                  {stop.code}
                </span>
              </figure>
            ) : (
              <figure key={stop.id} className="model" onPointerMove={tilt} onPointerLeave={untilt}>
              <span className="model-glow" aria-hidden="true" />
              <span className="model-floor" aria-hidden="true" />
              <img
                ref={model}
                src={stop.model.src}
                srcSet={stop.model.srcset}
                sizes="(min-width: 768px) 340px, 78vw"
                width={stop.model.width}
                height={stop.model.height}
                alt={stop.model.alt}
                decoding="async"
                onLoad={() => { if (open) reportDrawerState('ready'); }}
                onError={() => { if (open) reportDrawerState('error'); }}
              />
              <span className="model-code" aria-hidden="true">
                {stop.code}
              </span>
            </figure>
            )}

            <header key={`${stop.id}-caption`} className="model-caption" style={stagger(1)}>
              <Sheet.Title className="detail-title">{stop.place}</Sheet.Title>
              <Sheet.Description className="model-role">{stop.title}</Sheet.Description>
              <p className="model-meta">
                {stop.when}, {stop.where}
              </p>
            </header>

            <nav className="model-wheel" aria-label="Before and after">
              <OptionWheel
                key={visit}
                items={labels}
                defaultSelected={stops.indexOf(stop)}
                onChange={pick}
                ariaLabel="Stops on the path"
                textColor="var(--fg)"
                activeColor="var(--fg)"
                fontSize={1.0625}
                spacing={1.75}
                tilt={0}
                blur={reduced ? 0 : 1}
                fade={0.38}
                minOpacity={0}
                smoothing={reduced ? 1 : 200}
                inset={0}
                active={open}
              />
            </nav>

            {stop.story && (
              <p key={`${stop.id}-story`} className="detail-story" style={stagger(2)}>
                {stop.story}
              </p>
            )}

            <ul key={`${stop.id}-notes`} className="detail-list" style={stagger(3)}>
              {stop.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            {stop.photos.length > 0 && (
              <div
                key={`${stop.id}-photos`}
                className="detail-gallery"
                style={stagger(4)}
                data-scrollsheet-nested-scroll
                tabIndex={0}
                role="group"
                aria-label={`${stop.place} photos`}
              >
                {stop.photos.map((photo) => (
                  <img
                    key={photo.src}
                    src={photo.src}
                    srcSet={photo.srcset}
                    sizes="(min-width: 768px) 420px, 82vw"
                    width={photo.width}
                    height={photo.height}
                    alt={photo.alt}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            )}

            {stop.link && (
              <a key={`${stop.id}-link`} className="pill-link detail-visit" style={stagger(5)} href={stop.link.href} target="_blank" rel="noopener">
                {stop.link.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
          </div>
        )}
      </Sheet.Content>
    </Sheet.Root>
  );
}
