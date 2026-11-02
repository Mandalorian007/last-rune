import { describe, expect, it } from 'vitest';
import { puzzleFor } from '../../content/puzzles';
import { simulate } from '../../rules';
import { boltSegmentsFromTrace, TRACE_TICK_SECONDS, traceDurationTicks } from './bolt';

const toPx = (c: { x: number; y: number }) => ({ x: c.x * 100, y: c.y * 100 });

describe('boltSegmentsFromTrace timing', () => {
  it('recovers the trace length in ticks', () => {
    for (const id of ['intake-desk', 'capacitor-bay'] as const) {
      const p = puzzleFor(id);
      const r = simulate(p, p.design.intended);
      expect(traceDurationTicks(r.trace)).toBe(r.duration);
    }
    expect(traceDurationTicks([])).toBe(1);
  });

  it('maps each hop to one tick of TRACE_TICK_SECONDS by default', () => {
    const p = puzzleFor('capacitor-bay');
    const r = simulate(p, p.design.intended);
    expect(r.pulsesRun).toBe(2);
    const segs = boltSegmentsFromTrace(r.trace, toPx);
    expect(segs).toHaveLength(r.trace.length);
    segs.forEach((s, i) => {
      const t = r.trace[i]!;
      expect(s.t1 - s.t0).toBeCloseTo(TRACE_TICK_SECONDS, 9);
      expect(s.t0).toBeCloseTo(t.t0 * r.duration * TRACE_TICK_SECONDS, 9);
    });
    // The sim leaves one tick between strikes; so does the bolt.
    const p0 = segs.filter((_, i) => r.trace[i]!.pulse === 0);
    const p1 = segs.filter((_, i) => r.trace[i]!.pulse === 1);
    const gap = Math.min(...p1.map((s) => s.t0)) - Math.max(...p0.map((s) => s.t1));
    expect(gap).toBeCloseTo(TRACE_TICK_SECONDS, 9);
    expect(Math.max(...segs.map((s) => s.t1))).toBeCloseTo(r.duration * TRACE_TICK_SECONDS, 9);
  });

  it('honours tickSeconds and an explicit duration', () => {
    const p = puzzleFor('intake-desk');
    const r = simulate(p, p.design.intended);
    const a = boltSegmentsFromTrace(r.trace, toPx, { tickSeconds: 0.1 });
    const b = boltSegmentsFromTrace(r.trace, toPx, { tickSeconds: 0.1, duration: r.duration });
    expect(a.map((s) => s.t1)).toEqual(b.map((s) => s.t1));
    expect(a.at(-1)!.t1).toBeCloseTo(r.duration * 0.1, 9);
  });

  it('keeps the legacy timeScale', () => {
    const p = puzzleFor('intake-desk');
    const r = simulate(p, p.design.intended);
    const segs = boltSegmentsFromTrace(r.trace, toPx, { timeScale: 0.14 });
    segs.forEach((s, i) => {
      expect(s.t0).toBeCloseTo(r.trace[i]!.t0 * 0.14, 12);
      expect(s.t1).toBeCloseTo(r.trace[i]!.t1 * 0.14, 12);
    });
  });
});
