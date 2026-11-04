import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { type Placement, simulate, validatePlacement } from '../../rules';
import type { Cell } from '../../rules/types';
import { idleAmpArrivals, idleAmpCells } from './amp-idle';

/**
 * Control Booth with the storm run straight east through its pre-set Amplify (2,2) into the
 * tray's Amplify at (3,2): the bolt is doubled once, so the second Amplify passes it unchanged.
 */
const TWO_AMPS: Placement[] = [
  { cell: { x: 0, y: 2 }, gem: 'channel', rot: 1 },
  { cell: { x: 1, y: 2 }, gem: 'channel', rot: 1 },
  { cell: { x: 3, y: 2 }, gem: 'amplify', rot: 1 },
];

const ampsOf = (id: keyof typeof PUZZLES, placements: readonly Placement[]): Cell[] => {
  const pz = puzzleFor(id);
  return [...pz.fixed, ...placements].filter((g) => g.gem === 'amplify').map((g) => g.cell);
};

describe('idle Amplify (held-gem, finding E)', () => {
  it('the second Amplify on a doubled bolt is idle; the first is not', () => {
    const pz = puzzleFor('control-booth');
    const placed: Placement[] = [];
    for (const p of TWO_AMPS) {
      expect(validatePlacement(pz, placed, p.cell, p.gem).ok, JSON.stringify(p)).toBe(true);
      placed.push(p);
    }
    const tr = simulate(pz, TWO_AMPS).trace;
    const amps = ampsOf('control-booth', TWO_AMPS);
    const idle = idleAmpArrivals(tr, amps);
    const into = (x: number, y: number) =>
      tr.findIndex((s) => s.end === 'gem' && s.to.x === x && s.to.y === y);
    expect(into(2, 2)).toBeGreaterThanOrEqual(0);
    expect(into(3, 2)).toBeGreaterThanOrEqual(0);
    expect(idle.has(into(2, 2))).toBe(false);
    expect(idle.has(into(3, 2))).toBe(true);
    expect(idleAmpCells(tr, amps)).toEqual([{ x: 3, y: 2 }]);
  });

  it('agrees with the sim on every intended solution: an Amplify there never sits idle', () => {
    for (const pz of Object.values(PUZZLES)) {
      const tr = simulate(pz, pz.design.intended).trace;
      const amps = ampsOf(pz.id, pz.design.intended);
      for (const i of idleAmpArrivals(tr, amps)) {
        const s = tr[i]!;
        // Idle means the hop out carries the charge that came in.
        const out = tr.find(
          (t) =>
            t.pulse === s.pulse &&
            t.tick === s.tick + 1 &&
            t.from.x === s.to.x &&
            t.from.y === s.to.y,
        );
        expect(out?.charge, pz.id).toBe(s.charge);
      }
      // No shipped solution passes a bolt through two Amplifies on one run.
      expect(idleAmpCells(tr, amps), pz.id).toEqual([]);
    }
  });
});
