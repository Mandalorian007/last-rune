/**
 * Helpers for tests and puzzle authoring. Pure TS.
 *
 * `fromAscii` builds placements from a compact grid drawing, one token per socket:
 *   .  empty      #  blocked (only meaningful in `blockedFromAscii`)
 *   =  channel    S  split     A  amplify     C  capacitor
 *   bend: L0 L1 L2 L3 (or └ ┌ ┐ ┘ for N-E, E-S, S-W, W-N)
 *   gate: G0 G1 G2 G3 (rot = output side N/E/S/W)
 * Tokens are separated by spaces.
 */
import type { Placement, PuzzleDef, Rot } from './model';
import type { Cell, GemKind } from './types';

const BEND_GLYPH: Record<string, Rot> = { '└': 0, '┌': 1, '┐': 2, '┘': 3 };

function tokens(rows: string[]): string[][] {
  return rows.map((r) => r.trim().split(/\s+/));
}

export function fromAscii(rows: string[]): Placement[] {
  const out: Placement[] = [];
  tokens(rows).forEach((row, y) => {
    row.forEach((t, x) => {
      const cell = { x, y };
      const gem = tokenGem(t);
      if (gem) out.push({ ...gem, cell });
    });
  });
  return out;
}

function tokenGem(t: string): { gem: GemKind; rot: Rot } | null {
  if (t === '.' || t === '#') return null;
  if (t === '=') return { gem: 'channel', rot: 0 };
  if (t === 'S') return { gem: 'split', rot: 0 };
  if (t === 'A') return { gem: 'amplify', rot: 0 };
  if (t === 'C') return { gem: 'capacitor', rot: 0 };
  if (t in BEND_GLYPH) return { gem: 'bend', rot: BEND_GLYPH[t]! };
  if (/^L[0-3]$/.test(t)) return { gem: 'bend', rot: Number(t[1]) as Rot };
  if (/^G[0-3]$/.test(t)) return { gem: 'gate', rot: Number(t[1]) as Rot };
  throw new Error(`bad token ${t}`);
}

export function blockedFromAscii(rows: string[]): Cell[] {
  const out: Cell[] = [];
  tokens(rows).forEach((row, y) => {
    row.forEach((t, x) => {
      if (t === '#') out.push({ x, y });
    });
  });
  return out;
}

/** Render a set of placements as ASCII (for debugging and docs). */
export function toAscii(p: PuzzleDef, placements: readonly Placement[]): string {
  const [w, h] = p.altar.split('x').map(Number) as [number, number];
  const grid: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(' .'));
  for (const b of p.blocked) grid[b.y]![b.x] = ' #';
  const glyph = (pl: Placement, fixed: boolean) => {
    const g =
      pl.gem === 'channel'
        ? '='
        : pl.gem === 'split'
          ? 'S'
          : pl.gem === 'amplify'
            ? 'A'
            : pl.gem === 'capacitor'
              ? 'C'
              : pl.gem === 'bend'
                ? (['└', '┌', '┐', '┘'][pl.rot] ?? '?')
                : `G${pl.rot}`;
    return (fixed ? '*' : ' ') + g;
  };
  for (const f of p.fixed) grid[f.cell.y]![f.cell.x] = glyph(f, true);
  for (const pl of placements) grid[pl.cell.y]![pl.cell.x] = glyph(pl, false);
  return grid.map((r) => r.map((c) => c.padEnd(3)).join('')).join('\n');
}
