import { describe, expect, it } from 'vitest';
import { MACHINE_GAUGE_MAX } from '../../shaders/machine-shaders';
import { NEEDLE_OVER_MIN, NEEDLE_UNDER_MAX, needleFor } from './needle';

describe('needleFor: the needle shows what arrived, relative to Needs', () => {
  it('rests at zero with nothing arrived', () => {
    expect(needleFor(0, 8)).toBe(0);
  });
  it('sits on the mark when exact', () => {
    expect(needleFor(8, 8)).toBe(1);
    expect(needleFor(20, 20)).toBe(1);
  });
  it('stays short of the mark when under, in proportion', () => {
    expect(needleFor(4, 8)).toBeCloseTo(0.5);
    expect(needleFor(39, 40)).toBe(NEEDLE_UNDER_MAX);
  });
  it('goes into the red when over, pinned at the stop', () => {
    expect(needleFor(41, 40)).toBe(NEEDLE_OVER_MIN);
    expect(needleFor(9, 8)).toBeCloseTo(1.125);
    expect(needleFor(16, 8)).toBe(MACHINE_GAUGE_MAX);
  });
  it('orders under < exact < over', () => {
    expect(needleFor(7, 8)).toBeLessThan(needleFor(8, 8));
    expect(needleFor(8, 8)).toBeLessThan(needleFor(9, 8));
  });
});
