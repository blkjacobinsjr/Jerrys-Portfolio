import { describe, expect, it } from 'vitest';
import { arcOf, edgeFade } from '../../src/lib/path-gallery';
import { path } from '../../src/data/site';

describe('path gallery', () => {
  it('bends the strip like an arc: flat in the middle, outer stops lower and tilted away', () => {
    expect(arcOf(0, 1440, 470, 2.2)).toEqual({ y: -0, angle: -0 });
    const right = arcOf(500, 1440, 470, 2.2);
    const left = arcOf(-500, 1440, 470, 2.2);
    expect(right.y).toBeLessThan(0);
    expect(left.y).toBeCloseTo(right.y);
    expect(left.angle).toBeCloseTo(-right.angle);
    expect(Math.abs(arcOf(700, 1440, 470, 2.2).y)).toBeGreaterThan(Math.abs(right.y));
    expect(arcOf(500, 1440, 470, 0)).toEqual({ y: 0, angle: 0 });
  });

  it('fades only at the canvas edges', () => {
    expect(edgeFade(0, 0.1)).toBe(0);
    expect(edgeFade(1, 0.1)).toBe(0);
    expect(edgeFade(0.5, 0.1)).toBe(1);
    expect(edgeFade(0.5, 0)).toBe(1);
  });

  it('keeps the path oldest first, from 2013 to Now, so the ends never meet', () => {
    expect(path[0]).toMatchObject({ id: 'coventry', when: '2013' });
    expect(path.at(-1)).toMatchObject({ id: 'scenaryo', when: 'Now', flag: 'now' });
  });
});
