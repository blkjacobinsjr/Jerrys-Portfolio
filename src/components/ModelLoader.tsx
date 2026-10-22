import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMachine } from '@xstate/react';
import { interactionMachine, type InteractionState } from '../lib/interaction';
import type { LanyardProps } from './Lanyard';
import './ModelLoader.css';

type DeskComponent = typeof import('./Desk').default;
type LanyardComponent = typeof import('./Lanyard').default;

type LoadedModel =
  | { kind: 'desk'; Component: DeskComponent }
  | { kind: 'lanyard'; Component: LanyardComponent };

type SharedProps = {
  image: string;
  alt: string;
  onStateChange?: (state: InteractionState) => void;
};

type ModelLoaderProps =
  | (SharedProps & { kind: 'desk' })
  | (SharedProps & { kind: 'lanyard'; options: LanyardProps });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The interactive model could not be loaded.';
}

export default function ModelLoader(props: ModelLoaderProps) {
  const [snapshot, send] = useMachine(interactionMachine);
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const state = snapshot.value;

  useEffect(() => {
    send({ type: 'START' });
  }, [send]);

  useEffect(() => {
    props.onStateChange?.(state);
  }, [props.onStateChange, state]);

  useEffect(() => {
    if (!snapshot.matches('loading')) return undefined;
    const controller = new AbortController();
    const load = async () => {
      if (props.kind === 'desk') {
        const module = await import('./Desk');
        if (!controller.signal.aborted) setLoaded({ kind: 'desk', Component: module.default });
        return;
      }
      const module = await import('./Lanyard');
      if (!controller.signal.aborted) setLoaded({ kind: 'lanyard', Component: module.default });
    };
    void load().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        send({ type: 'FAIL', message: errorMessage(error) });
      }
    });
    return () => controller.abort();
  }, [props.kind, send, snapshot.value]);

  const activeLoad = snapshot.matches('loading') || snapshot.matches('ready');
  const current = loaded?.kind === props.kind && activeLoad ? loaded : null;
  const ready = useCallback(() => send({ type: 'READY' }), [send]);
  const failed = useCallback(() => {
    send({ type: 'FAIL', message: 'The interactive model could not be started.' });
  }, [send]);

  let renderer: ReactNode = null;
  if (current?.kind === 'desk' && props.kind === 'desk') {
    const Desk = current.Component;
    renderer = <Desk image={props.image} alt={props.alt} onReady={ready} onError={failed} />;
  } else if (current?.kind === 'lanyard' && props.kind === 'lanyard') {
    const Lanyard = current.Component;
    renderer = <Lanyard {...props.options} onReady={ready} onError={failed} />;
  }

  return (
    <div className="model-loader" data-model-state={state} data-drawer-state={state} aria-busy={snapshot.matches('loading')}>
      {!renderer && <img className="model-loader__fallback" src={props.image} alt={props.alt} decoding="async" onError={failed} />}
      {renderer && <div className="model-loader__content">{renderer}</div>}
      {snapshot.matches('loading') && <span className="model-loader__status" role="status">Loading interactive model…</span>}
      {snapshot.matches('error') && (
        <div className="model-loader__error" role="alert">
          <span>{snapshot.context.error || 'The interactive model could not be loaded.'}</span>
          <button
            type="button"
            onClick={() => {
              setLoaded(null);
              send({ type: 'RETRY' });
            }}
          >
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      )}
    </div>
  );
}
