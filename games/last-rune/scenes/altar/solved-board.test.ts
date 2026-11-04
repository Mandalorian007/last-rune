import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { simulate } from '../../rules';
import { solvedLook } from './solved-board';

const at = (x: number, y: number) => ({ x, y });
const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;

describe('solvedLook (solve-truth: the solve shows the board the player built)', () => {
  const furnace = puzzleFor('furnace');
  const look = solvedLook(furnace, furnace.design.intended);

  it('the Furnace intended board is a real solve', () => {
    expect(look.sim.outcome).toBe('exact');
  });

  it('lights exactly the gems on the powered route, never the fixed Amplify off it', () => {
    // ┐ = └ A = ┐ └ = = from the storm to the gauge (column, row from 0).
    const route = [at(0, 0), at(0, 1), at(0, 2), at(1, 2), at(2, 2), at(3, 2), at(3, 3)];
    route.push(at(4, 3), at(5, 3));
    expect(look.lit.map(key).sort()).toEqual(route.map(key).sort());
    expect(look.lit.map(key)).not.toContain('4,1');
  });

  it('the Channel between the two Bends is entered from above (it shows vertical)', () => {
    const into = look.hops.find((h) => h.to.x === 0 && h.to.y === 1);
    expect(into).toBeDefined();
    expect(into!.to.x - into!.from.x).toBe(0);
    expect(into!.to.y - into!.from.y).toBe(1);
  });

  it('the fixed gems keep their collar', () => {
    expect(look.collars.map(key).sort()).toEqual(['1,2', '4,1']);
  });

  it('a Channel turns nothing in the rules: its look comes from the bolt, not its rot', () => {
    // (a) ruled out: Channel is not rotational, so the sim ignores its rot; Bends' rot counts.
    const turned = furnace.design.intended.map((p) =>
      p.gem === 'channel' ? { ...p, rot: 1 as const } : p,
    );
    expect(simulate(furnace, turned).outcome).toBe('exact');
    const bent = furnace.design.intended.map((p) =>
      p.gem === 'bend' && p.cell.x === 0 && p.cell.y === 0 ? { ...p, rot: 1 as const } : p,
    );
    expect(simulate(furnace, bent).outcome).not.toBe('exact');
  });

  it('every puzzle: lit gems are gems the bolt reached; unreached fixed gems stay dark', () => {
    for (const p of Object.values(PUZZLES)) {
      const l = solvedLook(p, p.design.intended);
      const gems = new Set([...p.fixed, ...p.design.intended].map((g) => key(g.cell)));
      const reached = new Set(l.hops.map((h) => key(h.to)));
      for (const c of l.lit) {
        expect(gems.has(key(c)), `${p.id} lit ${key(c)} has no gem`).toBe(true);
        expect(reached.has(key(c)), `${p.id} lit ${key(c)} no bolt reached`).toBe(true);
      }
      for (const f of p.fixed)
        if (!reached.has(key(f.cell)))
          expect(l.lit.map(key), `${p.id} fixed ${key(f.cell)}`).not.toContain(key(f.cell));
      expect(l.collars.map(key).sort()).toEqual(p.fixed.map((f) => key(f.cell)).sort());
    }
  });
});
