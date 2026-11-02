import { describe, expect, it } from 'vitest';
import type { PuzzleDef } from '../../rules';
import { BoardState } from './board';

function bench(): PuzzleDef {
  return {
    id: 'intake-desk',
    altar: '6x4',
    blocked: [{ x: 0, y: 0 }],
    fixed: [{ gem: 'bend', cell: { x: 3, y: 1 }, rot: 1 }],
    storm: { at: { x: -1, y: 1 }, dir: 'E', strength: 1 },
    machines: [{ at: { x: 3, y: 4 }, need: 4 }],
    tray: { channel: 2, bend: 1 },
    pulses: 1,
    design: { insight: '', minutes: 1, assumes: [], essential: [], intended: [] },
  };
}

describe('BoardState.lock (hint gems)', () => {
  it('locks a gem that cannot be moved, turned, removed, cleared or undone away', () => {
    const b = new BoardState(bench());
    const cell = { x: 2, y: 2 };
    b.place({ x: 1, y: 1 }, 'channel');
    expect(b.lock(cell, 'bend', 2).ok).toBe(true);
    expect(b.at(cell)).toBeUndefined();
    expect(b.fixedAt(cell)?.gem).toBe('bend');
    expect(b.canUndo).toBe(false);
    expect(b.rotate(cell).ok).toBe(false);
    expect(b.move(cell, { x: 4, y: 0 }).ok).toBe(false);
    expect(b.remove(cell)).toBeNull();
    expect(b.check(cell, 'channel').ok).toBe(false);
    b.clear();
    expect(b.serialise()).toEqual([{ gem: 'bend', cell, rot: 2 }]);
    expect(b.remaining('bend')).toBe(0);
    b.undo();
    expect(b.serialise()).toHaveLength(2);
    expect(b.lockedAt(cell)).toBeDefined();
  });

  it('replaces a gem on the cell and pays from the board when the tray is empty', () => {
    const b = new BoardState(bench());
    b.place({ x: 1, y: 1 }, 'channel');
    b.place({ x: 2, y: 1 }, 'channel');
    expect(b.remaining('channel')).toBe(0);
    expect(b.lock({ x: 4, y: 2 }, 'channel').ok).toBe(true);
    expect(b.remaining('channel')).toBe(0);
    expect(b.placements).toHaveLength(2);
    expect(b.lock({ x: 1, y: 1 }, 'bend', 1).ok).toBe(true);
    expect(b.at({ x: 1, y: 1 })).toBeUndefined();
    expect(b.lockedPlacements).toHaveLength(2);
    expect(b.lock({ x: 0, y: 0 }, 'channel').ok).toBe(false);
  });
});
