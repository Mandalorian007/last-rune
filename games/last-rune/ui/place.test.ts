import { describe, expect, it } from 'vitest';
import { clampInto, cost, intersects, overlap, pickSpot } from './place';

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const B = { left: 0, top: 0, right: 100, bottom: 100 };

describe('place', () => {
  it('measures overlap, touching edges excluded', () => {
    expect(overlap(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(25);
    expect(overlap(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(0);
    expect(intersects(r(0, 0, 10, 10), r(9, 9, 10, 10))).toBe(true);
    expect(intersects(r(0, 0, 10, 10), r(9, 9, 10, 10), 2)).toBe(false);
  });

  it('slides a box inside the bounds without resizing it', () => {
    expect(clampInto(r(-5, 95, 20, 10), B)).toEqual(r(0, 90, 20, 10));
    expect(clampInto(r(90, 0, 20, 10), B)).toEqual(r(80, 0, 20, 10));
  });

  it('weights what it covers', () => {
    const o = [{ rect: r(0, 0, 10, 10), weight: 3 }, { rect: r(0, 0, 10, 10) }];
    expect(cost(r(5, 5, 10, 10), o)).toBe(100);
  });

  it('takes the first clear candidate, else the cheapest', () => {
    const plate = { rect: r(40, 40, 20, 20), weight: 10 };
    const art = { rect: r(0, 0, 30, 30), weight: 1 };
    const clear = pickSpot(
      [r(45, 45, 10, 10), r(10, 10, 10, 10), r(70, 70, 10, 10)],
      [plate, art],
      B,
    );
    expect(clear?.index).toBe(2);
    const cheap = pickSpot([r(45, 45, 10, 10), r(10, 10, 10, 10)], [plate, art], B);
    expect(cheap?.index).toBe(1);
    // Off the bounds: slid back in before it is scored.
    const slid = pickSpot([r(120, 0, 10, 10)], [], B);
    expect(slid?.rect).toEqual(r(90, 0, 10, 10));
  });
});
