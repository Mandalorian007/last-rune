import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { type Placement, simulate } from '../../rules';
import { altarDims } from '../../rules/model';
import type { MachineId } from '../../rules/types';
import { chargeChips, liveSockets, previewPath } from './circuit-model';
import { computeLayout } from './layout';
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

  it('has a FUSE nudge for every new gem but Channel', () => {
    const intake = newGems(puzzleFor('intake-desk'), []);
    expect(nudgeGems(intake)).toEqual(['bend']);
    for (const p of Object.values(PUZZLES)) {
      const news = newGems(p, []);
      const kinds = [...news.fixed.map((f) => f.gem), ...news.tray].filter((g) => g !== 'channel');
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
});
