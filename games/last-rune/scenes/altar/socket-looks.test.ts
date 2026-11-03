import { describe, expect, it } from 'vitest';
import { solidMask } from '../../art/materials/stone';
import { PUZZLES } from '../../content/puzzles';
import { altarDims } from '../../rules/model';
import { socketLooks } from './socket-looks';

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
