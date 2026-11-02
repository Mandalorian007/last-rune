/**
 * The altar's keyboard cursor, as pure functions (unit-tested, and used by the e2e builders to
 * plan key presses).
 *
 * - Arrows step one socket, but never stop on carved stone: they slide over blocked sockets to
 *   the next one that can take a gem. If there is none before the edge, the cursor stays.
 * - The jump key goes to the wire's open end (an amber socket: where the bolt would fizzle
 *   next). From somewhere else it goes to the nearest one; from an open end it goes on to the
 *   next, in the order the bolt reaches them, so a few presses visit every branch.
 */
import type { Cell } from '../../rules/types';

export interface CursorBoard {
  readonly cols: number;
  readonly rows: number;
  isBlocked(c: Cell): boolean;
}

/** One arrow press from `c` by (`dx`, `dy`), sliding over carved stone. */
export function stepCursor(board: CursorBoard, c: Cell, dx: number, dy: number): Cell {
  let x = c.x;
  let y = c.y;
  for (;;) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) return { x: c.x, y: c.y };
    if (!board.isBlocked({ x, y })) return { x, y };
  }
}

/** Where the jump key takes the cursor, or null when the wire has no open end. */
export function jumpCursor(c: Cell, openEnds: readonly Cell[]): Cell | null {
  if (openEnds.length === 0) return null;
  const i = openEnds.findIndex((e) => e.x === c.x && e.y === c.y);
  if (i >= 0) {
    const next = openEnds[(i + 1) % openEnds.length]!;
    return { x: next.x, y: next.y };
  }
  let best = openEnds[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const e of openEnds) {
    const d = Math.abs(e.x - c.x) + Math.abs(e.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return { x: best.x, y: best.y };
}

/** A cursor key: an arrow or the jump to the wire's open end. */
export type CursorKey = 'up' | 'down' | 'left' | 'right' | 'jump';

/**
 * Fewest presses (arrows and the jump key) from `from` to `to`, by breadth-first search.
 * Returns the keys in order: `'up' | 'down' | 'left' | 'right' | 'jump'`.
 */
export function planCursor(
  board: CursorBoard,
  openEnds: readonly Cell[],
  from: Cell,
  to: Cell,
): CursorKey[] {
  const k = (c: Cell) => c.y * board.cols + c.x;
  const prev = new Map<number, { at: Cell; key: CursorKey; from: number }>();
  const start = k(from);
  prev.set(start, { at: from, key: 'jump', from: -1 });
  const queue: Cell[] = [from];
  const moves: [CursorKey, number, number][] = [
    ['right', 1, 0],
    ['left', -1, 0],
    ['down', 0, 1],
    ['up', 0, -1],
  ];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.x === to.x && c.y === to.y) break;
    const next: [CursorKey, Cell | null][] = [
      ['jump', jumpCursor(c, openEnds)],
      ...moves.map(([key, dx, dy]): [CursorKey, Cell] => [key, stepCursor(board, c, dx, dy)]),
    ];
    for (const [key, n] of next) {
      if (!n || prev.has(k(n))) continue;
      prev.set(k(n), { at: n, key, from: k(c) });
      queue.push(n);
    }
  }
  const out: CursorKey[] = [];
  let cur = k(to);
  if (!prev.has(cur)) return out;
  while (cur !== start) {
    const p = prev.get(cur)!;
    out.push(p.key);
    cur = p.from;
  }
  return out.reverse();
}
