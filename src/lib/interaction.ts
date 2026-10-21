import { assertEvent, assign, setup } from 'xstate';

export type InteractionState = 'idle' | 'loading' | 'ready' | 'error';

export type InteractionEvent =
  | { type: 'START' }
  | { type: 'READY' }
  | { type: 'FAIL'; message: string }
  | { type: 'RETRY' }
  | { type: 'CLOSE' }
  | { type: 'RESET' };

export const interactionMachine = setup({
  types: {
    context: {} as { error: string | null },
    events: {} as InteractionEvent,
  },
  actions: {
    clearError: assign({ error: null }),
    recordError: assign({
      error: ({ event }) => {
        assertEvent(event, 'FAIL');
        return event.message;
      },
    }),
    reset: assign({ error: null }),
  },
}).createMachine({
  id: 'interaction',
  initial: 'idle',
  context: { error: null },
  on: {
    CLOSE: { target: '#interaction.idle', actions: 'reset' },
    RESET: { target: '#interaction.idle', actions: 'reset' },
  },
  states: {
    idle: { on: { START: { target: 'loading', actions: 'clearError' } } },
    loading: {
      on: {
        READY: 'ready',
        FAIL: { target: 'error', actions: 'recordError' },
      },
    },
    ready: {
      on: {
        START: { target: 'loading', actions: 'clearError' },
        FAIL: { target: 'error', actions: 'recordError' },
      },
    },
    error: { on: { RETRY: { target: 'loading', actions: 'clearError' } } },
  },
});
