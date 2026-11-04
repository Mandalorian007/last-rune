import { describe, expect, it } from 'vitest';
import pitchRaw from '../../../docs/design/pitch-v0.3.md?raw';
import scriptRaw from '../../../docs/design/script.md?raw';
import {
  ALL_CAPABILITIES,
  capabilityKey,
  dependentsOf,
  enumerateReachableStates,
  getMachine,
} from '../rules/progression';
import { GEM_KINDS, MACHINE_IDS, type Tier } from '../rules/types';
import {
  coffeeLink,
  DISCORD_INVITE_URL,
  ENDING_SEQUENCE,
  endingButtons,
  KOFI_URL,
  safetyRecordLine,
} from './ending';
import { JOURNAL, pagesFound } from './journal';
import {
  beatLine,
  cardsOf,
  codexNote,
  countI,
  LINES,
  lineById,
  lockedLineFor,
  MAX_WORDS_PER_CARD,
  machineLine,
  reactionLine,
  socketLine,
  titleLines,
  wordCount,
} from './lines';

// The pitch is plain text in a fenced block; normalise whitespace only.
const pitch = pitchRaw.replace(/\s+/g, ' ');
const script = scriptRaw.replace(/\s+/g, ' ');

/** Every FUSE utterance with its tier: lines plus journal rebuttals. */
const fuseUtterances: { id: string; text: string; tier: Tier; source: string }[] = [
  ...LINES.map((l) => ({ id: l.id, text: l.text, tier: l.tier, source: l.source })),
  ...JOURNAL.flatMap((p) =>
    p.rebuttal ? [{ id: `rebuttal.${p.page}`, text: p.rebuttal, tier: p.tier, source: 'new' }] : [],
  ),
];

describe('text utilities', () => {
  it('counts words and I', () => {
    expect(wordCount("Bzzt. That wasn't one.")).toBe(4);
    expect(wordCount('Day 14,610. A visitor.')).toBe(4);
    expect(countI("I cut… the foundry. I'll go. I've. It is. If. 'I")).toBe(4);
    expect(countI('Ice gem. In. Is it.')).toBe(0);
  });

  it('splits long lines into cards at sentence boundaries', () => {
    const t = lineById('archive.solve').text;
    const cards = cardsOf(t);
    expect(cards.length).toBe(2);
    expect(cards.join(' ')).toBe(t);
    for (const c of cards) expect(wordCount(c)).toBeLessThanOrEqual(MAX_WORDS_PER_CARD);
    expect(cardsOf('Short line.')).toEqual(['Short line.']);
  });
});

