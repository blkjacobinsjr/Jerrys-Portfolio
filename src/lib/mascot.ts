import { assertEvent, assign, createActor, setup } from 'xstate';

/**
 * The mascot's mood. One actor drives every view of the mascot (hero and dock),
 * so they always agree. Views only read `frameOf(snapshot)`.
 *
 * Sprite: a 4x4 grid. Cells, row-major:
 *   0 up-left   1 up      2 up-right    3 blink
 *   4 left      5 center  6 right       7 happy
 *   8 down-left 9 down   10 down-right 11 surprised
 *  12 drowsy   13 asleep 14 dizzy      15 wink
 */
export type Gaze = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

export type MascotEvent =
  | { type: 'LOOK'; gaze: Gaze }
  | { type: 'POKE' }
  | { type: 'FAST_SCROLL' };

export const timing = {
  blinkEvery: 4200,
  blinkFor: 140,
  drowsyAfter: 14000,
  asleepAfter: 9000,
  startledFor: 700,
  happyFor: 900,
  dizzyFor: 1400,
  winkFor: 1100,
} as const;

export const mascotMachine = setup({
  types: {
    context: {} as { gaze: Gaze; pokes: number },
    events: {} as MascotEvent,
  },
  actions: {
    look: assign({
      gaze: ({ event }) => {
        assertEvent(event, 'LOOK');
        return event.gaze;
      },
    }),
    countPoke: assign({ pokes: ({ context }) => context.pokes + 1 }),
    resetPokes: assign({ pokes: 0 }),
  },
  guards: {
    thirdPoke: ({ context }) => context.pokes >= 2,
  },
  delays: timing,
}).createMachine({
  id: 'mascot',
  context: { gaze: { x: 0, y: 0 }, pokes: 0 },
  initial: 'watching',
  states: {
    watching: {
      type: 'parallel',
      states: {
        eyes: {
          initial: 'open',
          states: {
            open: { after: { blinkEvery: 'blink' } },
            blink: { after: { blinkFor: 'open' } },
          },
        },
        // Any LOOK updates the gaze and restarts the idle countdown without touching the blink cycle.
        idle: {
          initial: 'counting',
          states: {
            counting: {
              after: { drowsyAfter: '#mascot.drowsy' },
              on: { LOOK: { target: 'counting', reenter: true, actions: 'look' } },
            },
          },
        },
      },
      on: {
        POKE: [
          { guard: 'thirdPoke', target: 'wink', actions: 'resetPokes' },
          { target: 'happy', actions: 'countPoke' },
        ],
        FAST_SCROLL: 'dizzy',
      },
    },
    happy: {
      after: { happyFor: 'watching' },
      on: {
        POKE: [
          { guard: 'thirdPoke', target: 'wink', actions: 'resetPokes' },
          { target: 'happy', reenter: true, actions: 'countPoke' },
        ],
      },
    },
    wink: { after: { winkFor: 'watching' } },
    dizzy: { after: { dizzyFor: 'watching' } },
    drowsy: {
      after: { asleepAfter: 'asleep' },
      on: {
        LOOK: { target: 'watching', actions: 'look' },
        POKE: { target: 'watching', actions: 'resetPokes' },
        FAST_SCROLL: 'dizzy',
      },
    },
    asleep: {
      on: {
        LOOK: { target: 'startled', actions: 'look' },
        POKE: 'startled',
        FAST_SCROLL: 'startled',
      },
    },
    startled: { after: { startledFor: 'watching' } },
  },
});

type Snapshot = ReturnType<ReturnType<typeof createActor<typeof mascotMachine>>['getSnapshot']>;

/** Sprite cell per mood; watching is computed from the gaze instead. */
const MOOD_CELL = { happy: 7, startled: 11, drowsy: 12, asleep: 13, dizzy: 14, wink: 15 } as const;

export function frameOf(snapshot: Pick<Snapshot, 'matches' | 'context' | 'value'>): number {
  if (snapshot.matches('watching')) {
    if (snapshot.matches({ watching: { eyes: 'blink' } })) return 3;
    // The 3x3 gaze grid sits in the first three columns of a 4-wide sheet.
    const { x, y } = snapshot.context.gaze;
    return (y + 1) * 4 + (x + 1);
  }
  return MOOD_CELL[snapshot.value as keyof typeof MOOD_CELL];
}

/**
 * Pointer offset from the mascot, in px, to a 3x3 gaze cell. The dead zone has
 * hysteresis so the eyes do not flicker when the pointer rests on a boundary.
 */
export function gazeFrom(dx: number, dy: number, previous: Gaze, deadZone = 48): Gaze {
  const axis = (d: number, prev: -1 | 0 | 1): -1 | 0 | 1 => {
    const enter = deadZone;
    const leave = deadZone * 0.6;
    if (prev !== 0 && Math.sign(d) === prev && Math.abs(d) > leave) return prev;
    if (Math.abs(d) > enter) return d > 0 ? 1 : -1;
    return 0;
  };
  return { x: axis(dx, previous.x), y: axis(dy, previous.y) };
}

let shared: ReturnType<typeof createActor<typeof mascotMachine>> | undefined;

/** One running actor per page, shared by every mascot view. */
export function mascotActor() {
  shared ??= createActor(mascotMachine).start();
  return shared;
}
