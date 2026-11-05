/**
 * The standing socket marks under the gems: how open, blocked and fixed cells look. This is
 * pure, so the rule is unit-tested. The altar scene adds transient marks (hint, fizzle, legal
 * sockets) on top.
 *
 * - Desktop and iPad: a blocked cell is a capstone with a carved X (`blocked`).
 * - Phones (mobile-4-board): a blocked cell is not a socket at all. The slab is baked solid
 *   there (`AltarSlab` `solid`), so it gets no mark. Only open sockets get the pale `rim`, so
 *   the holes are exactly where gems go.
 * - Fixed gems (and hint-locked ones), every platform: a bolted iron `collar`.
 */
import type { SocketState } from '../../art/materials/stone';
import { altarDims, type Placement, type PuzzleDef, validatePlacement } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';

export interface SocketLook {
  x: number;
  y: number;
  state: SocketState;
}

export function socketLooks(
  phone: boolean,
  cols: number,
  rows: number,
  blocked: readonly Cell[],
  fixed: readonly Cell[],
): SocketLook[] {
  const out: SocketLook[] = [];
  const isBlocked = (x: number, y: number) => blocked.some((b) => b.x === x && b.y === y);
  if (phone) {
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) if (!isBlocked(x, y)) out.push({ x, y, state: 'rim' });
  } else for (const b of blocked) out.push({ x: b.x, y: b.y, state: 'blocked' });
  for (const f of fixed) out.push({ x: f.x, y: f.y, state: 'collar' });
  return out;
}

/**
 * Phones (mobile-5-board): the hugged slab's top face, as the bake carves it (`alt_hug` in
 * `stone-wgsl.ts`). It is the union of one rounded block per open cell (and per blocked cell
 * inside the slab, `recessCells`, filled flush), grown by `margin`
 * less a 3 px chip, with corner radius min(0.9·margin, 22). Returns the signed distance from
 * a point in slab-local px (origin at the top face's top-left) to the edge, negative inside.
 * Pure, so tests can check that no socket, source or gauge wire hangs off the stone.
 */
export function huggedSlabDistance(
  cols: number,
  rows: number,
  pitch: number,
  margin: number,
  blocked: readonly Cell[],
  px: number,
  py: number,
): number {
  const half = pitch / 2 + margin - 3;
  const rc = Math.min(margin * 0.9, 22);
  const inner = recessCells(cols, rows, blocked);
  const has = (cs: readonly Cell[], x: number, y: number) => cs.some((b) => b.x === x && b.y === y);
  let d = 1e5;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (has(blocked, x, y) && !has(inner, x, y)) continue;
      const qx = Math.abs(px - (margin + pitch * (x + 0.5))) - half + rc;
      const qy = Math.abs(py - (margin + pitch * (y + 0.5))) - half + rc;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      d = Math.min(d, out + Math.min(Math.max(qx, qy), 0) - rc);
    }
  return d;
}

/**
 * Phones (mobile-6-board): the blocked cells inside the slab, which the bake fills flush with
 * the slab's stone (`alt_inner` in `stone-wgsl.ts`; held-gem: a sunk square read as a square
 * socket) instead of letting the wall show through. A blocked
 * cell is inside when there are open cells on both sides of it in its row, or both above and
 * below it in its column. The rest stay off the stone, so the slab still hugs the sockets.
 */
export function recessCells(cols: number, rows: number, blocked: readonly Cell[]): Cell[] {
  const solid = (x: number, y: number) => blocked.some((b) => b.x === x && b.y === y);
  const out: Cell[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (!solid(x, y)) continue;
      let l = false;
      let r = false;
      let u = false;
      let d = false;
      for (let i = 0; i < cols; i++)
        if (i !== x && !solid(i, y)) {
          if (i < x) l = true;
          else r = true;
        }
      for (let j = 0; j < rows; j++)
        if (j !== y && !solid(x, j)) {
          if (j < y) u = true;
          else d = true;
        }
      if ((l && r) || (u && d)) out.push({ x, y });
    }
  return out;
}

/**
 * The sockets that get the `legal` ring while `kind` is in hand (mobile-6-board): exactly the
 * empty sockets the rules accept it in (`validatePlacement`), every one alike. Gate review 3
 * found a scattered subset ringed: sockets near the circuit glowed at 0.45 and the rest at 0.1,
 * which reads as "only these". Pure, so a test holds ringed == legal.
 */
export function legalSockets(
  puzzle: PuzzleDef,
  placements: readonly Placement[],
  kind: GemKind,
  out: Cell[] = [],
): Cell[] {
  const { w, h } = altarDims(puzzle.altar);
  out.length = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = { x, y };
      if (validatePlacement(puzzle, placements, c, kind).ok) out.push(c);
    }
  return out;
}