describe('lines', () => {
  it('has unique ids', () => {
    const ids = LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pitch line is verbatim from the pitch', () => {
    for (const l of LINES.filter((x) => x.source === 'pitch')) {
      expect(pitch.includes(l.text), l.id).toBe(true);
    }
    for (const p of JOURNAL.filter((x) => x.source === 'pitch')) {
      expect(pitch.includes(p.text), `page ${p.page}`).toBe(true);
      if (p.direction) expect(pitch.includes(p.direction)).toBe(true);
    }
    for (const s of ENDING_SEQUENCE) {
      if ((s.type === 'direction' && s.source !== 'new') || s.type === 'silence') {
        const t = s.type === 'direction' ? s.text : s.note;
        expect(pitch.includes(t), t).toBe(true);
      }
    }
  });

  it('new lines are not copies of pitch lines', () => {
    for (const l of fuseUtterances.filter((x) => x.source === 'new')) {
      expect(pitch.includes(l.text), l.id).toBe(false);
    }
  });

  it('every new FUSE line fits one card (≤ 20 words)', () => {
    for (const l of fuseUtterances.filter((x) => x.source === 'new')) {
      expect(wordCount(l.text), `${l.id}: ${l.text}`).toBeLessThanOrEqual(MAX_WORDS_PER_CARD);
    }
  });

  it('every line splits into cards of ≤ 20 words with text unchanged', () => {
    for (const l of LINES) {
      const cards = cardsOf(l.text);
      expect(cards.join(' '), l.id).toBe(l.text);
      expect(cards.length, l.id).toBeLessThanOrEqual(3);
      for (const c of cards) expect(wordCount(c), `${l.id}: ${c}`).toBeLessThanOrEqual(20);
    }
  });

  it('every machine but the Last Rune has one arrive and one solve line, in its own tier', () => {
    for (const id of MACHINE_IDS) {
      for (const kind of ['arrive', 'solve'] as const) {
        const matches = LINES.filter(
          (l) => (l.kind === 'arrive' || l.kind === 'solve') && l.kind === kind && l.machine === id,
        );
        if (id === 'the-last-rune') {
          expect(matches).toHaveLength(0);
        } else {
          expect(matches, `${id}.${kind}`).toHaveLength(1);
          expect(matches[0]!.tier).toBe(getMachine(id).tier);
        }
      }
    }
  });

  it('the Last Rune is silent until the final gem, then speaks', () => {
    expect(machineLine('the-last-rune', 'arrive')).toBeUndefined();
    expect(ENDING_SEQUENCE[0]!.type).toBe('silence');
    expect(beatLine('rune-final-report').text).toMatch(/^Incident report, final\./);
  });

  it('every capability has a socket line', () => {
    for (const c of ALL_CAPABILITIES) expect(socketLine(capabilityKey(c)).kind).toBe('socket');
  });

  it('locked lines point at a real requirement of their machine, and only a few doors have one', () => {
    const locked = LINES.filter((l) => l.kind === 'locked');
    expect(locked.length).toBeLessThanOrEqual(10);
    for (const l of locked) {
      if (l.kind !== 'locked') continue;
      const m = getMachine(l.machine);
      if (l.when === 'machines') expect(m.requiresSolved?.length).toBeGreaterThan(0);
      else expect(m.requires.map(capabilityKey), l.id).toContain(l.when);
      // Heard before the machine's own tier (or in Tier 1).
      expect(l.tier).toBeLessThanOrEqual(Math.max(1, m.tier - 1));
    }
    expect(lockedLineFor('press-unit-4', ['gem:split'], 0)?.id).toBe('press-unit-4.locked');
    expect(lockedLineFor('press-unit-4', ['gem:amplify'], 0)).toBeUndefined();
    expect(lockedLineFor('control-booth', [], 3)?.id).toBe('control-booth.locked');
  });

  it('has a reaction for every outcome in every tier, and respects gem conditions', () => {
    for (const outcome of ['dead', 'under', 'over'] as const) {
      for (const tier of [1, 2, 3, 4] as const) {
        expect(reactionLine(outcome, tier)).toBeDefined();
        expect(reactionLine(outcome, tier, { cause: 'empty' })).toBeDefined();
      }
    }
    for (let i = 0; i < 8; i++) {
      expect(reactionLine('dead', 1, { cause: 'facing', gem: 'gate' }, i)?.text).not.toMatch(
        /Bend/,
      );
    }
  });

  it("picks FUSE's failure quip by the root fizzle, never a mismatched one", () => {
    const causes = [
      'empty',
      'blocked',
      'ground',
      'facing',
      'odd-split',
      'gate-alone',
      'spent',
    ] as const;
    const causeLines = LINES.filter((l) => l.kind === 'reaction' && l.cause);
    for (const cause of causes) {
      // The first failure gets a line about its own cause (tier 1).
      const first = reactionLine('dead', 1, { cause });
      expect(first?.kind === 'reaction' && first.cause, cause).toBe(cause);
      // No pick ever lands on another cause's line.
      for (let i = 0; i < 8; i++) {
        for (const outcome of ['dead', 'under'] as const) {
          const l = reactionLine(outcome, 1, { cause }, i);
          if (l?.kind === 'reaction' && l.cause) expect(l.cause).toBe(cause);
        }
      }
    }
    // The Bend line only when the root fizzle is a Bend facing away, and then first.
    expect(reactionLine('dead', 1, { cause: 'facing', gem: 'bend' })?.text).toMatch(/Bend/);
    for (let i = 0; i < 8; i++) {
      expect(reactionLine('dead', 1, { cause: 'empty' }, i)?.text).not.toMatch(/Bend/);
      expect(reactionLine('dead', 1, undefined, i)?.text).not.toMatch(/Bend/);
    }
    // Without a root, or on a breaker trip, only the outcome's generic lines.
    for (let i = 0; i < 8; i++) {
      for (const l of [
        reactionLine('dead', 1, undefined, i),
        reactionLine('over', 1, { cause: 'empty' }, i),
        reactionLine('dead', 3, { cause: 'empty' }, i),
      ])
        expect(causeLines).not.toContain(l);
    }
  });

  it('has a codex margin note for every gem', () => {
    for (const g of GEM_KINDS) expect(codexNote(g)).toBeDefined();
  });

  it('the lines from beyond the door are in sentence case', () => {
    expect(
      (['beyond-arrived', 'beyond-arguing', 'beyond-day-1'] as const).map((b) => beatLine(b).text),
    ).toEqual([
      'Hello. This unit has arrived somewhere with a great many people in it.',
      'You appear to be arguing about a game.',
      'Day 1.',
    ]);
  });

  it('"I" is rationed: zero in Tier 1, and rising through Tiers 1 → 3', () => {
    const byTier = [1, 2, 3].map((t) =>
      fuseUtterances.filter((u) => u.tier === t).reduce((n, u) => n + countI(u.text), 0),
    );
    expect(byTier[0]).toBe(0);
    expect(byTier[1]!).toBeGreaterThan(byTier[0]!);
    expect(byTier[2]!).toBeGreaterThan(byTier[1]!);
  });

  it('"I" also rises per machine line (arrive + solve), Tier 1 → 3', () => {
    const rate = (t: Tier) => {
      const ls = LINES.filter((l) => (l.kind === 'arrive' || l.kind === 'solve') && l.tier === t);
      return ls.reduce((n, l) => n + countI(l.text), 0) / ls.length;
    };
    expect(rate(1)).toBe(0);
    expect(rate(2)).toBeGreaterThan(rate(1));
    expect(rate(3)).toBeGreaterThan(rate(2));
  });

  it('new Tier 2 lines leave the "I" to the pitch', () => {
    const t2new = fuseUtterances.filter((u) => u.tier === 2 && u.source === 'new');
    expect(t2new.reduce((n, u) => n + countI(u.text), 0)).toBe(0);
  });
});

