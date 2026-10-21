import { createActor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { interactionMachine } from '../../src/lib/interaction';

function start() {
  const actor = createActor(interactionMachine).start();
  return { actor, state: () => actor.getSnapshot().value };
}

describe('interaction lifecycle', () => {
  it('starts idle and enters loading when opened', () => {
    const { actor, state } = start();

    expect(state()).toBe('idle');
    actor.send({ type: 'START' });
    expect(state()).toBe('loading');
  });

  it('becomes ready after its resource is usable', () => {
    const { actor, state } = start();
    actor.send({ type: 'START' });
    actor.send({ type: 'READY' });

    expect(state()).toBe('ready');
    expect(actor.getSnapshot().context.error).toBeNull();
  });

  it('returns from ready to loading when an interaction starts again', () => {
    const { actor, state } = start();
    actor.send({ type: 'START' });
    actor.send({ type: 'READY' });
    actor.send({ type: 'START' });

    expect(state()).toBe('loading');
  });

  it('records failures from loading or ready and retries from error', () => {
    for (const failureState of ['loading', 'ready'] as const) {
      const { actor, state } = start();
      actor.send({ type: 'START' });
      if (failureState === 'ready') actor.send({ type: 'READY' });
      actor.send({ type: 'FAIL', message: 'Renderer unavailable' });

      expect(state()).toBe('error');
      expect(actor.getSnapshot().context.error).toBe('Renderer unavailable');
      actor.send({ type: 'RETRY' });
      expect(state()).toBe('loading');
      expect(actor.getSnapshot().context.error).toBeNull();
    }
  });

  it('closes loading, ready, and error states back to clean idle', () => {
    for (const priorState of ['loading', 'ready', 'error'] as const) {
      const { actor, state } = start();
      actor.send({ type: 'START' });
      if (priorState !== 'loading') actor.send({ type: 'READY' });
      if (priorState === 'error') actor.send({ type: 'FAIL', message: 'Renderer unavailable' });

      actor.send({ type: 'CLOSE' });
      expect(state()).toBe('idle');
      expect(actor.getSnapshot().context.error).toBeNull();
    }
  });

  it('resets every lifecycle state and ignores events that do not apply', () => {
    const idle = start();
    idle.actor.send({ type: 'READY' });
    idle.actor.send({ type: 'RESET' });
    expect(idle.state()).toBe('idle');
    expect(idle.actor.getSnapshot().context.error).toBeNull();

    const loading = start();
    loading.actor.send({ type: 'START' });
    loading.actor.send({ type: 'RETRY' });
    expect(loading.state()).toBe('loading');
    loading.actor.send({ type: 'RESET' });
    expect(loading.state()).toBe('idle');

    const ready = start();
    ready.actor.send({ type: 'START' });
    ready.actor.send({ type: 'READY' });
    ready.actor.send({ type: 'RESET' });
    expect(ready.state()).toBe('idle');

    const error = start();
    error.actor.send({ type: 'START' });
    error.actor.send({ type: 'FAIL', message: 'Image unavailable' });
    error.actor.send({ type: 'RESET' });
    expect(error.state()).toBe('idle');
    expect(error.actor.getSnapshot().context.error).toBeNull();
  });
});
