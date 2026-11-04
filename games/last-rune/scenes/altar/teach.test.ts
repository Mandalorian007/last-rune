import { describe, expect, it } from 'vitest';
import { CAP_ONE_STRIKE, CODEX } from '../../content/codex';
import { puzzleFor } from '../../content/puzzles';
import { MACHINE_IDS } from '../../rules/types';
import {
  AMPLIFY_AGAIN,
  capacitorStrip,
  eitherRule,
  GOAL_RULE,
  ONE_STRIKE_RULE,
  strikesRule,
} from './altar-defs';
import { DOT_LEGEND, HINT_SLOTS, LAMP_LINE, lampLine, pickHint, straightLine } from './moments';
import {
  firstMultiStrike,
  gateSides,
  hasPicture,
  newGems,
  teachPages,
  teachRows as teachRowsOf,
} from './teach';

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
    // teach-6: "on strike 1 or 2" (teach-7) gets its own page after the strikes page.
    expect(pages.map((p) => p.kind)).toEqual(['strikes', 'either', 'gem']);
    // teach-5: one tap, two strikes, one after the other; a miss resets for free.
    expect(strikesRule(2)).toMatch(/One tap sends both\./);
    expect(strikesRule(2)).toMatch(/miss resets for free/);
    // teach-6: it names the marks beside "Strike ×2".
    // teach-8: the marks by Strike are the player's strikes.
    expect(strikesRule(2)).toMatch(/^\u25cb\u25cb = your two strikes\./);
    // teach-8: the rule as the sim reads it (rules/sim.ts), in the gauge's words ("on one
    // strike"): each strike alone; exactly wakes it, more trips it. No amount (D-043).
    expect(eitherRule(2)).toBe(ONE_STRIKE_RULE);
    expect(ONE_STRIKE_RULE).toMatch(/on one strike/);
    expect(ONE_STRIKE_RULE).not.toMatch(/\d/);
    expect(eitherRule(3)).toBe(ONE_STRIKE_RULE);
  });

  it('pictures Gate, Split, Amplify and Capacitor where each is first met, fixed on the board', () => {
    const pictured: string[] = [];
    for (const id of MACHINE_IDS) {
      const news = newGems(puzzleFor(id), solvedBefore(id));
      for (const f of news.fixed)
        if (hasPicture({ kind: 'gem', gem: f.gem, how: 'fixed' })) pictured.push(f.gem);
    }
    expect(pictured.sort()).toEqual(['amplify', 'capacitor', 'gate', 'split']);
    // teach-8: a reminder carries it too; a "turns" page (seen before, pictured) stays short.
    expect(hasPicture({ kind: 'gem', gem: 'gate', how: 'turns' })).toBe(false);
    expect(hasPicture({ kind: 'gem', gem: 'split', how: 'fixed', again: true })).toBe(true);
    expect(hasPicture({ kind: 'gem', gem: 'bend', how: 'fixed' })).toBe(false);
  });

  it("says what Strike does before the pieces, and the Capacitor's two strikes in numbers", () => {
    expect(GOAL_RULE).toMatch(/Strike any time/);
    expect(GOAL_RULE).toMatch(/a miss costs nothing/);
    expect(GOAL_RULE).toMatch(/exactly/);
    // teach-6: each line says its whole strike (blind review 8: "stores 8 →" dangled).
    expect(capacitorStrip(8)).toEqual([
      'Strike 1: stores 8, sends nothing.',
      'Strike 2: sends 8 + 8 = 16.',
    ]);
    // teach-6: Amplify's second line in words ("8 → 8" read as a typo).
    expect(AMPLIFY_AGAIN).toBe("A second Amplify doesn't double again.");
    // The strip agrees with the codex: it holds the first charge and lets out both.
    expect(CODEX.capacitor.chip).toMatch(/lets out both/);
  });

  it("names a fixed Gate's sides as its picture shows them (teach-6)", () => {
    // teach-7: the one Gate sentence (codex chip, codex rule, FUSE), then where this Gate's
    // ports are. rot 0: in from the west and east, out north (rules.md).
    expect(gateSides(0)).toBe(
      'Both ports, same strike: the sum leaves by the arrow. Ports: left and right.',
    );
    expect(gateSides(0).startsWith(CODEX.gate.chip)).toBe(true);
    // Relay Tower's Gate: turned once, in from top and bottom, out right.
    expect(gateSides(1)).toMatch(/ Ports: above and below\.$/);
    // teach-8: an altar that strikes once has no "same strike" to compare.
    expect(gateSides(0, 1)).toBe(
      'Feed both round ports, left and right; their sum leaves by the arrow. One port alone: lost.',
    );
    expect(gateSides(1, 1)).toMatch(/round ports, above and below;/);
    expect(gateSides(2)).toMatch(/ Ports: left and right\.$/);
    expect(gateSides(3)).toMatch(/ Ports: above and below\.$/);
  });
});

