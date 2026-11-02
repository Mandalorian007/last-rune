/**
 * Keyboard planning for the altar, shared by the e2e builders: which intended gem to place
 * next (follow the wire, the way a player does) and which keys move the cursor there (arrows,
 * which skip carved stone, and G, which jumps to the wire's open end). Pure: no page access.
 */
import { altarDims, type Placement, type PuzzleDef, simulate } from '../../games/last-rune/rules';
import type { Cell } from '../../games/last-rune/rules/types';
import { previewPath } from '../../games/last-rune/scenes/altar/circuit-model';
import { type CursorKey, planCursor } from '../../games/last-rune/scenes/altar/cursor';

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/** The wire's open ends a player can fill, in the altar's order (what G cycles through). */
export function openSockets(p: PuzzleDef, placed: readonly Placement[]): Cell[] {
  const pv = previewPath(p, [...placed], simulate(p, [...placed]));
  const { w, h } = altarDims(p.altar);
  return pv.openEnds.filter(
    (c) =>
      c.x >= 0 &&
      c.y >= 0 &&
      c.x < w &&
      c.y < h &&
      !placed.some((q) => same(q.cell, c)) &&
      !p.fixed.some((f) => same(f.cell, c)) &&
      !p.blocked.some((b) => same(b, c)),
  );
}

/**
 * The next gem to place: one on the wire's open end if any (nearest to `from`), else the
 * nearest remaining one. Following the wire is how the altar is played and taught.
 */
export function nextGem(
  p: PuzzleDef,
  placed: readonly Placement[],
  todo: readonly Placement[],
  from: Cell,
): number {
  const ends = openSockets(p, placed);
  const onEnd = todo.map((g, i) => ({ g, i })).filter(({ g }) => ends.some((e) => same(e, g.cell)));
  const pool = onEnd.length ? onEnd : todo.map((g, i) => ({ g, i }));
  let best = pool[0]!.i;
  let bestD = Number.POSITIVE_INFINITY;
  for (const { g, i } of pool) {
    const d = Math.abs(g.cell.x - from.x) + Math.abs(g.cell.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const KEY: Record<CursorKey, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'KeyG',
};

/** Fewest key presses that move the altar cursor from `from` to `to`. */
export function cursorKeys(
  p: PuzzleDef,
  placed: readonly Placement[],
  from: Cell,
  to: Cell,
): string[] {
  const { w, h } = altarDims(p.altar);
  const board = {
    cols: w,
    rows: h,
    isBlocked: (c: Cell) => p.blocked.some((b) => same(b, c)),
  };
  return planCursor(board, openSockets(p, placed), from, to).map((k) => KEY[k]);
}

/** Keys that turn a fresh gem (rotation 0) to `rot`: R turns forward, Q back. */
export function turnKeys(rot: number): string[] {
  return rot === 3 ? ['KeyQ'] : Array.from({ length: rot }, () => 'KeyR');
}
