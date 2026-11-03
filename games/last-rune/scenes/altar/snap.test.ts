import { describe, expect, it } from 'vitest';
import type { Cell } from '../../rules/types';
import { type AltarLayout, snapCell } from './layout';

// A 4×3 board, pitch 20, socket (i, j) centred at (10 + 20i, 10 + 20j).
const L = { left: 0, top: 0, margin: 0, pitch: 20, cols: 4, rows: 3 } as AltarLayout;
const all = () => true;
const not =
  (...bad: Cell[]) =>
  (c: Cell) =>
    !bad.some((b) => b.x === c.x && b.y === c.y);

describe('snapCell (touch aiming)', () => {
  it('takes the socket under the point', () => {
    expect(snapCell(L, 31, 12, all)).toEqual({ x: 1, y: 0 });
  });
  it('steps off a refused socket to the nearest accepted one within half a pitch', () => {
    // Point at (1,1)'s right side: (2,1) is nearest.
    expect(snapCell(L, 37, 30, not({ x: 1, y: 1 }))).toEqual({ x: 2, y: 1 });
    // Point at (1,1)'s top: (1,0) is nearest.
    expect(snapCell(L, 30, 22, not({ x: 1, y: 1 }))).toEqual({ x: 1, y: 0 });
  });
  it('snaps onto an edge socket from just off the board, not from far off', () => {
    expect(snapCell(L, -6, 10, all)).toEqual({ x: 0, y: 0 });
    expect(snapCell(L, -11, 10, all)).toBeNull();
  });
  it('gives nothing when every nearby socket is refused', () => {
    expect(snapCell(L, 30, 30, () => false)).toBeNull();
  });
});
