import { describe, expect, it } from 'vitest';
import { createActor, SimulatedClock } from 'xstate';
import { getShortestPaths } from '@xstate/graph';
import { frameOf, gazeFrom, mascotActor, mascotMachine, timing, type Gaze } from '../../src/lib/mascot';

function start() {
  const clock = new SimulatedClock();
  const actor = createActor(mascotMachine, { clock }).start();
  const frame = () => frameOf(actor.getSnapshot());
  return { clock, actor, frame };
}

describe('mascot machine', () => {
  it('starts watching straight ahead', () => {
    const { frame, actor } = start();
    expect(frame()).toBe(5);
    expect(actor.getSnapshot().matches({ watching: { eyes: 'open', idle: 'counting' } })).toBe(true);
  });

  it('maps all nine gaze cells to the 3x3 grid', () => {
    const { actor, frame } = start();
    const cells: Array<[Gaze, number]> = [
      [{ x: -1, y: -1 }, 0], [{ x: 0, y: -1 }, 1], [{ x: 1, y: -1 }, 2],
      [{ x: -1, y: 0 }, 4], [{ x: 0, y: 0 }, 5], [{ x: 1, y: 0 }, 6],
      [{ x: -1, y: 1 }, 8], [{ x: 0, y: 1 }, 9], [{ x: 1, y: 1 }, 10],
    ];
    for (const [gaze, cell] of cells) {
      actor.send({ type: 'LOOK', gaze });
      expect(frame()).toBe(cell);
    }
  });

  it('blinks on its own clock and opens again', () => {
    const { clock, frame } = start();
    clock.increment(timing.blinkEvery - 1);
    expect(frame()).toBe(5);
    clock.increment(1);
    expect(frame()).toBe(3);
    clock.increment(timing.blinkFor);
    expect(frame()).toBe(5);
  });

  it('keeps blinking while the pointer moves', () => {
    const { clock, actor, frame } = start();
    clock.increment(timing.blinkEvery - 100);
    actor.send({ type: 'LOOK', gaze: { x: 1, y: 0 } });
    clock.increment(100);
    expect(frame()).toBe(3);
  });

  it('gets drowsy, falls asleep, and is startled awake', () => {
    const { clock, actor, frame } = start();
    clock.increment(timing.drowsyAfter);
    expect(frame()).toBe(12);
    clock.increment(timing.asleepAfter);
    expect(frame()).toBe(13);
    actor.send({ type: 'LOOK', gaze: { x: -1, y: 0 } });
    expect(frame()).toBe(11);
    clock.increment(timing.startledFor);
    expect(frame()).toBe(4);
  });

  it('pointer activity postpones drowsiness', () => {
    const { clock, actor, frame } = start();
    clock.increment(timing.drowsyAfter - 1);
    actor.send({ type: 'LOOK', gaze: { x: 0, y: 0 } });
    clock.increment(timing.drowsyAfter - 1);
    expect(frame()).not.toBe(12);
    clock.increment(1);
    expect(frame()).toBe(12);
  });

  it('wakes from drowsy on a look or a poke, and gets dizzy from drowsy', () => {
    const a = start();
    a.clock.increment(timing.drowsyAfter);
    a.actor.send({ type: 'LOOK', gaze: { x: 1, y: 1 } });
    expect(a.frame()).toBe(10);
    const b = start();
    b.clock.increment(timing.drowsyAfter);
    b.actor.send({ type: 'POKE' });
    expect(b.frame()).toBe(5);
    const c = start();
    c.clock.increment(timing.drowsyAfter);
    c.actor.send({ type: 'FAST_SCROLL' });
    expect(c.frame()).toBe(14);
  });

  it('is startled out of sleep by a poke or fast scroll', () => {
    for (const type of ['POKE', 'FAST_SCROLL'] as const) {
      const { clock, actor, frame } = start();
      clock.increment(timing.drowsyAfter);
      clock.increment(timing.asleepAfter);
      actor.send({ type });
      expect(frame()).toBe(11);
    }
  });

  it('smiles when poked and winks on the third poke', () => {
    const { clock, actor, frame } = start();
    actor.send({ type: 'POKE' });
    expect(frame()).toBe(7);
    actor.send({ type: 'POKE' });
    expect(frame()).toBe(7);
    actor.send({ type: 'POKE' });
    expect(frame()).toBe(15);
    clock.increment(timing.winkFor);
    expect(frame()).toBe(5);
    actor.send({ type: 'POKE' });
    expect(frame()).toBe(7);
    clock.increment(timing.happyFor);
    expect(frame()).toBe(5);
  });

  it('counts pokes across separate happy moments', () => {
    const { clock, actor, frame } = start();
    actor.send({ type: 'POKE' });
    clock.increment(timing.happyFor);
    actor.send({ type: 'POKE' });
    clock.increment(timing.happyFor);
    actor.send({ type: 'POKE' });
    expect(frame()).toBe(15);
  });

  it('gets dizzy on fast scroll and recovers', () => {
    const { clock, actor, frame } = start();
    actor.send({ type: 'FAST_SCROLL' });
    expect(frame()).toBe(14);
    clock.increment(timing.dizzyFor);
    expect(frame()).toBe(5);
  });

  it('every reachable state shows a valid sprite cell (model-based)', () => {
    const after = (delay: keyof typeof timing, id: string) => ({ type: `xstate.after.${delay}.mascot.${id}` }) as never;
    const paths = getShortestPaths(mascotMachine, {
      events: [
        { type: 'LOOK', gaze: { x: 1, y: -1 } },
        { type: 'POKE' },
        { type: 'FAST_SCROLL' },
        after('blinkEvery', 'watching.eyes.open'),
        after('blinkFor', 'watching.eyes.blink'),
        after('drowsyAfter', 'watching.idle.counting'),
        after('asleepAfter', 'drowsy'),
        after('startledFor', 'startled'),
        after('happyFor', 'happy'),
        after('winkFor', 'wink'),
        after('dizzyFor', 'dizzy'),
      ],
    });
    const frames = new Set(paths.map((p) => frameOf(p.state)));
    const moods = new Set(paths.map((p) => JSON.stringify(p.state.value)));
    for (const frame of frames) expect(frame).toBeGreaterThanOrEqual(0), expect(frame).toBeLessThan(16);
    // Every top-level mood is reachable from the initial state.
    for (const mood of ['happy', 'wink', 'dizzy', 'drowsy', 'asleep', 'startled']) expect(moods).toContain(JSON.stringify(mood));
    expect([...moods].some((m) => m.includes('"blink"'))).toBe(true);
  });

  it('shares one running actor per page', () => {
    const actor = mascotActor();
    expect(actor).toBe(mascotActor());
    expect(frameOf(actor.getSnapshot())).toBe(5);
  });
});

