/**
 * Pre-strike reach lamps (mobile-7-strike, D-040 addendum 5): before Strike, each gauge says
 * only whether the charge path reaches it, a lamp lit or unlit, never an amount, so the puzzle
 * is not given away. Pure, so a test holds lamp == path reachability.
 *
 * A gauge is reached when the route preview (`previewPath`, the hops strike 1 takes through
 * the gems on the board) lands on it, or when any strike's trace does (a Capacitor's release
 * reaches a gauge only on a later strike). The same rule lights Strike's ready glow: it glows
 * when every lamp is lit.
 */
import type { Placement, PuzzleDef, SimResult } from '../../rules';
import { previewPath } from './circuit-model';

/** One boolean per machine, in `puzzle.machines` order: does the charge path reach it? */
export function gaugeReach(
  puzzle: PuzzleDef,
  placements: readonly Placement[],
  sim: SimResult,
  hops = previewPath(puzzle, placements, sim).hops,
): boolean[] {
  return puzzle.machines.map(
    (m) =>
      hops.some((q) => q.to.x === m.at.x && q.to.y === m.at.y) ||
      sim.trace.some((q) => q.to.x === m.at.x && q.to.y === m.at.y),
  );
}

/** Strike is ready (it glows) when every lamp is lit. */
export function allReached(lamps: readonly boolean[]): boolean {
  return lamps.length > 0 && lamps.every(Boolean);
}
