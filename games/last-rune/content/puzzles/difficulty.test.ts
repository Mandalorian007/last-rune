import { describe, expect, it } from 'vitest';
import {
  analyseSolution,
  measure,
  minutesFor,
  noviceBot,
  scoreOf,
  turnLoadOf,
} from '../../rules/difficulty';
import type { GemKind } from '../../rules/types';
import { MACHINE_IDS } from '../../rules/types';
import { PUZZLES } from './index';
import { TARGETS } from './targets';

// Set FULL=1 to measure every puzzle against the target curve (about half a minute).
const FULL = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .FULL;

describe('analyseSolution', () => {
  it('sees the bank and the late wake in the capacitor tutorial', () => {
    const p = PUZZLES['capacitor-bay'];
    const f = analyseSolution(p, p.design.intended);
    expect(f.markers).toContain('bank');
    expect(f.markers).toContain('late-wake');
    expect(f.markers).not.toContain('gate');
  });

  it('sees the merge in the crane', () => {
    const p = PUZZLES.crane;
    const f = analyseSolution(p, p.design.intended);
    expect(f.markers).toContain('gate');
  });

  it('sees a route around a pre-set gem', () => {
    const p = PUZZLES['control-booth'];
    expect(analyseSolution(p, p.design.intended).markers).toContain('avoid-fixed');
  });
});

describe('turnLoadOf', () => {
  it('weighs Splits and Gates over Bends and ignores gems that do not turn (D-031)', () => {
    const at = (gem: GemKind) => ({ gem, cell: { x: 0, y: 0 }, rot: 0 as const });
    expect(turnLoadOf([at('channel'), at('amplify'), at('capacitor')])).toBe(0);
    expect(turnLoadOf([at('bend'), at('bend')])).toBe(1);
    expect(turnLoadOf([at('split'), at('gate'), at('bend')])).toBe(2.5);
  });
});

describe('noviceBot', () => {
  it('solves the tutorial on its first try', () => {
    const r = noviceBot(PUZZLES['intake-desk'], { sessions: 4 });
    expect(r.solved).toBe(4);
    expect(r.expected).toBe(1);
  });

  it('is deterministic for a seed', () => {
    const a = noviceBot(PUZZLES['splitter-mill'], { sessions: 3, seed: 7 });
    const b = noviceBot(PUZZLES['splitter-mill'], { sessions: 3, seed: 7 });
    expect(a).toEqual(b);
  });

  it('reports every attempt', () => {
    let n = 0;
    const r = noviceBot(PUZZLES.furnace, { sessions: 1, onAttempt: () => n++ });
    expect(n).toBe(r.fails.dead + r.fails.under + r.fails.over + r.solved);
  });
});

describe('scoreOf', () => {
  const base = { bot: { expected: 4 }, searchBits: 8, concepts: 2, minGems: 10, solutions: 2 };

  it('grows with each difficulty term and shrinks with looseness', () => {
    const s = scoreOf(base);
    expect(scoreOf({ ...base, bot: { expected: 64 } })).toBeGreaterThan(s);
    expect(scoreOf({ ...base, searchBits: 12 })).toBeGreaterThan(s);
    expect(scoreOf({ ...base, concepts: 4 })).toBeGreaterThan(s);
    expect(scoreOf({ ...base, minGems: 20 })).toBeGreaterThan(s);
    expect(scoreOf({ ...base, solutions: 64 })).toBeLessThan(s);
    expect(scoreOf({ ...base, turnLoad: 5 })).toBeGreaterThan(s);
  });

  it('reads as minutes, at least one', () => {
    expect(minutesFor(0.2)).toBe(1);
    expect(minutesFor(3.3)).toBe(3.5);
  });
});

describe('target curve', () => {
  it('has a band for every machine, rising by tier, finale on top', () => {
    const tiers = MACHINE_IDS.map((id) => TARGETS[id].tier);
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]!).toBeGreaterThanOrEqual(tiers[i - 1]!);
    const finale = TARGETS['the-last-rune'].score;
    for (const id of MACHINE_IDS) {
      const [lo, hi] = TARGETS[id].score;
      expect(lo).toBeLessThan(hi);
      if (id !== 'the-last-rune') expect(lo).toBeLessThan(finale[0]);
    }
  });

  it.skipIf(!FULL)(
    'every puzzle scores inside its band, and the finale scores highest',
    () => {
      const scores = MACHINE_IDS.map((id) => measure(PUZZLES[id]).score);
      MACHINE_IDS.forEach((id, i) => {
        const [lo, hi] = TARGETS[id].score;
        expect([id, scores[i]! >= lo && scores[i]! <= hi]).toEqual([id, true]);
      });
      expect(Math.max(...scores)).toBe(scores.at(-1));
    },
    120_000,
  );
});
