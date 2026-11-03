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
import type { Cell } from '../../rules/types';

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
 * `stone-wgsl.ts`). It is the union of one rounded block per open cell, grown by `margin`
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
  let d = 1e5;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (blocked.some((b) => b.x === x && b.y === y)) continue;
      const qx = Math.abs(px - (margin + pitch * (x + 0.5))) - half + rc;
      const qy = Math.abs(py - (margin + pitch * (y + 0.5))) - half + rc;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      d = Math.min(d, out + Math.min(Math.max(qx, qy), 0) - rc);
    }
  return d;
}