describe('gauge dot and Channel lines (teach-4)', () => {
  it('says what the dot means, only to whoever is being taught', () => {
    const base = { reached: true, teachReach: true };
    expect(lampLine(base)).toBe('reach');
    expect(lampLine({ ...base, teachReach: false })).toBeNull();
    expect(lampLine({ ...base, reached: false })).toBeNull();
    // The real semantics: lit = reaches (not an amount). teach-8 (D-043): no red forecast.
    expect(LAMP_LINE.reach).toMatch(/reaches/);
    expect(LAMP_LINE.reach).not.toMatch(/\d/);
    expect(LAMP_LINE.reach).not.toMatch(/red|trip/i);
    // teach-5: the legend names all three looks and never an amount. teach-6: none is "no
    // dot" (the hollow ring read as 0), and lit never promises enough (D-043).
    expect(DOT_LEGEND.map((r) => r.look)).toEqual(['off', 'on']);
    for (const r of DOT_LEGEND) expect(r.text).not.toMatch(/\d|enough|exact|hollow|ring/i);
    expect(DOT_LEGEND[0]!.text).toMatch(/^No dot/);
    expect(LAMP_LINE.reach).not.toMatch(/hollow/);
  });

  it('gives the lamp line a slot below "Holding" and above the how-to', () => {
    expect(HINT_SLOTS).toEqual(['holding', 'lamp', 'howto']);
    expect(pickHint({ lamp: 'x', howto: 'y' })).toBe('lamp');
    expect(pickHint({ holding: 'h', lamp: 'x' })).toBe('holding');
  });

  it('says why Turn stays dim for a gem that never turns', () => {
    expect(straightLine('channel')).toBe(
      'A Channel works whichever way the charge comes in: no need to turn it.',
    );
    expect(straightLine('amplify')).toMatch(/^An? /);
    for (const g of ['bend', 'gate', 'split'] as const) expect(straightLine(g)).toBeNull();
    expect(straightLine(undefined)).toBeNull();
  });
});

describe('every piece taught on first sight (teach-8)', () => {
  const play = [
    'intake-desk',
    'furnace',
    'conveyor-a',
    'splitter-mill',
    'storm-cell-2',
    'press-unit-4',
  ] as const;
  const playedBefore = (id: (typeof play)[number]) =>
    play.slice(0, play.indexOf(id)).map((m) => puzzleFor(m));

  it('reminds of a piece taught elsewhere until the player has had one in hand', () => {
    // Played Conveyor A first: Splitter Mill's Split was taught there, never placed.
    const mill = newGems(puzzleFor('splitter-mill'), playedBefore('splitter-mill'));
    expect(mill.fixed).toEqual([]);
    expect(mill.remind.map((r) => r.gem)).toEqual(['split']);
    expect(mill.remind[0]!.cell).toBeDefined();
    // Press Unit 4 puts the first Amplify in the tray.
    expect(newGems(puzzleFor('press-unit-4'), playedBefore('press-unit-4')).remind).toEqual([
      { gem: 'amplify' },
    ]);
    // Once a Split has been in the hand on a solved altar, no reminder.
    const later = [...playedBefore('press-unit-4'), puzzleFor('press-unit-4')];
    expect(newGems(puzzleFor('splitter-mill'), later).remind).toEqual([]);
    const pages = teachPages(teachRowsOf(mill), { first: false, firstMulti: false });
    expect(pages).toEqual([{ kind: 'gem', gem: 'split', how: 'fixed', again: true }]);
    expect(hasPicture(pages[0]!)).toBe(true);
  });

  it('teaches a gem once, at whichever altar it is first met', () => {
    // Splitter Mill played straight after Furnace: its Split is new there.
    const mill = newGems(puzzleFor('splitter-mill'), playedBefore('conveyor-a'));
    expect(mill.fixed.map((f) => f.gem)).toEqual(['split']);
    // Then Conveyor A, the Split taught at Splitter Mill (not yet solved): not new again.
    const taught = { split: 'splitter-mill' };
    const conveyor = newGems(puzzleFor('conveyor-a'), playedBefore('conveyor-a'), taught);
    expect(conveyor.fixed.map((f) => f.gem)).toEqual([]);
    expect(conveyor.remind.map((r) => r.gem)).toContain('split');
    // The altar that taught it keeps teaching it until it is solved.
    const again = newGems(puzzleFor('splitter-mill'), playedBefore('conveyor-a'), taught);
    expect(again.fixed.map((f) => f.gem)).toEqual(['split']);
  });

  it("names Control Booth's one-strike Capacitor even to a player who has held one", () => {
    // Every other altar solved first, Roof Array's Capacitor among them.
    const all = MACHINE_IDS.filter((m) => m !== 'control-booth' && m !== 'the-last-rune').map((m) =>
      puzzleFor(m),
    );
    const booth = puzzleFor('control-booth');
    expect(booth.pulses).toBeLessThanOrEqual(1);
    expect(newGems(booth, all).remind).toEqual([{ gem: 'capacitor' }]);
    // Where it has two strikes, a Capacitor already held is not repeated.
    const roof = puzzleFor('roof-array');
    expect(roof.pulses).toBeGreaterThan(1);
    expect(newGems(roof, all).remind.map((r) => r.gem)).not.toContain('capacitor');
    expect(CAP_ONE_STRIKE).toBe('One strike here: what a Capacitor stores never comes out.');
  });
});
