import { describe, expect, it } from 'vitest';
import { CODEX } from '../../content/codex';
import { PUZZLES } from '../../content/puzzles';
import { isRotational } from '../../rules';
import { GEM_KINDS, type GemKind } from '../../rules/types';
import {
  arbitrate,
  HINT_RETIRE,
  hintRetired,
  type InfoAsk,
  introButton,
  phoneHint,
  pickHint,
  pickInfo,
  turnTeachLine,
  type VoiceAsk,
} from './moments';
import { newGems, turnTeaches } from './teach';

describe('phone how-to line', () => {
  it('teaches the tap until the player has restored a few machines', () => {
    expect(hintRetired([])).toBe(false);
    expect(hintRetired(['intake-desk', 'furnace'])).toBe(false);
    expect(HINT_RETIRE).toBe(3);
    expect(hintRetired(['intake-desk', 'furnace', 'splitter-mill'])).toBe(true);
  });

  it('says the next tap: a gem, then (holding one) a socket; nothing once retired', () => {
    expect(phoneHint(false, false)).toBe('touch');
    expect(phoneHint(false, true)).toBe('touchHeld');
    expect(phoneHint(true, false)).toBe('off');
    expect(phoneHint(true, true)).toBe('off');
  });

  it('teaches Turn the first time a turnable gem is its target (altar-truth)', () => {
    const teaches = new Set(['bend'] as const);
    expect(turnTeachLine('bend', 'hand', teaches, false)).toBe(
      '↻ Turn rotates the Bend in your hand.',
    );
    expect(turnTeachLine('bend', 'placed', teaches, false)).toBe(
      '↻ Turn rotates the Bend you just placed.',
    );
    // Once turned here, or on an altar that doesn't teach it, or nothing to turn: no line.
    expect(turnTeachLine('bend', 'hand', teaches, true)).toBeNull();
    expect(turnTeachLine('gate', 'hand', teaches, false)).toBeNull();
    expect(turnTeachLine(undefined, 'hand', teaches, false)).toBeNull();
  });

  it('every altar that first hands the player a turnable gem teaches Turn for it', () => {
    const all = Object.values(PUZZLES);
    for (const p of all)
      for (const [k, n] of Object.entries(p.tray)) {
        const g = k as GemKind;
        if ((n ?? 0) <= 0 || !isRotational(g)) continue;
        // First time in hand (nothing solved offered it): taught, and the line names it.
        const fresh = all.filter((q) => q.id !== p.id && !(q.tray[g] ?? 0));
        const teaches = turnTeaches(newGems(p, fresh));
        expect(teaches.has(g), `${p.id} ${g}`).toBe(true);
        expect(turnTeachLine(g, 'hand', teaches, false)).toContain(CODEX[g].name);
        // Already in hand before: not taught again.
        const before = all.filter((q) => q.id !== p.id && (q.tray[g] ?? 0) > 0);
        if (before.length > 0) expect(turnTeaches(newGems(p, before)).has(g)).toBe(false);
      }
  });

  it("lets other workstreams' lines stand in the slot, held gem first", () => {
    expect(pickHint({ howto: 'Tap a gem, then a socket' })).toBe('howto');
    expect(pickHint({ howto: 'x', holding: 'Holding: Bend' })).toBe('holding');
    expect(pickHint({ holding: null, howto: '' })).toBeNull();
  });
});

describe('phone arrival card', () => {
  it('pages on a tap: Next until the last page, then Got it', () => {
    expect(introButton(0, 1)).toBe('Got it');
    expect(introButton(0, 3)).toBe('Next ›');
    expect(introButton(1, 3)).toBe('Next ›');
    expect(introButton(2, 3)).toBe('Got it');
  });
});

