import { describe, expect, it } from 'vitest';
import { leaderPath, lockPipBox, segmentHits } from './altar-column';

// A 6x5 board at a 100 px pitch, its slab from (100, 100).
const L = { left: 100, right: 800, top: 100, margin: 50, pitch: 100, rows: 5 };

describe('leaderPath (glyph-truth-2: the teach leader never crosses a lock pip)', () => {
  it('takes the grid line nearer the card when nothing is in the way', () => {
    const p = leaderPath(L, { x: 900, y: 420 }, { x: 2, y: 2 }, 52)!;
    expect(p[3]!.y).toBe(450); // the line under row 2
  });

  it("goes round the target's own pip, which sits on the line below its socket", () => {
    const cell = { x: 2, y: 2 };
    const pip = lockPipBox(L, cell);
    const p = leaderPath(L, { x: 900, y: 420 }, cell, 52, [pip])!;
    expect(p[3]!.y).toBe(350); // the line above row 2
    for (let i = 1; i < p.length; i++) expect(segmentHits(p[i - 1]!, p[i]!, pip, 2)).toBe(false);
  });

  it('is null when both lines are blocked', () => {
    const wall = { l: 0, r: 2000, t: 340, b: 460 };
    expect(leaderPath(L, { x: 900, y: 420 }, { x: 2, y: 2 }, 52, [wall])).toBeNull();
  });
});
