import { describe, expect, it } from 'vitest';
import type { Cell } from '../../rules/types';
import { type CursorBoard, jumpCursor, planCursor, stepCursor } from './cursor';

/** A 5×3 board; `#` is carved stone. */
function board(rows: string[]): CursorBoard {
  return {
    cols: rows[0]!.length,
    rows: rows.length,
    isBlocked: (c: Cell) => rows[c.y]![c.x] === '#',
  };
}

const B = board(['..#..', '.##..', '.....']);

describe('altar cursor', () => {
  it('arrows step one socket and slide over carved stone', () => {
    expect(stepCursor(B, { x: 0, y: 0 }, 1, 0)).toEqual({ x: 1, y: 0 });
    expect(stepCursor(B, { x: 1, y: 0 }, 1, 0)).toEqual({ x: 3, y: 0 });
    expect(stepCursor(B, { x: 0, y: 1 }, 1, 0)).toEqual({ x: 3, y: 1 });
    expect(stepCursor(B, { x: 2, y: 2 }, 0, -1)).toEqual({ x: 2, y: 2 }); // only stone above
  });

  it('arrows stop at the edge', () => {
    expect(stepCursor(B, { x: 4, y: 0 }, 1, 0)).toEqual({ x: 4, y: 0 });
    expect(stepCursor(B, { x: 0, y: 0 }, 0, -1)).toEqual({ x: 0, y: 0 });
  });

  it('jump goes to the nearest open end, then cycles through them', () => {
    const ends = [
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(jumpCursor({ x: 1, y: 1 }, ends)).toEqual({ x: 0, y: 2 });
    expect(jumpCursor({ x: 0, y: 2 }, ends)).toEqual({ x: 4, y: 2 });
    expect(jumpCursor({ x: 4, y: 2 }, ends)).toEqual({ x: 0, y: 2 });
    expect(jumpCursor({ x: 1, y: 1 }, [])).toBeNull();
  });

  it('plans the fewest presses, using the jump when it helps', () => {
    expect(planCursor(B, [], { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
    expect(planCursor(B, [], { x: 1, y: 0 }, { x: 3, y: 0 })).toEqual(['right']);
    expect(planCursor(B, [{ x: 4, y: 2 }], { x: 0, y: 0 }, { x: 4, y: 2 })).toEqual(['jump']);
    const keys = planCursor(B, [{ x: 4, y: 2 }], { x: 0, y: 0 }, { x: 3, y: 2 });
    expect(keys).toEqual(['jump', 'left']);
  });
});
