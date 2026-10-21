import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Sheet, type DetentSpec } from 'scrollsheet/auto';
import '../styles/sheet.css';
import './PathSheet.css';
import { useMedia } from '../lib/useMedia';

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
  const [id, setId] = useState<string | null>(null);
  const desktop = useMedia('(min-width: 768px)');
  const model = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>('[data-stop]');
      if (!button?.dataset.stop) return;
      setId(button.dataset.stop);
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // A fine pointer turns the model a few degrees, like picking it up off a shelf.
  const tilt = (event: PointerEvent<HTMLElement>) => {
    const img = model.current;
    if (!img || event.pointerType !== 'mouse') return;
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

  return (
    <Sheet.Root open={open} onOpenChange={setOpen} side="bottom" desktopSide="right" detents={desktop ? DRAWER_DETENTS : PHONE_DETENTS}>
      <Sheet.Content className="sheet path-sheet" style={{ '--glow': stop?.glow } as CSSProperties}>
        <Sheet.Handle />
        <Sheet.Close />
        {stop && (
          <div key={stop.id} className="sheet-body" data-state={open ? 'open' : 'closed'}>
            <figure className="model" onPointerMove={tilt} onPointerLeave={untilt}>
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
              />
              <span className="model-code" aria-hidden="true">
                {stop.code}
              </span>
            </figure>

            <header className="model-caption" style={stagger(1)}>
              <Sheet.Title className="detail-title">{stop.place}</Sheet.Title>
              <Sheet.Description className="model-role">{stop.title}</Sheet.Description>
              <p className="model-meta">
                {stop.when}, {stop.where}
              </p>
            </header>

            {stop.story && (
              <p className="detail-story" style={stagger(2)}>
                {stop.story}
              </p>
            )}

            <ul className="detail-list" style={stagger(3)}>
              {stop.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            {stop.photos.length > 0 && (
              <div
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
              <a className="pill-link detail-visit" style={stagger(5)} href={stop.link.href} target="_blank" rel="noopener">
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
