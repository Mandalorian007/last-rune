/**
 * The solved board as the solve moment shows it (solve-truth, D-027). Pure, so the rule is
 * unit-tested: the picture must be exactly the board the player built.
 *
 * - `hops`: every hop the bolts took. Straight-through gems (Channel, Amplify, Capacitor) face
 *   along the hop that ends on them, as they do in play; Bend, Gate and Split keep their turn.
 * - `lit`: the gems a bolt reached (passed through, stored in or waited at). Only these glow;
 *   a fixed gem off the winning route stays unlit.
 * - `collars`: the sockets that wear the bolted iron collar and padlock: the puzzle's fixed
 *   gems and any hint-locked gems.
 */
import { type Placement, type PuzzleDef, type SimResult, simulate } from '../../rules';
import type { Cell } from '../../rules/types';

export interface SolvedLook {
  sim: SimResult;
  hops: { from: Cell; to: Cell }[];
  lit: Cell[];
  collars: Cell[];
}

export function solvedLook(
  puzzle: PuzzleDef,
  placements: readonly Placement[],
  locked: readonly Placement[] = [],
): SolvedLook {
  const sim = simulate(puzzle, placements);
  const gems = [...puzzle.fixed, ...placements];
  const hasGem = (c: Cell) => gems.some((g) => g.cell.x === c.x && g.cell.y === c.y);
  const hops = sim.trace.map((s) => ({ from: s.from, to: s.to }));
  const lit: Cell[] = [];
  for (const s of sim.trace) {
    if (s.end !== 'gem' && s.end !== 'store' && s.end !== 'wait') continue;
    if (!hasGem(s.to) || lit.some((c) => c.x === s.to.x && c.y === s.to.y)) continue;
    lit.push({ x: s.to.x, y: s.to.y });
  }
  const collars = [...puzzle.fixed, ...locked].map((f) => ({ x: f.cell.x, y: f.cell.y }));
  return { sim, hops, lit, collars };
}
