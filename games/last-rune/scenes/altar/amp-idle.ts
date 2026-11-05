/**
 * held-gem (blind review 9, finding E): an Amplify doubles a bolt only once. A bolt that has
 * already been doubled passes a second Amplify unchanged (rules.md; `C_AMPLIFY` in sim.ts), so
 * on the lit path that second Amplify is drawn idle: dim, no burst. No number is shown (D-043);
 * the look alone says "this one did nothing". Pure, read off the sim's own trace, so the board
 * cannot disagree with the rules.
 */
import type { TraceSegment } from '../../rules';
import type { Cell } from '../../rules/types';

/**
 * The trace segments that arrive at an Amplify which then passes the bolt on unchanged: the hop
 * leaving it, in the same strike, the next tick, the same way, carries the same charge. A bolt
 * that stops there (a collision) is not counted idle.
 */
export function idleAmpArrivals(
  trace: readonly TraceSegment[],
  amps: readonly Cell[],
): Set<number> {
  const out = new Set<number>();
  const isAmp = (c: Cell) => amps.some((a) => a.x === c.x && a.y === c.y);
  trace.forEach((s, i) => {
    if (s.end !== 'gem' || !isAmp(s.to)) return;
    const dx = s.to.x - s.from.x;
    const dy = s.to.y - s.from.y;
    const next = trace.find(
      (t) =>
        t.pulse === s.pulse &&
        t.tick === s.tick + 1 &&
        t.from.x === s.to.x &&
        t.from.y === s.to.y &&
        t.to.x - t.from.x === dx &&
        t.to.y - t.from.y === dy,
    );
    if (next && next.charge === s.charge) out.add(i);
  });
  return out;
}

/** The Amplify cells that every bolt reaching them passed unchanged (idle all attempt long). */
export function idleAmpCells(trace: readonly TraceSegment[], amps: readonly Cell[]): Cell[] {
  const idle = idleAmpArrivals(trace, amps);
  return amps.filter((a) => {
    let reached = false;
    for (let i = 0; i < trace.length; i++) {
      const s = trace[i]!;
      if (s.end !== 'gem' || s.to.x !== a.x || s.to.y !== a.y) continue;
      reached = true;
      if (!idle.has(i)) return false;
    }
    return reached;
  });
}
