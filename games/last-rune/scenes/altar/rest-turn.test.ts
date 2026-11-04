import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { isRotational, type Placement, type PuzzleDef, simulate } from '../../rules';
import type { MachineId } from '../../rules/types';
import { hopTurn, restTurn } from './rest-turn';

const at = (x: number, y: number) => ({ x, y });

/** The axis (0 upright, 1 level) a fixed gem at (x, y) rests on with nothing placed. */
const fixedAxis = (id: MachineId, x: number, y: number) => {
  const p = puzzleFor(id);
  return restTurn(p, p.fixed, at(x, y));
};

/** Straight gems the intended route reaches whose rest axis (from `gems`) is not the route's. */
function crosswise(p: PuzzleDef, gems: readonly Placement[], only: readonly Placement[]) {
  const sim = simulate(p, p.design.intended);
  const wrong: string[] = [];
  for (const g of only) {
    if (isRotational(g.gem)) continue;
    const hop = sim.trace.find((s) => s.to.x === g.cell.x && s.to.y === g.cell.y);
    if (!hop) continue;
    if ((hopTurn(hop) & 1) !== restTurn(p, gems, g.cell))
      wrong.push(`${p.id} ${g.gem} ${g.cell.x},${g.cell.y}`);
  }
  return wrong;
}

describe('restTurn (glyph-truth-2: a straight gem lies along its run, never across it)', () => {
  it("Lift Shaft: the pre-set rails lie along the shaft's rows and columns", () => {
    // Gate 7: the top and bottom rows' Channels were drawn upright across a level run.
    const level = [at(1, 0), at(4, 0), at(2, 4), at(3, 4), at(4, 4)];
    const upright = [at(0, 1), at(0, 3), at(5, 1), at(5, 3)];
    for (const c of level) expect(fixedAxis('lift-shaft', c.x, c.y), `${c.x},${c.y}`).toBe(1);
    for (const c of upright) expect(fixedAxis('lift-shaft', c.x, c.y), `${c.x},${c.y}`).toBe(0);
  });

  it("Capacitor Bay: the built-in ice lies along the machine's row", () => {
    expect(fixedAxis('capacitor-bay', 5, 2)).toBe(1);
  });

  it('Splitter Mill: a Channel set beside the left gauge lies toward it', () => {
    const p = puzzleFor('splitter-mill');
    const gems: Placement[] = [...p.fixed, { gem: 'channel', cell: at(0, 1), rot: 0 }];
    expect(restTurn(p, gems, at(0, 1))).toBe(1);
  });

  it('every fixed straight gem, nothing placed, rests on the axis the solving bolt takes', () => {
    expect(Object.values(PUZZLES).flatMap((p) => crosswise(p, p.fixed, p.fixed))).toEqual([]);
  });

  it('every intended board: each straight gem rests on the axis the solving bolt takes', () => {
    // So nothing lies crosswise before the route reaches it.
    const wrong = Object.values(PUZZLES).flatMap((p) => {
      const gems = [...p.fixed, ...p.design.intended];
      return crosswise(p, gems, gems);
    });
    expect(wrong).toEqual([]);
  });

  it('hopTurn: 0 travelling N, 1 E, 2 S, 3 W', () => {
    expect(hopTurn({ from: at(1, 1), to: at(1, 0) })).toBe(0);
    expect(hopTurn({ from: at(0, 1), to: at(1, 1) })).toBe(1);
    expect(hopTurn({ from: at(1, 0), to: at(1, 1) })).toBe(2);
    expect(hopTurn({ from: at(1, 1), to: at(0, 1) })).toBe(3);
  });
});
