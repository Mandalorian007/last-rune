import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { type PuzzleDef, simulate } from '../../rules';
import { altarDims } from '../../rules/model';
import { anchorOf, cellAt, computeLayout, DESIGN_H, DESIGN_W } from './layout';
import { buildTimeline, fizzles } from './strike';

function bench(over: Partial<PuzzleDef> = {}): PuzzleDef {
  return {
    id: 'intake-desk',
    altar: '6x4',
    blocked: [{ x: 2, y: 2 }],
    fixed: [],
    storm: { at: { x: -1, y: 1 }, dir: 'E', strength: 1 },
    machines: [{ at: { x: 6, y: 1 }, need: 4 }],
    tray: { channel: 6, bend: 2, split: 1, gate: 1 },
    pulses: 1,
    design: { insight: '', minutes: 1, assumes: [], essential: [], intended: [] },
    ...over,
  };
}

describe('strike timeline', () => {
  it('times the intended solution and ends at the machine', () => {
    const p = puzzleFor('intake-desk');
    const r = simulate(p, p.design.intended);
    expect(r.outcome).toBe('exact');
    const tl = buildTimeline(r, { tickSeconds: 0.1, verdictDelay: 0.5 });
    expect(tl.segments).toHaveLength(r.trace.length);
    for (let i = 1; i < tl.arrivals.length; i++) {
      expect(tl.arrivals[i]!.t).toBeGreaterThanOrEqual(tl.arrivals[i - 1]!.t);
    }
    const last = tl.arrivals[tl.arrivals.length - 1]!;
    expect(last.end).toBe('machine');
    expect(last.machine).toBe(0);
    expect(tl.verdictAt).toBeCloseTo(tl.pulses[0]!.end + 0.5);
    expect(tl.segments[0]!.t0).toBe(0);
  });

  it('lays strikes end to end with a gap', () => {
    const p = puzzleFor('capacitor-bay');
    const r = simulate(p, p.design.intended);
    expect(r.pulsesRun).toBe(2);
    const tl = buildTimeline(r, { tickSeconds: 0.1, pulseGap: 1 });
    expect(tl.pulses[1]!.start).toBeCloseTo(tl.pulses[0]!.end + 1);
    for (const s of tl.segments) {
      const span = tl.pulses[s.seg.pulse]!;
      expect(s.t0).toBeGreaterThanOrEqual(span.start - 1e-9);
      expect(s.t1).toBeLessThanOrEqual(span.end + 1e-9);
    }
  });
});

describe('fizzle causes', () => {
  it('empty socket on a bare altar', () => {
    const p = bench();
    const r = simulate(p, []);
    expect(r.outcome).toBe('dead');
    expect(fizzles(p, [], r)).toEqual([{ cell: { x: 0, y: 1 }, pulse: 0, cause: 'empty', t: 0 }]);
  });

  it('blocked stone, bend facing away, odd split, lone gate, grounded', () => {
    const p = bench({ blocked: [{ x: 1, y: 1 }] });
    const ch = (x: number) => ({ gem: 'channel' as const, cell: { x, y: 1 }, rot: 0 as const });
    expect(fizzles(p, [ch(0)], simulate(p, [ch(0)]))[0]!.cause).toBe('blocked');

    const q = bench();
    // Bend rot 0 accepts N and E; a bolt travelling east enters from the W.
    const bend = [{ gem: 'bend' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, bend, simulate(q, bend))[0]!.cause).toBe('facing');
    // Split rot 0 takes its bolt from the S only; fed from the W it refuses.
    const split = [{ gem: 'split' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, split, simulate(q, split))[0]!.cause).toBe('facing');

    // Gate rot 1 outputs east, inputs N and S; fed from W it refuses.
    const gate = [{ gem: 'gate' as const, cell: { x: 0, y: 1 }, rot: 1 as const }];
    expect(fizzles(q, gate, simulate(q, gate))[0]!.cause).toBe('facing');
    // Gate rot 0 outputs north, inputs E and W: one input only.
    const lone = [{ gem: 'gate' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, lone, simulate(q, lone))[0]!.cause).toBe('gate-alone');

    // A channel at the top edge pointing north runs off the altar.
    const up = [
      { gem: 'bend' as const, cell: { x: 0, y: 1 }, rot: 3 as const }, // W–N
      { gem: 'channel' as const, cell: { x: 0, y: 0 }, rot: 0 as const },
    ];
    const g = fizzles(q, up, simulate(q, up));
    expect(g[0]!.cause).toBe('ground');
  });

  it('split halves that run off or into empty sockets', () => {
    const p = bench({ tray: { split: 2, channel: 4, bend: 2 } });
    // Split (0,1) (input W) sends 2 north to split (0,0) (input S): 1 west (off the altar),
    // 1 east (empty).
    const pl = [
      { gem: 'split' as const, cell: { x: 0, y: 1 }, rot: 1 as const },
      { gem: 'split' as const, cell: { x: 0, y: 0 }, rot: 0 as const },
    ];
    const r = simulate(p, pl);
    const f = fizzles(p, pl, r);
    expect(f.map((x) => x.cause)).toContain('empty');
    expect(f.map((x) => x.cause)).toContain('ground');
  });
});

describe('layout', () => {
  it('fits every puzzle on the design canvas and round-trips cells', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      const { w, h } = altarDims(p.altar);
      expect(L.cols).toBe(w);
      expect(L.left).toBeGreaterThan(0);
      expect(L.right).toBeLessThan(DESIGN_W);
      expect(L.top).toBeGreaterThan(40);
      expect(L.frontBottom).toBeLessThan(L.trayY - 60);
      const pt = { x: 0, y: 0 };
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          anchorOf(L, { x, y }, pt);
          expect(cellAt(L, pt.x, pt.y)).toEqual({ x, y });
        }
      for (const m of [L.storm, ...L.machines]) {
        expect(m.port.x).toBeGreaterThan(0);
        expect(m.port.x).toBeLessThan(DESIGN_W);
        expect(m.port.y).toBeGreaterThan(0);
        expect(m.port.y).toBeLessThan(DESIGN_H);
      }
    }
  });
});
