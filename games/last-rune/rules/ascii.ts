/**
 * ASCII boards for puzzle authoring, tests and debugging. Pure TS.
 *
 * One token per socket, separated by spaces:
 *   .  empty      #  blocked
 *   =  channel    S  split     A  amplify     C  capacitor
 *   bend: L0 L1 L2 L3 (or └ ┌ ┐ ┘ for N-E, E-S, S-W, W-N)
 *   gate: G0 G1 G2 G3 (rot = output side N/E/S/W)
 * A `*` prefix (e.g. `*A`, `*L1`) marks a fixed (pre-set) gem in `parseBoard`.
 */
import type { Placement, PuzzleDef, Rot } from './model';
import type { Cell, GemKind } from './types';

const BEND_GLYPH: Record<string, Rot> = { '└': 0, '┌': 1, '┐': 2, '┘': 3 };

function tokens(rows: string[]): string[][] {
  return rows.map((r) => r.trim().split(/\s+/));
}

/** Player placements drawn in `rows` (fixed `*` gems and `#` are skipped). */
export function fromAscii(rows: string[]): Placement[] {
  return parseBoard(rows).placements;
}

/** Split a drawing into blocked sockets, fixed gems and player placements. */
export function parseBoard(rows: string[]): {
  w: number;
  h: number;
  blocked: Cell[];
  fixed: Placement[];
  placements: Placement[];
} {
  const blocked: Cell[] = [];
  const fixed: Placement[] = [];
  const placements: Placement[] = [];
  const grid = tokens(rows);
  grid.forEach((row, y) => {
    row.forEach((t, x) => {
      const cell = { x, y };
      if (t === '#') {
        blocked.push(cell);
        return;
      }
      const isFixed = t.startsWith('*');
      const gem = tokenGem(isFixed ? t.slice(1) : t);
      if (gem) (isFixed ? fixed : placements).push({ ...gem, cell });
    });
  });
  return { w: grid[0]?.length ?? 0, h: grid.length, blocked, fixed, placements };
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
  return parseBoard(rows).blocked;
}

/** Render a puzzle and placements as ASCII, with storm (`Z`) and machines (`M<need>`) framed. */
export function toAscii(p: PuzzleDef, placements: readonly Placement[] = []): string {
  const [w, h] = p.altar.split('x').map(Number) as [number, number];
  const grid: string[][] = Array.from({ length: h + 2 }, () => Array<string>(w + 2).fill(''));
  const put = (c: Cell, t: string) => {
    grid[c.y + 1]![c.x + 1] = t;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put({ x, y }, '.');
  for (const b of p.blocked) put(b, '#');
  for (const f of p.fixed) put(f.cell, `*${glyph(f)}`);
  for (const pl of placements) put(pl.cell, glyph(pl));
  put(p.storm.at, `Z${p.storm.strength}`);
  for (const m of p.machines) put(m.at, `M${m.need}`);
  return grid
    .map((r) =>
      r
        .map((c) => c.padEnd(4))
        .join('')
        .trimEnd(),
    )
    .join('\n');
}

function glyph(pl: Placement): string {
  switch (pl.gem) {
    case 'channel':
      return '=';
    case 'split':
      return 'S';
    case 'amplify':
      return 'A';
    case 'capacitor':
      return 'C';
    case 'bend':
      return ['└', '┌', '┐', '┘'][pl.rot]!;
    case 'gate':
      return `G${pl.rot}`;
  }
}