describe('title chatter', () => {
  const lines = titleLines();

  it('is a pool of 15–25 new, short Tier 1 lines', () => {
    expect(lines.length).toBeGreaterThanOrEqual(15);
    expect(lines.length).toBeLessThanOrEqual(25);
    for (const l of lines) {
      expect(l.tier, l.id).toBe(1);
      expect(l.source, l.id).toBe('new');
      // Idle captions on a menu: shorter than the card limit.
      expect(wordCount(l.text), l.text).toBeLessThanOrEqual(16);
      expect(countI(l.text), l.text).toBe(0);
    }
    expect(new Set(lines.map((l) => l.text)).size).toBe(lines.length);
  });

  it('gives nothing away: no ending, no Builder, no Discord', () => {
    const banned =
      /discord|builder|upload|day 1\b|the door|for you|key|journal|page sixteen|cot\b|chat|lights on until/i;
    for (const l of lines) expect(l.text, l.id).not.toMatch(banned);
  });
});

describe('journal', () => {
  it('has pages 1–16 exactly once, 8 from the pitch and 8 new', () => {
    expect(JOURNAL.map((p) => p.page)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(JOURNAL.filter((p) => p.source === 'pitch')).toHaveLength(8);
    expect(JOURNAL.filter((p) => p.source === 'new')).toHaveLength(8);
  });

  it('maps every page to a machine of its tier; every regular machine gives one (archive two)', () => {
    for (const p of JOURNAL) expect(getMachine(p.unlockedBy).tier).toBe(p.tier);
    for (const id of MACHINE_IDS) {
      const n = JOURNAL.filter((p) => p.unlockedBy === id).length;
      const expected = id === 'archive' ? 2 : id === 'the-last-rune' ? 0 : 1;
      expect(n, id).toBe(expected);
    }
  });

  it('page 16 comes from the control booth and is dated Day 1 (clue 4)', () => {
    const p16 = JOURNAL.find((p) => p.page === 16)!;
    expect(p16.unlockedBy).toBe('control-booth');
    expect(p16.dateline).toBe('Day 1');
    expect(p16.rebuttal).toBeNull();
    for (const p of JOURNAL.filter((x) => x.page < 16)) expect(p.dateline).toMatch(/^Day \d/);
  });

  it('page four holds the line the archive quotes, and is always found before the archive (clue 3)', () => {
    const quote = /(?<!\w)'(.+?)'(?!\w)/.exec(lineById('archive.solve').text)![1]!;
    const p4 = JOURNAL.find((p) => p.page === 4)!;
    expect(p4.text).toContain(quote);
    expect(dependentsOf(p4.unlockedBy)).toContain('archive');
  });

  it('every page is reachable, and all 16 are found by the end', () => {
    const states = enumerateReachableStates();
    const last = states.find((s) => s.solved.length === MACHINE_IDS.length)!;
    expect(pagesFound(last.solved)).toHaveLength(16);
  });

  it('lays every rung of the clue ladder, with the last rung last', () => {
    const rungs = new Set(JOURNAL.flatMap((p) => p.clues ?? []));
    // Rung 5 ("I", stops mid-sentence) lives in FUSE's lines; pages echo it in Tier 3.
    expect([...rungs].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(JOURNAL.filter((p) => p.clues?.includes(4)).map((p) => p.page)).toEqual([16]);
  });

  it('Tier 1 pages and plates rhyme without FUSE saying "I"', () => {
    for (const p of JOURNAL.filter((x) => x.tier === 1)) expect(countI(p.rebuttal ?? '')).toBe(0);
  });
});

describe('ending', () => {
  it('uses the invite constant and hides empty or unsafe links', () => {
    expect(DISCORD_INVITE_URL).toMatch(/^https:\/\//);
    expect(endingButtons().map((b) => b.id)).toContain('join');
    expect(endingButtons('', '')).toEqual([]);
    expect(endingButtons('   ', 'javascript:alert(1)')).toEqual([]);
    expect(endingButtons('', 'https://example.itch.io').map((b) => b.id)).toEqual(['coffee']);
  });

  it('links Ko-fi on https only (D-034)', () => {
    expect(KOFI_URL).toBe('https://ko-fi.com/thundersoap');
    expect(endingButtons().map((b) => b.id)).toEqual(['join', 'coffee']);
    expect(coffeeLink()?.href).toBe(KOFI_URL);
    expect(coffeeLink('http://ko-fi.com/x')).toBeNull();
    expect(coffeeLink('')).toBeNull();
  });

  it('references real lines in order', () => {
    for (const s of ENDING_SEQUENCE) {
      if ('line' in s) expect(() => lineById(s.line)).not.toThrow();
    }
  });

  it('safety record line stays in voice and in budget', () => {
    expect(safetyRecordLine({ playSeconds: 3725 })).toBe(
      'Visitor #4,211. Time on site: 1h 2m. Breakers reset at no charge. Monitoring continues.',
    );
    // A miss costs nothing (D-043): the line never counts them.
    expect(safetyRecordLine({ playSeconds: 0 })).not.toMatch(/tripped|Generous|Suspicious/);
  });
});

describe('script.md stays in sync', () => {
  it('contains every line, page and plate', () => {
    for (const u of fuseUtterances) expect(script.includes(u.text), u.id).toBe(true);
    for (const p of JOURNAL) expect(script.includes(p.text), `page ${p.page}`).toBe(true);
  });
});
