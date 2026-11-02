import { describe, expect, it } from 'vitest';
import { altarDims, type PuzzleDef } from '../../rules/model';
import { simulate } from '../../rules/sim';
import { MACHINE_IDS } from '../../rules/types';
import { puzzleProblems } from '../../rules/validate';
import { GUARANTEED } from './expectations';
import { PUZZLES } from './index';

const all = MACHINE_IDS.map((id) => [id, PUZZLES[id]] as const);

const capKey = (c: PuzzleDef['design']['assumes'][number]) =>
  c.type === 'gem'
    ? `gem:${c.gem}`
    : c.type === 'storm'
      ? `storm:${c.strength}`
      : `altar:${c.size}`;

describe('puzzle set', () => {
  it('has one puzzle per machine, keyed by its own id', () => {
    expect(Object.keys(PUZZLES).sort()).toEqual([...MACHINE_IDS].sort());
    for (const [id, p] of all) expect(p.id).toBe(id);
  });

  it('ramps from a one-minute tutorial to an eight-minute finale', () => {
    const minutes = all.map(([, p]) => p.design.minutes);
    expect(minutes[0]).toBe(1);
    expect(minutes.at(-1)).toBe(8);
    expect(Math.max(...minutes)).toBe(8);
  });

  it('uses the 10x8 altar only for the finale', () => {
    for (const [id, p] of all) expect(p.altar === '10x8').toBe(id === 'the-last-rune');
  });
});

describe.each(all)('%s', (id, p) => {
  it('is well-formed', () => {
    expect(puzzleProblems(p)).toEqual([]);
    expect(p.design.insight.length).toBeGreaterThan(10);
  });

  it('assumes only capabilities the player is guaranteed', () => {
    const have = new Set(GUARANTEED[id].map(capKey));
    for (const c of p.design.assumes) expect(have, capKey(c)).toContain(capKey(c));
  });

  it('needs nothing it does not assume', () => {
    const assumed = new Set(p.design.assumes.map(capKey));
    for (const [g, n] of Object.entries(p.tray))
      if (g !== 'channel' && (n ?? 0) > 0) expect(assumed, g).toContain(`gem:${g}`);
    if (p.storm.strength > 1) expect(assumed).toContain(`storm:${p.storm.strength}`);
    if (p.altar !== '6x4') expect(assumed).toContain(`altar:${p.altar}`);
    if (p.pulses > 1)
      expect(p.tray.capacitor || p.fixed.some((f) => f.gem === 'capacitor')).toBeTruthy();
  });

  it('declares essential gems that are in the tray', () => {
    for (const g of p.design.essential) expect(p.tray[g] ?? 0, g).toBeGreaterThan(0);
  });

  it('is not open: needs at least one placed gem, and an empty altar does nothing', () => {
    expect(p.design.intended.length).toBeGreaterThan(0);
    expect(simulate(p, []).outcome).not.toBe('exact');
  });

  it('wakes every machine with the intended solution', () => {
    const r = simulate(p, p.design.intended);
    expect(r.outcome).toBe('exact');
    for (const m of r.machines) expect(m.outcome).toBe('exact');
  });

  it('produces a well-formed trace for the intended solution', () => {
    const r = simulate(p, p.design.intended);
    const { w, h } = altarDims(p.altar);
    const inside = (c: { x: number; y: number }) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h;
    expect(r.trace.length).toBeGreaterThan(0);
    let last = 0;
    for (const s of r.trace) {
      expect(Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y)).toBe(1);
      expect(s.t0).toBeGreaterThanOrEqual(0);
      expect(s.t1).toBeLessThanOrEqual(1);
      expect(s.t1).toBeGreaterThan(s.t0);
      expect(s.charge).toBeGreaterThan(0);
      expect(s.pulse).toBeLessThan(r.pulsesRun);
      expect(s.t0).toBeGreaterThanOrEqual(last - 1e-9 - 1 / r.duration);
      last = Math.max(last, s.t0);
      if (s.end === 'machine' || s.end === 'ground') expect(inside(s.to)).toBe(false);
      else expect(inside(s.to)).toBe(true);
    }
    // Every machine reading is the sum of its incoming segments on that strike.
    for (const m of r.machines) {
      m.readings.forEach((v, pulse) => {
        const sum = r.trace
          .filter((s) => s.pulse === pulse && s.end === 'machine')
          .filter((s) => s.to.x === m.at.x && s.to.y === m.at.y)
          .reduce((a, s) => a + s.charge, 0);
        expect(sum).toBe(v);
      });
    }
  });
});
