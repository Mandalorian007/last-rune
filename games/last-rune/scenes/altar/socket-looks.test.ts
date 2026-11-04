import { computeFillWidth } from '@thunderclap/engine/platform';
import { describe, expect, it } from 'vitest';
import { solidMask } from '../../art/materials/stone';
import { PUZZLES } from '../../content/puzzles';
import { altarDims } from '../../rules/model';
import { GEM_KINDS } from '../../rules/types';
import { trayRemaining } from '../../rules/validate';
import { altarRegions, frameFromRegions } from './altar-chrome';
import { computeLayout } from './layout';
import { huggedSlabDistance, legalSockets, recessCells, socketLooks } from './socket-looks';

describe('socket looks (mobile-4-board)', () => {
  it('phones draw no disc, plate or ring on a blocked cell; only open sockets get a rim', () => {
    for (const p of Object.values(PUZZLES)) {
      const { w, h } = altarDims(p.altar);
      const looks = socketLooks(
        true,
        w,
        h,
        p.blocked,
        p.fixed.map((f) => f.cell),
      );
      for (const b of p.blocked) {
        expect(looks.filter((l) => l.x === b.x && l.y === b.y)).toEqual([]);
      }
      expect(looks.some((l) => l.state === 'plate' || l.state === 'blocked')).toBe(false);
      expect(looks.filter((l) => l.state === 'rim')).toHaveLength(w * h - p.blocked.length);
    }
  });

  it('desktop keeps the carved capstone on blocked cells', () => {
    expect(socketLooks(false, 6, 4, [{ x: 1, y: 2 }], [])).toEqual([
      { x: 1, y: 2, state: 'blocked' },
    ]);
  });

  it('fixed gems get the bolted collar, never the dotted "wanted" ring, on every platform', () => {
    for (const phone of [true, false]) {
      const looks = socketLooks(phone, 6, 4, [], [{ x: 3, y: 1 }]);
      expect(looks).toContainEqual({ x: 3, y: 1, state: 'collar' });
      expect(looks.some((l) => l.state === 'wanted')).toBe(false);
    }
  });

  it('packs the solid-cell mask 24 cells per float, up to a 10×8 board', () => {
    expect(solidMask(6, [])).toEqual([0, 0, 0, 0]);
    expect(solidMask(6, [{ x: 0, y: 0 }])).toEqual([1, 0, 0, 0]);
    // Cell 25 (x 5, y 2 on a 10-wide board) is bit 1 of word 1.
    expect(solidMask(10, [{ x: 5, y: 2 }])).toEqual([0, 2, 0, 0]);
    // The last cell of a 10×8 board (79) is bit 7 of word 3.
    expect(solidMask(10, [{ x: 9, y: 7 }])).toEqual([0, 0, 0, 128]);
    // Every float stays an exact integer below 2^24.
    const all = solidMask(
      10,
      Array.from({ length: 80 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })),
    );
    for (const f of all)
      expect(Number.isInteger(f) && f < 2 ** 24 && Math.fround(f) === f).toBe(true);
  });
});

