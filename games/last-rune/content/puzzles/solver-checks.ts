/** Solver checks shared by solve.test.ts and finale.test.ts (test-only module). */
import { expect, it } from 'vitest';
import { fixedEssential, isSolvable, solve } from '../../rules/solver';
import type { MachineId } from '../../rules/types';
import { FIXED_ESSENTIAL, SLOW, SOLUTION_COUNT } from './expectations';
import { PUZZLES } from './index';

// Set FULL=1 to also count the finale's solutions (a few seconds).
const FULL = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .FULL;

export function solverChecks(id: MachineId) {
  const p = PUZZLES[id];

  it('is solvable', () => {
    expect(isSolvable(p)).toBe(true);
  });

  for (const g of p.design.essential) {
    it(`cannot be solved without ${g}`, () => {
      expect(isSolvable(p, { ...p.tray, [g]: 0 })).toBe(false);
    });
  }

  for (const g of FIXED_ESSENTIAL[id] ?? []) {
    it(`cannot be solved without its pre-set ${g}`, () => {
      expect(p.fixed.some((f) => f.gem === g)).toBe(true);
      expect(fixedEssential(p, g)).toBe(true);
    });
  }

  it.skipIf(SLOW.includes(id) && !FULL)(
    'has the expected number of solutions',
    () => {
      const r = solve(p, { keep: 1 });
      expect(r.capped).toBe(false);
      expect(r.count).toBe(SOLUTION_COUNT[id]);
      // Sane: a real decision, not a free-for-all.
      expect(r.count).toBeGreaterThanOrEqual(1);
      expect(r.count).toBeLessThanOrEqual(100);
      expect(r.minGems).toBeLessThanOrEqual(p.design.intended.length);
    },
    60_000,
  );
}
