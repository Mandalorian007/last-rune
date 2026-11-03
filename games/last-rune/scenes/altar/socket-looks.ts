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
