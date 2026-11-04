/**
 * Which way a straight gem (Channel, Amplify, Capacitor) rests when no bolt reaches it
 * (glyph-truth-2, D-027). Pure, so the rule is unit-tested.
 *
 * The rules let a straight gem carry a bolt "whichever way it enters" (rules.md section 4), so
 * its `rot` means nothing to the sim. Its glyph is still a line, and a line drawn across the run
 * it sits on reads as a gem that blocks it (gate 7: Lift Shaft's pre-set rails and Capacitor
 * Bay's ice were drawn vertical on horizontal runs, because unreached gems faced the storm).
 * So an unreached straight gem lies along the run its socket is part of: the axis whose two
 * sides lead somewhere. A side scores
 * - 3 when something meets it head on: the storm firing into it, a machine, or a Bend, Gate or
 *   Split whose side faces it;
 * - 2 for another straight gem (rails in a line lie along the line);
 * - 1 for an open socket (it could carry a bolt later);
 * - 0 when nothing can come that way: carved stone, the altar's edge, or a turned gem's blank side.
 * The higher axis wins; a tie lies along the storm's axis (the old rest).
 *
 * Returns a quarter turn on the rules' convention: 0 runs S to N (vertical), 1 runs W to E.
 */
import {
  altarDims,
  DIRS,
  dirIndex,
  isRotational,
  type Placement,
  type PuzzleDef,
} from '../../rules';
import type { Cell } from '../../rules/types';

/** Sides (N=0, E=1, S=2, W=3) a turned gem opens onto, at its `rot`. */
export function openSides(p: Placement): number[] {
  const r = p.rot;
  if (p.gem === 'bend') return [r, (r + 1) & 3];
  if (p.gem === 'gate') return [r, (r + 1) & 3, (r + 3) & 3];
  if (p.gem === 'split') return [(r + 1) & 3, (r + 2) & 3, (r + 3) & 3];
  return [0, 1, 2, 3];
}

const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

/** How strongly the side `d` of `cell` leads somewhere (see the module note). */
function sideScore(puzzle: PuzzleDef, gems: readonly Placement[], cell: Cell, d: number): number {
  const { w, h } = altarDims(puzzle.altar);
  const x = cell.x + DX[d]!;
  const y = cell.y + DY[d]!;
  const same = (c: Cell) => c.x === x && c.y === y;
  if (x < 0 || y < 0 || x >= w || y >= h) {
    if (same(puzzle.storm.at)) return 3;
    return puzzle.machines.some((m) => same(m.at)) ? 3 : 0;
  }
  if (puzzle.blocked.some(same)) return 0;
  const g = gems.find((p) => same(p.cell));
  if (!g) return 1;
  if (!isRotational(g.gem)) return 2;
  // The neighbour's side that faces back at `cell`.
  return openSides(g).includes((d + 2) & 3) ? 3 : 0;
}

/** The resting quarter turn (0 vertical, 1 horizontal) of a straight gem at `cell`. */
export function restTurn(puzzle: PuzzleDef, gems: readonly Placement[], cell: Cell): 0 | 1 {
  const s = DIRS.map((_, d) => sideScore(puzzle, gems, cell, d));
  const vertical = s[0]! + s[2]!;
  const horizontal = s[1]! + s[3]!;
  if (vertical !== horizontal) return vertical > horizontal ? 0 : 1;
  return (dirIndex(puzzle.storm.dir) & 1) as 0 | 1;
}

/** The quarter turn that faces a straight gem along a hop that ends on it (0 = travelling N). */
export function hopTurn(h: { from: Cell; to: Cell }): number {
  const dx = h.to.x - h.from.x;
  const dy = h.to.y - h.from.y;
  return dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
}
