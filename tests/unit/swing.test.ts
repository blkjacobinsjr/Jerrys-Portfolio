import { describe, expect, it } from 'vitest';
import { atRest, MAX_DT, step, still, SWING, type Swing } from '../../src/lib/swing';

const run = (swing: Swing, seconds: number, torque = 0) => {
  let s = swing;
  for (let t = 0; t < seconds; t += 1 / 60) s = step(s, torque, 1 / 60);
  return s;
};

describe('swing', () => {
  it('stays still without a push', () => {
    expect(step(still, 0, 1 / 60)).toEqual({ angle: 0, velocity: 0 });
  });

  it('swings toward the push', () => {
    const pushed = step(still, 40, 1 / 60);
    expect(pushed.velocity).toBeGreaterThan(0);
    expect(pushed.angle).toBeGreaterThan(0);
    expect(step(still, -40, 1 / 60).angle).toBeLessThan(0);
  });

  it('swings back through rest and settles', () => {
    const released = { angle: 0.6, velocity: 0 };
    const soon = run(released, 0.4);
    expect(soon.angle).toBeLessThan(0.6);
    const later = run(released, 8);
    expect(atRest(later)).toBe(true);
  });

  it('overshoots like a pendulum instead of creeping back', () => {
    let s: Swing = { angle: 0.5, velocity: 0 };
    let minAngle = Infinity;
    for (let i = 0; i < 120; i++) {
      s = step(s, 0, 1 / 60);
      minAngle = Math.min(minAngle, s.angle);
    }
    expect(minAngle).toBeLessThan(0);
  });

  it('never swings past its limit, and stops dead there', () => {
    const flung = step({ angle: 1.09, velocity: 50 }, 0, 1 / 60);
    expect(flung.angle).toBe(SWING.limit);
    expect(flung.velocity).toBe(0);
    expect(step({ angle: -1.09, velocity: -50 }, 0, 1 / 60).angle).toBe(-SWING.limit);
  });

  it('caps long frames so a backgrounded tab does not explode the motion', () => {
    const capped = step(still, 30, 5);
    const one = step(still, 30, MAX_DT);
    expect(capped).toEqual(one);
    expect(step(still, 30, -1)).toEqual(still);
  });

  it('damping drains energy', () => {
    const loose = run({ angle: 0.5, velocity: 0 }, 2);
    const stiff = { stiffness: 26, damping: 8, limit: 1.1 };
    let s: Swing = { angle: 0.5, velocity: 0 };
    for (let t = 0; t < 2; t += 1 / 60) s = step(s, 0, 1 / 60, stiff);
    expect(Math.abs(s.angle) + Math.abs(s.velocity)).toBeLessThan(Math.abs(loose.angle) + Math.abs(loose.velocity));
  });

  it('lands exactly on the limit without being stopped there', () => {
    // 0.875 + 4 * (1/32) = 1 exactly, in binary floating point too.
    const free = { stiffness: 0, damping: 0, limit: 1 };
    expect(step({ angle: 0.875, velocity: 4 }, 0, 1 / 32, free)).toEqual({ angle: 1, velocity: 4 });
  });

  it('counts the exact epsilon as still moving', () => {
    expect(atRest({ angle: 0.5, velocity: 0 }, 0.5)).toBe(false);
    expect(atRest({ angle: 0, velocity: 0.5 }, 0.5)).toBe(false);
  });

  it('atRest respects its epsilon', () => {
    expect(atRest({ angle: 0.0009, velocity: 0.0009 })).toBe(true);
    expect(atRest({ angle: 0.002, velocity: 0 })).toBe(false);
    expect(atRest({ angle: 0, velocity: 0.002 })).toBe(false);
    expect(atRest({ angle: 0.002, velocity: 0 }, 0.01)).toBe(true);
  });
});
