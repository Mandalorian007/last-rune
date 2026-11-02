/** Placement legality for the UI, and structural checks for puzzle data. */
import { altarDims, cellKey, dirIndex, type Placement, type PuzzleDef } from './model';
import { type Cell, GEM_KINDS, type GemKind } from './types';

export type PlacementError = 'out-of-bounds' | 'blocked' | 'fixed' | 'occupied' | 'tray-empty';

export interface PlacementCheck {
  ok: boolean;
  reason?: PlacementError;
}

/** How many of `gem` the player still has in the tray, given current placements. */
export function trayRemaining(
  p: PuzzleDef,
  placements: readonly Placement[],
  gem: GemKind,
): number {
  const used = placements.filter((pl) => pl.gem === gem).length;
  return (p.tray[gem] ?? 0) - used;
}

/** Can the player set `gem` on `cell` right now? (Moving a gem = remove, then place.) */
export function validatePlacement(
  p: PuzzleDef,
  placements: readonly Placement[],
  cell: Cell,
  gem: GemKind,
): PlacementCheck {
  const { w, h } = altarDims(p.altar);
  if (cell.x < 0 || cell.y < 0 || cell.x >= w || cell.y >= h)
    return { ok: false, reason: 'out-of-bounds' };
  const k = cellKey(cell);
  if (p.blocked.some((b) => cellKey(b) === k)) return { ok: false, reason: 'blocked' };
  if (p.fixed.some((f) => cellKey(f.cell) === k)) return { ok: false, reason: 'fixed' };
  if (placements.some((pl) => cellKey(pl.cell) === k)) return { ok: false, reason: 'occupied' };
  if (trayRemaining(p, placements, gem) <= 0) return { ok: false, reason: 'tray-empty' };
  return { ok: true };
}

/** Which side of the altar an outside cell is on, or null if it is not a valid edge slot. */
function edgeSide(c: Cell, w: number, h: number): number | null {
  const inX = c.x >= 0 && c.x < w;
  const inY = c.y >= 0 && c.y < h;
  if (inX && c.y === -1) return 0;
  if (inY && c.x === w) return 1;
  if (inX && c.y === h) return 2;
  if (inY && c.x === -1) return 3;
  return null;
}

/** Structural problems with a puzzle definition (empty list = well-formed). */
export function puzzleProblems(p: PuzzleDef): string[] {
  const out: string[] = [];
  const { w, h } = altarDims(p.altar);
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h;
  const seen = new Set<string>();
  for (const b of p.blocked) {
    if (!inside(b)) out.push(`blocked ${cellKey(b)} outside altar`);
    if (seen.has(cellKey(b))) out.push(`duplicate cell ${cellKey(b)}`);
    seen.add(cellKey(b));
  }
  for (const f of p.fixed) {
    if (!inside(f.cell)) out.push(`fixed ${cellKey(f.cell)} outside altar`);
    if (seen.has(cellKey(f.cell))) out.push(`duplicate cell ${cellKey(f.cell)}`);
    seen.add(cellKey(f.cell));
  }
  const outside = new Set<string>();
  const side = edgeSide(p.storm.at, w, h);
  if (side === null) out.push('storm not on an edge slot');
  else if ((side + 2) % 4 !== dirIndex(p.storm.dir)) out.push('storm does not face the altar');
  outside.add(cellKey(p.storm.at));
  if (p.machines.length === 0) out.push('no machines');
  for (const mc of p.machines) {
    if (edgeSide(mc.at, w, h) === null) out.push(`machine ${cellKey(mc.at)} not on an edge slot`);
    if (outside.has(cellKey(mc.at))) out.push(`slot ${cellKey(mc.at)} used twice`);
    outside.add(cellKey(mc.at));
    if (!Number.isInteger(mc.need) || mc.need <= 0) out.push(`machine need ${mc.need} invalid`);
  }
  for (const [g, n] of Object.entries(p.tray)) {
    if (!(GEM_KINDS as readonly string[]).includes(g)) out.push(`unknown tray gem ${g}`);
    if (!Number.isInteger(n) || (n as number) < 0) out.push(`tray ${g} count invalid`);
  }
  if (!Number.isInteger(p.pulses) || p.pulses < 1 || p.pulses > 8) out.push('pulses must be 1..8');
  for (const pl of p.design.intended) {
    const err = validatePlacement(
      p,
      p.design.intended.filter((q) => q !== pl),
      pl.cell,
      pl.gem,
    );
    if (!err.ok) out.push(`intended ${pl.gem}@${cellKey(pl.cell)}: ${err.reason}`);
  }
  return out;
}
