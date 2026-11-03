import { describe, expect, it } from 'vitest';
import {
  arbitrate,
  HINT_RETIRE,
  hintRetired,
  introButton,
  phoneHint,
  pickHint,
  type VoiceAsk,
} from './moments';

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
      [v('hint', 'hint', 20), v('teach', 'teach', 60), v('fuse', 'fuse', 40)],
      200,
      8,
    );
    expect([...g.values()]).toEqual(['full', 'full', 'full']);
  });

  it('ranks verdict > teach > tip > hint > FUSE, whatever the input order', () => {
    const asks = [
      v('fuse', 'fuse', 50),
      v('hint', 'hint', 20),
      v('tip', 'tip', 60, 20),
      v('teach', 'teach', 70),
      v('verdict', 'verdict', 60),
    ];
    // 60 + 8 + 70 = 138; the tip shrinks to a line (138 + 8 + 20 = 166); the hint fits
    // (166 + 8 + 20 = 194); FUSE does not (194 + 8 + 50 > 200).
    const g = arbitrate(asks, 200, 8);
    expect(g.get('verdict')).toBe('full');
    expect(g.get('teach')).toBe('full');
    expect(g.get('tip')).toBe('line');
    expect(g.get('hint')).toBe('full');
    expect(g.get('fuse')).toBe('wait');
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
    // The tip (no line form) cannot fit under the teach card, but the shorter bubble can.
    const g = arbitrate(
      [v('teach', 'teach', 90), v('tip', 'tip', 120), v('fuse', 'fuse', 40)],
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
