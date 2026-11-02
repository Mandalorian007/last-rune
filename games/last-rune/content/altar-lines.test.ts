import { describe, expect, it } from 'vitest';
import { GEM_KINDS } from '../rules/types';
import { cardsOf, countI, exactLine, gemNudge, TEACH_NUDGE } from './lines';

describe('altar lines (exact solve, nudges)', () => {
  it('has an exact-solve line for every tier, each one card', () => {
    for (const t of [1, 2, 3, 4] as const) {
      const l = exactLine(t);
      expect(l.kind).toBe('exact');
      expect(l.tier).toBe(t);
      expect(cardsOf(l.text)).toHaveLength(1);
    }
  });

  it('the teach nudge is one short Tier 1 card with no "I"', () => {
    expect(TEACH_NUDGE.id).toBe('nudge.teach');
    expect(cardsOf(TEACH_NUDGE.text)).toHaveLength(1);
    expect(countI(TEACH_NUDGE.text)).toBe(0);
  });

  it('has a one-card nudge for every earned gem, none for channel', () => {
    expect(gemNudge('channel')).toBeUndefined();
    for (const g of GEM_KINDS.filter((x) => x !== 'channel')) {
      const l = gemNudge(g);
      expect(l?.id).toBe(`nudge.${g}`);
      expect(cardsOf(l!.text)).toHaveLength(1);
    }
  });
});
