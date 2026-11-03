import { describe, expect, it } from 'vitest';
import { puzzleFor } from '../../content/puzzles';
import { type Placement, simulate } from '../../rules';
import { MACHINE_IDS } from '../../rules/types';
import { previewPath } from './circuit-model';
import { allReached, gaugeReach } from './reach';

/**
 * The lamp's truth, from the rules alone: some strike's charge lands on the gauge. Written apart
 * from `gaugeReach` so the two can disagree.
 */
function reachedByRules(id: (typeof MACHINE_IDS)[number], placements: readonly Placement[]) {
  const p = puzzleFor(id);
  const r = simulate(p, placements);
  return r.machines.map((m) => m.readings.some((x) => x > 0));
}

describe('gauge reach lamps (mobile-7-strike)', () => {
  it('every lamp equals path reachability, gem by gem through each intended solution', () => {
    let checked = 0;
    let lit = 0;
    let unlit = 0;
    for (const id of MACHINE_IDS) {
      const p = puzzleFor(id);
      const plan = p.design.intended;
      for (let n = 0; n <= plan.length; n++) {
        const placements = plan.slice(0, n);
        const sim = simulate(p, placements);
        const lamps = gaugeReach(p, placements, sim);
        expect(lamps, `${id} with ${n} gems`).toEqual(reachedByRules(id, placements));
        // The lamp agrees with the drawn preview: a lit lamp on a strike-1 route has a hop
        // onto its gauge in the preview.
        const hops = previewPath(p, placements, sim).hops;
        p.machines.forEach((m, i) => {
          const onPreview = hops.some((q) => q.to.x === m.at.x && q.to.y === m.at.y);
          if (onPreview) expect(lamps[i], `${id} preview reaches gauge ${i}`).toBe(true);
          if (lamps[i]) lit++;
          else unlit++;
        });
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(lit).toBeGreaterThan(0);
    expect(unlit).toBeGreaterThan(0);
  });

  it('the intended solution lights every lamp, and Strike is ready', () => {
    for (const id of MACHINE_IDS) {
      const p = puzzleFor(id);
      const sim = simulate(p, p.design.intended);
      const lamps = gaugeReach(p, p.design.intended, sim);
      expect(allReached(lamps), id).toBe(true);
    }
  });

  it('a lamp gives no amount away: it is on or off, nothing else', () => {
    for (const id of MACHINE_IDS) {
      const p = puzzleFor(id);
      const sim = simulate(p, p.design.intended);
      for (const v of gaugeReach(p, p.design.intended, sim)) expect(typeof v).toBe('boolean');
    }
  });

  it('the Last Rune as it opens: lamps follow the fixed gems, and Strike is not ready', () => {
    const p = puzzleFor('the-last-rune');
    const sim = simulate(p, []);
    const lamps = gaugeReach(p, [], sim);
    expect(lamps).toEqual(reachedByRules('the-last-rune', []));
    expect(allReached(lamps)).toBe(false);
  });
});
