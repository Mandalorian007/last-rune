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

describe('BoardState', () => {
  it('places within tray limits and rejects illegal sockets', () => {
    const b = new BoardState(bench());
    expect(b.place({ x: 1, y: 1 }, 'channel').ok).toBe(true);
    expect(b.place({ x: 1, y: 1 }, 'channel')).toEqual({ ok: false, reason: 'occupied' });
    expect(b.place({ x: 0, y: 0 }, 'channel')).toEqual({ ok: false, reason: 'blocked' });
    expect(b.place({ x: 3, y: 1 }, 'channel')).toEqual({ ok: false, reason: 'fixed' });
    expect(b.place({ x: 6, y: 1 }, 'channel')).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(b.place({ x: 2, y: 1 }, 'channel').ok).toBe(true);
    expect(b.place({ x: 2, y: 2 }, 'channel')).toEqual({ ok: false, reason: 'tray-empty' });
    expect(b.remaining('channel')).toBe(0);
    expect(b.remaining('bend')).toBe(1);
    expect(b.trayKinds).toEqual(['channel', 'bend']);
  });

  it('rotates only Bend, Gate and Split, wrapping 3 → 0', () => {
    const b = new BoardState(bench());
    b.place({ x: 1, y: 2 }, 'bend', 3);
    b.place({ x: 2, y: 2 }, 'channel', 3);
    expect(b.at({ x: 2, y: 2 })!.rot).toBe(0);
    b.rotate({ x: 1, y: 2 });
    expect(b.at({ x: 1, y: 2 })!.rot).toBe(0);
    b.rotate({ x: 1, y: 2 }, -1);
    expect(b.at({ x: 1, y: 2 })!.rot).toBe(3);
    const rev = b.revision;
    expect(b.rotate({ x: 2, y: 2 }).ok).toBe(true);
    expect(b.revision).toBe(rev);
    expect(b.rotate({ x: 3, y: 1 })).toEqual({ ok: false, reason: 'fixed' });
    expect(b.rotate({ x: 4, y: 3 })).toEqual({ ok: false, reason: 'empty' });
  });

  it('moves, removes and clears as single undo steps', () => {
    const b = new BoardState(bench());
    b.place({ x: 1, y: 1 }, 'channel');
    b.place({ x: 1, y: 2 }, 'bend', 2);
    expect(b.move({ x: 1, y: 1 }, { x: 1, y: 2 })).toEqual({ ok: false, reason: 'occupied' });
    expect(b.move({ x: 1, y: 1 }, { x: 4, y: 3 }).ok).toBe(true);
    expect(b.at({ x: 4, y: 3 })?.gem).toBe('channel');
    expect(b.remove({ x: 1, y: 2 })?.gem).toBe('bend');
    expect(b.clear()).toBe(true);
    expect(b.isEmpty).toBe(true);
    expect(b.undo()).toBe(true); // un-clear
    expect(b.placements).toHaveLength(1);
    expect(b.undo()).toBe(true); // un-remove
    expect(b.at({ x: 1, y: 2 })).toMatchObject({ gem: 'bend', rot: 2 });
    expect(b.undo()).toBe(true); // un-move
    expect(b.at({ x: 1, y: 1 })?.gem).toBe('channel');
    expect(b.undo()).toBe(true);
    expect(b.undo()).toBe(true);
    expect(b.isEmpty).toBe(true);
    expect(b.undo()).toBe(false);
  });

  it('undo restores rotation without aliasing', () => {
    const b = new BoardState(bench());
    b.place({ x: 1, y: 2 }, 'bend', 0);
    b.rotate({ x: 1, y: 2 });
    b.rotate({ x: 1, y: 2 });
    expect(b.at({ x: 1, y: 2 })!.rot).toBe(2);
    b.undo();
    expect(b.at({ x: 1, y: 2 })!.rot).toBe(1);
    b.undo();
    expect(b.at({ x: 1, y: 2 })!.rot).toBe(0);
  });

  it('serialises and restores, dropping placements that are no longer legal', () => {
    const b = new BoardState(bench());
    b.place({ x: 1, y: 1 }, 'channel');
    b.place({ x: 4, y: 2 }, 'bend', 3);
    const saved = b.serialise();
    saved[0]!.cell.x = 99; // copies, not live objects
    expect(b.at({ x: 1, y: 1 })).toBeDefined();

    const c = new BoardState(bench());
    const dropped = c.restore([
      { gem: 'channel', cell: { x: 1, y: 1 }, rot: 0 },
      { gem: 'bend', cell: { x: 4, y: 2 }, rot: 3 },
      { gem: 'channel', cell: { x: 0, y: 0 }, rot: 0 }, // blocked
      { gem: 'channel', cell: { x: 3, y: 1 }, rot: 0 }, // fixed
      { gem: 'channel', cell: { x: 2, y: 3 }, rot: 0 },
      { gem: 'channel', cell: { x: 5, y: 3 }, rot: 0 }, // over the tray count
      { gem: 'split', cell: { x: 5, y: 0 }, rot: 0 }, // not in this tray
    ]);
    expect(dropped).toBe(4);
    expect(c.placements).toHaveLength(3);
    expect(c.equals(b.serialise())).toBe(false);
    c.remove({ x: 2, y: 3 });
    expect(c.equals(b.serialise())).toBe(true);
  });

  it('restored gems come back with their undo history, one step per gem (altar-truth)', () => {
    const c = new BoardState(bench());
    c.restore([
      { gem: 'channel', cell: { x: 1, y: 1 }, rot: 0 },
      { gem: 'bend', cell: { x: 4, y: 2 }, rot: 3 },
    ]);
    expect(c.canUndo).toBe(true);
    c.undo();
    expect(c.placements.map((p) => p.gem)).toEqual(['channel']);
    c.undo();
    expect(c.placements).toHaveLength(0);
    expect(c.canUndo).toBe(false);
    // An empty save leaves nothing to undo.
    c.restore([]);
    expect(c.canUndo).toBe(false);
  });
});
