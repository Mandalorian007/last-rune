import { describe, expect, it } from 'vitest';
import { parseBoard } from './ascii';
import {
  altarDims,
  isRotational,
  type MachineTarget,
  type Placement,
  type PuzzleDef,
  type Rot,
} from './model';
import { ancHas, boardFor, runCore, simulate } from './sim';
import { essentialGems, fixedEssential, isSolvable, solve } from './solver';
import { GEM_KINDS, type GemKind, type StormStrength } from './types';

function mini(
  rows: string[],
  machines: MachineTarget[],
  tray: Partial<Record<GemKind, number>>,
  opts: { strength?: StormStrength; pulses?: number } = {},
): PuzzleDef {
  const b = parseBoard(rows);
  return {
    id: 'intake-desk',
    altar: '6x4',
    blocked: b.blocked,
    fixed: b.fixed,
    storm: { at: { x: -1, y: 1 }, dir: 'E', strength: opts.strength ?? 1 },
    machines,
    tray,
    pulses: opts.pulses ?? 1,
    design: { insight: '', minutes: 1, assumes: [], essential: [], intended: [] },
  };
}

/** Every placement of the tray on the open sockets, simulated. Small boards only. */
function brute(p: PuzzleDef): { any: number; canonical: number } {
  const { w, h } = altarDims(p.altar);
  const taken = new Set([...p.blocked, ...p.fixed.map((f) => f.cell)].map((c) => c.y * w + c.x));
  const open: number[] = [];
  for (let i = 0; i < w * h; i++) if (!taken.has(i)) open.push(i);
  const left = { ...p.tray };
  const pls: Placement[] = [];
  let any = 0;
  let canonical = 0;
  const go = (k: number) => {
    if (k === open.length) {
      const r = runCore(p, boardFor(p, pls), false);
      if (r.status !== 'done' || r.outcome !== 'exact') return;
      any++;
      if (pls.every((q) => ancHas(r.useful, q.cell.y * w + q.cell.x))) canonical++;
      return;
    }
    go(k + 1);
    const cell = { x: open[k]! % w, y: Math.floor(open[k]! / w) };
    for (const gem of GEM_KINDS) {
      if (!(left[gem] ?? 0)) continue;
      left[gem]!--;
      const rots = isRotational(gem) ? 4 : 1;
      for (let rot = 0; rot < rots; rot++) {
        pls.push({ gem, cell, rot: rot as Rot });
        go(k + 1);
        pls.pop();
      }
      left[gem]!++;
    }
  };
  go(0);
  return { any, canonical };
}

const ALL = { channel: 4, bend: 4, split: 1, amplify: 1, gate: 1, capacitor: 1 };

// A corner to turn: storm enters (0,1), machine south of (3,3).
const turns = mini(
  ['# # # # # #', '. . . # # #', '# # . . # #', '# # # . # #'],
  [{ at: { x: 3, y: 4 }, need: 4 }],
  { channel: 4, bend: 3 },
);

// Split and re-join: four open corners around a pre-set split, gate and channels.
const rejoin = mini(
  ['# # . *= *= .', '*= *= *S1 # # *G1', '# # . *= *= .', '# # # # # #'],
  [{ at: { x: 6, y: 1 }, need: 4 }],
  ALL,
);

// Two strikes: a machine that wants 4 now and one that wants 8 later, from a 2x storm.
const bank = mini(
  ['# # . # # #', '*= *= . # # #', '# # . . . *=', '# # # # # #'],
  [
    { at: { x: 2, y: -1 }, need: 4 },
    { at: { x: 6, y: 2 }, need: 8 },
  ],
  { channel: 3, bend: 2, split: 1, amplify: 1, capacitor: 1 },
  { strength: 2, pulses: 2 },
);

describe('solver agrees with brute force', () => {
  it.each([
    ['turns', turns],
    ['rejoin', rejoin],
    ['bank', bank],
  ] as const)('%s', (_name, p) => {
    const b = brute(p);
    const r = solve(p, { keep: 1000 });
    expect(r.capped).toBe(false);
    expect(r.count).toBe(b.canonical);
    expect(isSolvable(p)).toBe(b.any > 0);
    // Every reported solution really wakes every machine.
    for (const s of r.solutions) expect(simulate(p, s).outcome).toBe('exact');
  });

  it('finds the expected small counts', () => {
    expect(solve(turns).count).toBe(1);
    expect(solve(rejoin).count).toBe(1);
    expect(solve(bank).count).toBeGreaterThan(0);
  });
});

describe('solve options and results', () => {
  it('returns solutions fewest gems first, capped at keep', () => {
    const p = mini(
      ['. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .'],
      [{ at: { x: 6, y: 1 }, need: 4 }],
      { channel: 8, bend: 4 },
    );
    const r = solve(p, { keep: 3 });
    expect(r.count).toBeGreaterThan(3);
    expect(r.solutions).toHaveLength(3);
    expect(r.solutions[0]).toHaveLength(6);
    const lens = r.solutions.map((s) => s.length);
    expect([...lens].sort((a, b) => a - b)).toEqual(lens);
    expect(r.minGems).toBe(6);
    expect(r.gemUse.channel).toBe(r.count);
  });

  it('reports capped when it hits the node limit', () => {
    const p = mini(
      ['. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .'],
      [{ at: { x: 6, y: 1 }, need: 4 }],
      ALL,
    );
    const r = solve(p, { maxNodes: 50 });
    expect(r.capped).toBe(true);
  });

  it('honours a tray override', () => {
    expect(isSolvable(turns, { channel: 4, bend: 0 })).toBe(false);
    expect(isSolvable(turns, { channel: 2, bend: 3 })).toBe(false);
    expect(isSolvable(turns, { channel: 3, bend: 2 })).toBe(false);
    expect(isSolvable(turns, { channel: 3, bend: 3 })).toBe(true);
  });

  it('lists essential gems and essential fixed gems', () => {
    expect(essentialGems(turns)).toEqual(['channel', 'bend']);
    // With a full tray the player can replace a missing pre-set gem; without, they cannot.
    expect(fixedEssential(rejoin, 'split')).toBe(false);
    const bare = { ...rejoin, tray: { channel: 4, bend: 4 } };
    expect(fixedEssential(bare, 'split')).toBe(true);
    expect(fixedEssential(bare, 'gate')).toBe(true);
  });

  it('never counts a solution with an idle gem', () => {
    // Plenty of spare channels on an open board: still only the useful ones are counted.
    const p = mini(
      ['. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .'],
      [{ at: { x: 6, y: 1 }, need: 4 }],
      { channel: 10 },
    );
    const r = solve(p);
    expect(r.count).toBe(1);
    expect(r.solutions[0]).toHaveLength(6);
  });

  it('a puzzle needing an impossible charge has no solutions', () => {
    const p = mini(
      ['. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .'],
      [{ at: { x: 6, y: 1 }, need: 5 }],
      { channel: 6, bend: 2, split: 2 },
    );
    const r = solve(p);
    expect(r.solvable).toBe(false);
    expect(r.capped).toBe(false);
    expect(r.minGems).toBe(-1);
  });
});
