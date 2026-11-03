import { describe, expect, it } from 'vitest';
import { puzzleFor } from '../../content/puzzles';
import { type Placement, simulate } from '../../rules';
import { capacitorBeats, capBeatText } from './circuit-model';
import { failText, strikeStory } from './strike';

/** The first thing a newcomer tries at Capacitor Bay: straight along the row through the ice. */
const bayRow: Placement[] = [0, 1, 2, 3, 4, 6, 7].map((x) => ({
  cell: { x, y: 2 },
  gem: 'channel',
  rot: 0,
}));

function noIce(id: 'lift-shaft' | 'roof-array'): Placement[] {
  return puzzleFor(id).design.intended.map((q) =>
    q.gem === 'capacitor' ? { ...q, gem: 'channel', rot: 0 } : q,
  );
}

describe('capacitor read-out', () => {
  it('Capacitor Bay straight row: keeps 8, then lets out 8 + 8 = 16 and trips', () => {
    const p = puzzleFor('capacitor-bay');
    const r = simulate(p, bayRow);
    expect(r.outcome).toBe('over');
    const beats = capacitorBeats(p, bayRow, r);
    expect(beats.map((b) => capBeatText(b, p.pulses))).toEqual([
      'Strike 1: keeps 8',
      'Strike 2: 8 + 8 → 16',
    ]);
    const m = r.machines.find((q) => q.outcome === 'over')!;
    expect(failText(m, 'over', p.pulses)).toBe('Breaker tripped on strike 2: needs 8, got 16');
    expect(strikeStory(p.pulses, r, beats)).toBe(
      'Strike 1: the Capacitor kept 8. Strike 2: the Capacitor let out 8 + 8 = 16.',
    );
  });

  it('Lift Shaft intended: keeps 4, then lets out 4 + 4 = 8; a win tells no story', () => {
    const p = puzzleFor('lift-shaft');
    const r = simulate(p, p.design.intended);
    expect(r.outcome).toBe('exact');
    const beats = capacitorBeats(p, p.design.intended, r);
    expect(beats.map((b) => capBeatText(b, p.pulses))).toEqual([
      'Strike 1: keeps 4',
      'Strike 2: 4 + 4 → 8',
    ]);
    expect(strikeStory(p.pulses, r, beats)).toBe('');
  });

  it('Roof Array intended: the Capacitor keeps on 1 and releases on 2', () => {
    const p = puzzleFor('roof-array');
    const r = simulate(p, p.design.intended);
    expect(r.outcome).toBe('exact');
    const beats = capacitorBeats(p, p.design.intended, r);
    expect(beats.map((b) => [b.pulse, b.kind])).toEqual([
      [0, 'keep'],
      [1, 'release'],
    ]);
  });

  it('without the ice, strikes do not add up and the verdict says so', () => {
    for (const id of ['lift-shaft', 'roof-array'] as const) {
      const p = puzzleFor(id);
      const pl = noIce(id);
      const r = simulate(p, pl);
      expect(r.outcome).not.toBe('exact');
      expect(capacitorBeats(p, pl, r)).toEqual([]);
      if (r.pulsesRun > 1)
        expect(strikeStory(p.pulses, r, [])).toBe(
          'Each strike is read on its own: strikes never add up.',
        );
    }
    const p = puzzleFor('lift-shaft');
    const r = simulate(p, noIce('lift-shaft'));
    const m = r.machines[0]!;
    expect(failText(m, 'under', p.pulses)).toBe('Not enough: needs 12, got 8 each strike');
  });

  it('a bolt kept on the last strike says it never comes out', () => {
    const b = {
      cell: { x: 0, y: 0 },
      pulse: 1,
      kind: 'keep' as const,
      stored: 4,
      incoming: 4,
      out: 0,
      seg: 0,
    };
    expect(capBeatText(b, 2)).toBe('Strike 2: keeps 4, never let out');
  });

  it('single-strike altars keep the old wording', () => {
    const m = { at: { x: 0, y: 0 }, need: 4, outcome: 'over' as const, readings: [8], wokeOn: -1 };
    expect(failText(m, 'over', 1)).toBe('Breaker tripped: needs 4, got 8');
    expect(failText({ ...m, outcome: 'under', readings: [2] }, 'under', 1)).toBe(
      'Not enough: needs 4, got 2',
    );
  });
});