describe('hugged slab (mobile-5-board)', () => {
  // The four phone viewports the e2e budget runs (app size in CSS px, insets removed).
  const PHONES = [
    [667, 320],
    [750, 340],
    [814, 380],
    [915, 360],
  ] as const;
  const frames = PHONES.map(([w, h]) => {
    const r = computeFillWidth(w, h, 1920, 1080, { minVisible: 860, focusY: 540 });
    // The board's frame from the altar's rail regions at this size (altar-chrome.ts).
    const frame = frameFromRegions(
      {
        phone: true,
        cssPx: 1 / r.scale,
        bar: r.x / r.scale,
        cropT: Math.round(-r.y / r.scale),
        cropB: Math.round((r.y + r.height - h) / r.scale),
      },
      altarRegions(w, h),
      w,
    );
    if (!frame) throw new Error('no phone frame');
    return frame;
  });

  it('every socket, fixed gem and wire end lies on the stone; blocked cells are wall or flush stone', () => {
    for (const p of Object.values(PUZZLES))
      for (const f of frames) {
        const L = computeLayout(p, f);
        const R = L.pitch * 0.36;
        const inside = (x: number, y: number) =>
          huggedSlabDistance(L.cols, L.rows, L.pitch, L.margin, p.blocked, x, y);
        const centre = (c: { x: number; y: number }) => ({
          x: L.margin + L.pitch * (c.x + 0.5),
          y: L.margin + L.pitch * (c.y + 0.5),
        });
        for (let y = 0; y < L.rows; y++)
          for (let x = 0; x < L.cols; x++) {
            const o = centre({ x, y });
            const isBlocked = p.blocked.some((b) => b.x === x && b.y === y);
            if (isBlocked) {
              // held-gem: a blocked cell inside the slab is filled flush; at the edge, wall.
              const filled = recessCells(L.cols, L.rows, p.blocked).some(
                (c) => c.x === x && c.y === y,
              );
              const d = inside(o.x, o.y);
              expect(filled ? -d : d, `${p.id} blocked ${x},${y}`).toBeGreaterThan(0);
              continue;
            }
            // The whole bowl and its lip sit on stone.
            for (let a = 0; a < 8; a++) {
              const t = (a * Math.PI) / 4;
              const d = inside(o.x + Math.cos(t) * R * 1.2, o.y + Math.sin(t) * R * 1.2);
              expect(d, `${p.id} socket ${x},${y}`).toBeLessThan(0);
            }
          }
        for (const fx of p.fixed)
          expect(p.blocked.some((b) => b.x === fx.cell.x && b.y === fx.cell.y)).toBe(false);
        // A source or gauge wire runs from its inner socket straight out to the slab's edge:
        // its last stretch on the slab (to within 4 px of the edge) is on stone.
        for (const prop of [L.storm, ...L.machines]) {
          const o = centre(prop.inner);
          const dir = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ][prop.side]!;
          const reach = L.pitch / 2 + L.margin - 7;
          const end = inside(o.x + dir[0]! * reach, o.y + dir[1]! * reach);
          expect(end, `${p.id} wire ${prop.side}`).toBeLessThan(0);
        }
      }
  });
});

describe('legal rings (mobile-6-board)', () => {
  // Gate review 3 saw a scattered subset of sockets ringed with a Bend in hand. The ringed set
  // must be the legal set: every empty open socket while the tray has one, none when it is out.
  it('rings every empty open socket for every gem kind, on bare and half-built boards', () => {
    for (const p of Object.values(PUZZLES)) {
      const { w, h } = altarDims(p.altar);
      const half = p.design.intended.slice(0, Math.floor(p.design.intended.length / 2));
      for (const placements of [[], half]) {
        const taken = [
          ...p.blocked,
          ...p.fixed.map((f) => f.cell),
          ...placements.map((q) => q.cell),
        ];
        const open: string[] = [];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (!taken.some((c) => c.x === x && c.y === y)) open.push(`${x},${y}`);
        for (const kind of GEM_KINDS) {
          const ringed = legalSockets(p, placements, kind).map((c) => `${c.x},${c.y}`);
          const want = trayRemaining(p, placements, kind) > 0 ? open : [];
          expect(ringed, `${p.id} ${kind} (${placements.length} placed)`).toEqual(want);
        }
      }
    }
  });

  it('reuses the out array (no per-frame allocation)', () => {
    const p = Object.values(PUZZLES)[0]!;
    const out = [{ x: 9, y: 9 }];
    const kind = GEM_KINDS.find((k) => (p.tray[k] ?? 0) > 0)!;
    expect(legalSockets(p, [], kind, out)).toBe(out);
    expect(out.some((c) => c.x === 9 && c.y === 9)).toBe(false);
  });
});

describe('sunk stone inside the slab (mobile-6-board)', () => {
  it('fills a blocked cell between open ones, never one at the edge', () => {
    // . # .     (1,0) sits between open cells: sunk stone.
    // # # #     the middle row has no open cell beside it, and (1,1) none above it.
    // # . #     the corners have open on one side only: left to the wall.
    const blocked = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    expect(recessCells(3, 3, blocked)).toEqual([{ x: 1, y: 0 }]);
  });
  it('leaves every open cell alone on every altar', () => {
    for (const p of Object.values(PUZZLES)) {
      const { w, h } = altarDims(p.altar);
      for (const c of recessCells(w, h, p.blocked))
        expect(p.blocked.some((b) => b.x === c.x && b.y === c.y)).toBe(true);
    }
  });
});
