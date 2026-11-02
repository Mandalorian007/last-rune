import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { type Placement, simulate } from '../../rules';
import { altarDims } from '../../rules/model';
import type { MachineId } from '../../rules/types';
import { chargeChips, liveSockets, previewPath } from './circuit-model';
import { CAPTION_LANE, computeLayout, FUSE_LANE, traySlotAt, trayTipX } from './layout';
import { firstSentence, newGems, nudgeGems } from './teach';

const P = (gem: Placement['gem'], x: number, y: number, rot: Placement['rot'] = 0): Placement => ({
  gem,
  cell: { x, y },
  rot,
});

describe('circuit preview', () => {
  it('follows placed gems and marks the next open socket', () => {
    const p = puzzleFor('intake-desk');
    const pl = [P('channel', 0, 1), P('channel', 1, 1)];
    const pv = previewPath(p, pl, simulate(p, pl));
    expect(pv.hops.map((h) => h.to)).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(pv.openEnds).toEqual([{ x: 2, y: 1 }]);
  });

  it('on an empty board the open end is the storm entry socket', () => {
    const p = puzzleFor('intake-desk');
    const pv = previewPath(p, [], simulate(p, []));
    expect(pv.hops).toEqual([]);
    expect(pv.openEnds).toEqual([{ x: 0, y: 1 }]);
  });

  it('reaches the machine on the intended solution with no open ends', () => {
    const p = puzzleFor('intake-desk');
    const pv = previewPath(p, p.design.intended, simulate(p, p.design.intended));
    expect(pv.openEnds).toEqual([]);
    expect(pv.hops.at(-1)!.to).toEqual(p.machines[0]!.at);
  });
});

describe('live sockets', () => {
  it('keeps entry, exits and gem neighbourhoods live and leaves the rest quiet', () => {
    const p = puzzleFor('intake-desk');
    const { w, h } = altarDims(p.altar);
    const mask = liveSockets(p, [], [{ x: 0, y: 1 }]);
    const live = (x: number, y: number) => mask[y * w + x] === 1;
    expect(live(0, 1)).toBe(true); // storm entry
    const exit = p.machines[0]!.at;
    expect(live(Math.min(w - 1, exit.x), Math.min(h - 1, exit.y))).toBe(true);
    const f = p.fixed[0]!.cell;
    expect(live(f.x, f.y)).toBe(true);
    expect(live(f.x + 1, f.y)).toBe(true);
    // Most of a 6x4 board with one fixed gem is quiet.
    const n = mask.reduce((a, b) => a + b, 0);
    expect(n).toBeLessThan((w * h) / 2);
  });
});

describe('charge chips', () => {
  it('marks the storm hop and every change of charge', () => {
    const p = puzzleFor('furnace');
    const r = simulate(p, p.design.intended);
    const chips = chargeChips(r);
    expect(chips[0]!.charge).toBe(4);
    // Furnace doubles once: one chip at 8.
    expect(chips.some((c) => c.charge === 8)).toBe(true);
    // Channels and Bends pass charge unchanged: far fewer chips than hops.
    expect(chips.length).toBeLessThan(r.trace.length);
  });

  it('gives each strike its own storm chip', () => {
    for (const p of Object.values(PUZZLES)) {
      if (p.pulses < 2) continue;
      const r = simulate(p, p.design.intended);
      const chips = chargeChips(r);
      for (let i = 0; i < r.pulsesRun; i++) expect(chips.some((c) => c.pulse === i)).toBe(true);
    }
  });
});

describe('new gems', () => {
  const solvedOf = (ids: MachineId[]) => ids.map((id) => puzzleFor(id));

  it('introduces the first three altars’ gems once each', () => {
    const intake = newGems(puzzleFor('intake-desk'), []);
    expect(intake.fixed.map((f) => f.gem)).toEqual(['bend']);
    expect(intake.tray).toEqual(['channel']);
    const furnace = newGems(puzzleFor('furnace'), solvedOf(['intake-desk']));
    expect(furnace.fixed.map((f) => f.gem)).toEqual(['amplify']);
    expect(furnace.tray).toEqual([]);
    const split = newGems(puzzleFor('splitter-mill'), solvedOf(['intake-desk', 'furnace']));
    expect(split.fixed.map((f) => f.gem)).toEqual(['split']);
    expect(split.tray).toEqual([]);
  });

  it('is quiet when replaying a solved altar', () => {
    const all = Object.values(PUZZLES);
    expect(newGems(puzzleFor('furnace'), all)).toEqual({ fixed: [], tray: [] });
  });

  it('has a FUSE nudge for every new gem, Channel included', () => {
    const intake = newGems(puzzleFor('intake-desk'), []);
    expect(nudgeGems(intake)).toEqual(['bend', 'channel']);
    for (const p of Object.values(PUZZLES)) {
      const news = newGems(p, []);
      const kinds = [...news.fixed.map((f) => f.gem), ...news.tray];
      expect(nudgeGems(news).sort()).toEqual([...new Set(kinds)].sort());
    }
  });
});

describe('teach card', () => {
  it('pins only the first sentence of a rule', () => {
    expect(firstSentence('Turns the bolt 90°. Hit it wrong and it fizzles.')).toBe(
      'Turns the bolt 90°.',
    );
    expect(firstSentence('No full stop')).toBe('No full stop');
    expect(firstSentence('Holds 2.5 units. Then fires.')).toBe('Holds 2.5 units.');
  });
});

describe('layout labels', () => {
  it('keeps every need label on the canvas', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      for (const m of L.machines) {
        expect(m.label.x).toBeGreaterThan(0);
        expect(m.label.x).toBeLessThan(1920 - (m.label.align === 'right' ? 240 : 120));
        expect(m.label.y).toBeLessThan(L.trayY - 40);
      }
    }
  });

  it('keeps labels out of the caption lane', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      for (const m of L.machines) {
        // Label box after a strike: "Needs N", "got M" (~100 px), plus the strike row.
        const hgt = 100 + (p.pulses > 1 ? 30 : 0);
        const right = m.label.align === 'right';
        const x1 = right ? m.label.x + 14 + 240 : m.label.x + 120;
        const y1 = right ? m.label.y + hgt / 2 : m.label.y + 12 + hgt;
        expect(x1 > CAPTION_LANE.x && y1 > CAPTION_LANE.y, p.id).toBe(false);
      }
    }
  });
});

describe('caption and FUSE lanes', () => {
  it('fits every tray between FUSE and the caption, slots still distinct', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      for (const [i, s] of L.tray.entries()) {
        expect(s.x - s.size / 2, p.id).toBeGreaterThan(FUSE_LANE.x);
        expect(s.x + s.size / 2, p.id).toBeLessThan(CAPTION_LANE.x);
        expect(traySlotAt(L, s.x, s.y)).toBe(i);
      }
    }
  });

  it('clamps the tray tooltip between the lanes', () => {
    expect(trayTipX(470, 360)).toBe(FUSE_LANE.x + 180);
    expect(trayTipX(1070, 360)).toBe(CAPTION_LANE.x - 180);
    expect(trayTipX(770, 200)).toBe(770);
  });

  it('keeps the storm off a machine that shares its side', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      const st = L.storm;
      for (const m of L.machines) {
        if (m.side !== st.side || (m.side !== 1 && m.side !== 3)) continue;
        // Storm stand (~0.2 size wide) vs cabinet (~0.9 size wide).
        const gap = Math.abs(st.x - m.x) - 0.12 * st.size - 0.45 * m.size;
        expect(gap, p.id).toBeGreaterThan(-4);
      }
    }
  });
});
