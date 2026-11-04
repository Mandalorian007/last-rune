import { describe, expect, it } from 'vitest';
import { CODEX } from '../../content/codex';
import { puzzleFor } from '../../content/puzzles';
import { MACHINE_IDS } from '../../rules/types';
import { AMPLIFY_AGAIN, capacitorStrip, eitherRule, GOAL_RULE, strikesRule } from './altar-defs';
import { DOT_LEGEND, HINT_SLOTS, LAMP_LINE, lampLine, pickHint, straightLine } from './moments';
import { firstMultiStrike, gateSides, hasPicture, newGems, teachPages } from './teach';

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
    expect(strikesRule(2)).toMatch(/One tap sends two strikes/);
    expect(strikesRule(2)).toMatch(/miss resets for free/);
    // teach-6: it names the marks beside "Strike ×2".
    expect(strikesRule(2)).toMatch(/each lighting a mark/);
    // teach-7: the rule as the sim reads it (rules/sim.ts): exactly, on strike 1 or strike 2;
    // more trips it. It names strikes by number only, never an amount (D-043).
    expect(eitherRule(2)).toBe(
      'A gauge wakes when strike 1 or strike 2 brings exactly its number; one is enough. A strike that brings more trips it.',
    );
    expect(eitherRule(2).replace(/strike \d/g, '')).not.toMatch(/\d/);
    expect(eitherRule(3)).toMatch(/any strike/);
  });

  it('pictures Gate, Split, Amplify and Capacitor where each is first met, fixed on the board', () => {
    const pictured: string[] = [];
    for (const id of MACHINE_IDS) {
      const news = newGems(puzzleFor(id), solvedBefore(id));
      for (const f of news.fixed)
        if (hasPicture({ kind: 'gem', gem: f.gem, how: 'fixed' })) pictured.push(f.gem);
    }
    expect(pictured.sort()).toEqual(['amplify', 'capacitor', 'gate', 'split']);
    expect(hasPicture({ kind: 'gem', gem: 'gate', how: 'turns' })).toBe(false);
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
    expect(gateSides(2)).toMatch(/ Ports: left and right\.$/);
    expect(gateSides(3)).toMatch(/ Ports: above and below\.$/);
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
    expect(LAMP_LINE.over).toMatch(/Red dot/);
    expect(LAMP_LINE.over).toMatch(/trip/);
    // teach-5: the legend names all three looks and never an amount. teach-6: none is "no
    // dot" (the hollow ring read as 0), and lit never promises enough (D-043).
    expect(DOT_LEGEND.map((r) => r.look)).toEqual(['off', 'on', 'red']);
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
