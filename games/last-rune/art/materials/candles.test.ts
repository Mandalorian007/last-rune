import { describe, expect, it } from 'vitest';
import { candleBreath } from './candles';

function sample(seed: number, calm: boolean) {
  const out: number[] = [];
  for (let i = 0; i < 60 * 60; i++) out.push(candleBreath(i / 60, seed, calm));
  return out;
}

describe('candleBreath', () => {
  it('breathes in 0.7..1 around 0.85, with no pops between frames', () => {
    for (const seed of [1, 3, 4, 11.5]) {
      const v = sample(seed, false);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      expect(Math.min(...v)).toBeGreaterThanOrEqual(0.7);
      expect(Math.max(...v)).toBeLessThanOrEqual(1);
      expect(mean).toBeGreaterThan(0.8);
      expect(mean).toBeLessThan(0.9);
      // It moves (a visible swell) ...
      expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.08);
      // ... but smoothly: no frame-to-frame jump a viewer would read as a strobe or pop.
      let jump = 0;
      for (let i = 1; i < v.length; i++) jump = Math.max(jump, Math.abs(v[i]! - v[i - 1]!));
      expect(jump).toBeLessThan(0.02);
    }
  });

  it('holds a steady, very slow level when calm (reduced motion / flashes)', () => {
    const v = sample(4, true);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0.92);
    let jump = 0;
    for (let i = 1; i < v.length; i++) jump = Math.max(jump, Math.abs(v[i]! - v[i - 1]!));
    expect(jump).toBeLessThan(0.002);
  });
});