describe('column arbiter: one owner at a time', () => {
  const v = (id: string, voice: VoiceAsk['voice'], full: number, line?: number): VoiceAsk =>
    line === undefined ? { id, voice, full } : { id, voice, full, line };

  it('gives everyone room when it fits', () => {
    const g = arbitrate(
      [v('hint', 'hint', 20), v('tip', 'tip', 60), v('fuse', 'fuse', 40)],
      200,
      8,
    );
    expect([...g.values()]).toEqual(['full', 'full', 'full']);
  });

  it('a teach card is the one panel: the how-to line and FUSE wait, room or not', () => {
    const g = arbitrate(
      [v('hint', 'hint', 20), v('teach', 'teach', 60), v('fuse', 'fuse', 40)],
      1000,
      8,
    );
    expect(g.get('teach')).toBe('full');
    expect(g.get('hint')).toBe('wait');
    expect(g.get('fuse')).toBe('wait');
  });

  it('ranks verdict > teach > tip > hint > FUSE, whatever the input order', () => {
    const asks = [
      v('fuse', 'fuse', 50),
      v('hint', 'hint', 20),
      v('tip', 'tip', 60, 20),
      v('verdict', 'verdict', 60),
    ];
    // 60 + 8 + 60 = 128; the hint fits (128 + 8 + 20 = 156); FUSE does not (156 + 8 + 50 > 200).
    const g = arbitrate(asks, 200, 8);
    expect(g.get('verdict')).toBe('full');
    expect(g.get('tip')).toBe('full');
    expect(g.get('hint')).toBe('full');
    expect(g.get('fuse')).toBe('wait');
    // With a teach card: verdict, card, then the tip shrinks to a line (138 + 8 + 20 = 166).
    const t = arbitrate([...asks, v('teach', 'teach', 70)], 200, 8);
    expect(t.get('teach')).toBe('full');
    expect(t.get('tip')).toBe('line');
  });

  it('makes a lower voice wait when even one line will not fit', () => {
    const g = arbitrate(
      [v('teach', 'teach', 90), v('tip', 'tip', 60, 20), v('fuse', 'fuse', 40)],
      100,
      8,
    );
    expect(g.get('teach')).toBe('full');
    expect(g.get('tip')).toBe('wait');
    expect(g.get('fuse')).toBe('wait');
  });

  it('a waiting voice leaves its room to the next one down', () => {
    // The tip (no line form) cannot fit under the verdict, but the shorter bubble can.
    const g = arbitrate(
      [v('verdict', 'verdict', 90), v('tip', 'tip', 120), v('fuse', 'fuse', 40)],
      140,
      8,
    );
    expect(g.get('tip')).toBe('wait');
    expect(g.get('fuse')).toBe('full');
  });

  it('the top voice owns the column even when it alone overfills it', () => {
    const g = arbitrate([v('teach', 'teach', 150), v('fuse', 'fuse', 10)], 100, 8);
    expect(g.get('teach')).toBe('full');
    expect(g.get('fuse')).toBe('wait');
  });

  it('never holds back the verdict, even alone in too small a room', () => {
    const g = arbitrate(
      [v('verdict', 'verdict', 150), v('cap', 'verdict', 30), v('fuse', 'fuse', 10)],
      100,
      8,
    );
    expect(g.get('verdict')).toBe('full');
    expect(g.get('cap')).toBe('full');
    expect(g.get('fuse')).toBe('wait');
  });

  it('keeps input order within a voice', () => {
    const g = arbitrate([v('a', 'tip', 50), v('b', 'tip', 50)], 60, 8);
    expect(g.get('a')).toBe('full');
    expect(g.get('b')).toBe('wait');
  });
});

describe('the gem card matches the gem in hand (D-040 addendum 5 blocker)', () => {
  /** The gems a card from `src` names, given the ask. */
  const named = (src: string, a: InfoAsk): GemKind[] =>
    src === 'teach'
      ? [...a.teachGems]
      : src === 'tray'
        ? [a.slot!]
        : src === 'board'
          ? [a.board!]
          : [];
  const opts = [null, ...GEM_KINDS] as const;

  it('never names another gem beside "Holding X", for every gem kind and every moment', () => {
    let checked = 0;
    for (const phone of [true, false])
      for (const held of GEM_KINDS)
        for (const teachUp of [true, false])
          for (const teach of opts)
            for (const slot of opts)
              for (const board of opts) {
                const a: InfoAsk = {
                  pin: false,
                  phone,
                  teachUp,
                  teachGems: teach ? [teach] : [],
                  held,
                  slot,
                  board,
                };
                const src = pickInfo(a);
                // A desktop's card for the placed gem under the hand (R turns it) is allowed.
                if (src === 'board' && !phone) continue;
                for (const g of named(src, a))
                  expect(g, `${JSON.stringify(a)} -> ${src}`).toBe(held);
                checked++;
              }
    expect(checked).toBeGreaterThan(1000);
  });

  it('se/16: holding Channel while the arrival card teaches Capacitor shows Channel or nothing', () => {
    const a: InfoAsk = {
      pin: false,
      phone: true,
      teachUp: true,
      teachGems: ['capacitor'],
      held: 'channel',
      slot: 'channel',
      board: null,
    };
    expect(pickInfo(a)).toBe('tray');
    expect(pickInfo({ ...a, slot: null })).toBe('none');
  });

  it('the arrival card returns once the hand is empty, and stays for its own gem', () => {
    const a: InfoAsk = {
      pin: false,
      phone: true,
      teachUp: true,
      teachGems: ['bend'],
      held: null,
      slot: null,
      board: null,
    };
    expect(pickInfo(a)).toBe('teach');
    expect(pickInfo({ ...a, held: 'bend', slot: 'bend' })).toBe('teach');
    // The gold-ring page names no gem: it is about where the held gem goes.
    expect(pickInfo({ ...a, teachGems: [], held: 'channel' })).toBe('teach');
  });

  it('a long-press pin wins: the player asked for that gem', () => {
    const a: InfoAsk = {
      pin: true,
      phone: true,
      teachUp: true,
      teachGems: ['bend'],
      held: 'channel',
      slot: null,
      board: null,
    };
    expect(pickInfo(a)).toBe('pin');
  });
});