describe('gazeFrom', () => {
  const center: Gaze = { x: 0, y: 0 };

  it('stays centered inside the dead zone', () => {
    expect(gazeFrom(10, -10, center, 48)).toEqual({ x: 0, y: 0 });
  });

  it('looks toward the pointer outside the dead zone', () => {
    expect(gazeFrom(100, -100, center, 48)).toEqual({ x: 1, y: -1 });
    expect(gazeFrom(-100, 100, center, 48)).toEqual({ x: -1, y: 1 });
  });

  it('uses hysteresis so a resting pointer on the edge does not flicker', () => {
    // Inside the enter threshold but past the leave threshold: keep looking.
    expect(gazeFrom(40, 0, { x: 1, y: 0 }, 48)).toEqual({ x: 1, y: 0 });
    // Past the leave threshold the other way: snap back to center.
    expect(gazeFrom(20, 0, { x: 1, y: 0 }, 48)).toEqual({ x: 0, y: 0 });
    // From the opposite side, hysteresis does not apply.
    expect(gazeFrom(40, 0, { x: -1, y: 0 }, 48)).toEqual({ x: 0, y: 0 });
  });

  it('treats the exact thresholds as inside the dead zone', () => {
    expect(gazeFrom(50, -50, center, 50)).toEqual({ x: 0, y: 0 });
    // leave = 50 * 0.6 = 30: exactly on it, the held gaze is released.
    expect(gazeFrom(30, 0, { x: 1, y: 0 }, 50)).toEqual({ x: 0, y: 0 });
    expect(gazeFrom(30.5, 0, { x: 1, y: 0 }, 50)).toEqual({ x: 1, y: 0 });
  });

  it('defaults to a 48px dead zone', () => {
    expect(gazeFrom(47, 0, center)).toEqual({ x: 0, y: 0 });
    expect(gazeFrom(49, 0, center)).toEqual({ x: 1, y: 0 });
  });
});
