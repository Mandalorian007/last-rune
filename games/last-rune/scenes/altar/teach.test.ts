import { describe, expect, it } from 'vitest';
import { CODEX } from '../../content/codex';
import { puzzleFor } from '../../content/puzzles';
import { MACHINE_IDS } from '../../rules/types';
import { capacitorStrip, GOAL_RULE, strikesRule } from './altar-defs';
import { HINT_SLOTS, LAMP_LINE, lampLine, pickHint, straightLine } from './moments';
import { firstMultiStrike, hasPicture, newGems, teachPages } from './teach';

const solvedBefore = (id: (typeof MACHINE_IDS)[number]) =>
  MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id)).map((m) => puzzleFor(m));

describe('arrival card pages (teach-4)', () => {
  it('puts the goal first and the ring last on the first altar', () => {
    const pages = teachPages([{ gem: 'bend', how: 'fixed' }], { first: true, firstMulti: false });
    expect(pages.map((p) => p.kind)).toEqual(['goal', 'gem', 'ring']);
  });

  it('explains the strike count once, before the new gems, on the first multi-strike altar', () => {
    const first = MACHINE_IDS.find((id) => firstMultiStrike(puzzleFor(id), solvedBefore(id)));
    expect(first).toBe('capacitor-bay');
    const later = MACHINE_IDS.filter((id) => puzzleFor(id).pulses > 1 && id !== first);
    for (const id of later)
      expect(firstMultiStrike(puzzleFor(id), solvedBefore(id)), id).toBe(false);
    const pages = teachPages([{ gem: 'capacitor', how: 'fixed' }], {
      first: false,
      firstMulti: true,
    });
    expect(pages.map((p) => p.kind)).toEqual(['strikes', 'gem']);
    expect(strikesRule(2)).toMatch(/both/);
    expect(strikesRule(2)).toMatch(/in one strike/);
  });

  it('pictures Gate, Split and Capacitor where each is first met, fixed on the board', () => {
    const pictured: string[] = [];
    for (const id of MACHINE_IDS) {
      const news = newGems(puzzleFor(id), solvedBefore(id));
      for (const f of news.fixed)
        if (hasPicture({ kind: 'gem', gem: f.gem, how: 'fixed' })) pictured.push(f.gem);
    }
    expect(pictured.sort()).toEqual(['capacitor', 'gate', 'split']);
    expect(hasPicture({ kind: 'gem', gem: 'gate', how: 'turns' })).toBe(false);
    expect(hasPicture({ kind: 'gem', gem: 'bend', how: 'fixed' })).toBe(false);
  });

  it("says what Strike does before the pieces, and the Capacitor's two strikes in numbers", () => {
    expect(GOAL_RULE).toMatch(/Strike any time/);
    expect(GOAL_RULE).toMatch(/a miss costs nothing/);
    expect(GOAL_RULE).toMatch(/exactly/);
    expect(capacitorStrip(8)).toEqual(['Strike 1: stores 8 →', 'Strike 2: lets out 8 + 8']);
    // The strip agrees with the codex: it holds the first charge and lets out both.
    expect(CODEX.capacitor.chip).toMatch(/lets out both/);
  });
});

describe('gauge dot and Channel lines (teach-4)', () => {
  it('says what the dot means, red over lit, only to whoever is being taught', () => {
    const base = { reached: true, over: false, teachReach: true, teachOver: false };
    expect(lampLine(base)).toBe('reach');
    expect(lampLine({ ...base, teachReach: false })).toBeNull();
    expect(lampLine({ ...base, reached: false })).toBeNull();
    expect(lampLine({ ...base, over: true, teachOver: true })).toBe('over');
    expect(lampLine({ ...base, over: true, teachOver: false })).toBe('reach');
    // The real semantics: lit = reaches (not an amount); red = the Capacitor overshoots.
    expect(LAMP_LINE.reach).toMatch(/reaches/);
    expect(LAMP_LINE.reach).not.toMatch(/\d/);
    expect(LAMP_LINE.over).toMatch(/Capacitor/);
  });

  it('gives the lamp line a slot below "Holding" and above the how-to', () => {
    expect(HINT_SLOTS).toEqual(['holding', 'lamp', 'howto']);
    expect(pickHint({ lamp: 'x', howto: 'y' })).toBe('lamp');
    expect(pickHint({ holding: 'h', lamp: 'x' })).toBe('holding');
  });

  it('says why Turn stays dim for a gem that never turns', () => {
    expect(straightLine('channel')).toBe('A Channel lies along the run on its own: no turning.');
    expect(straightLine('amplify')).toMatch(/^An? /);
    for (const g of ['bend', 'gate', 'split'] as const) expect(straightLine(g)).toBeNull();
    expect(straightLine(undefined)).toBeNull();
  });
});
