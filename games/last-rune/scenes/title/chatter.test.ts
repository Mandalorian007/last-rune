import { describe, expect, it } from 'vitest';
import { BREATH, ChatterClock, FIRST_GAP, GAP, ShuffleBag } from './chatter';

function rng(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('ShuffleBag', () => {
  it('gives every item once before any repeats, across many rounds', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const bag = new ShuffleBag(items, rng(4));
    let prev: number | undefined;
    for (let round = 0; round < 25; round++) {
      const seen = new Set<number>();
      for (let i = 0; i < items.length; i++) {
        const x = bag.next()!;
        expect(x).not.toBe(prev); // never the same line twice in a row, even across rounds
        seen.add(x);
        prev = x;
      }
      expect(seen.size).toBe(items.length);
    }
  });

  it('copes with empty and single-item pools', () => {
    expect(new ShuffleBag<number>([]).next()).toBeUndefined();
    const one = new ShuffleBag(['a']);
    expect([one.next(), one.next()]).toEqual(['a', 'a']);
  });
});

describe('ChatterClock', () => {
  const dt = 1 / 60;

  /** Seconds at which lines start, with each line taking `talk` seconds. */
  function starts(seconds: number, talk: number, paused = (_t: number) => false): number[] {
    const clock = new ChatterClock(rng(11));
    const out: number[] = [];
    let talkLeft = 0;
    for (let t = 0; t < seconds; t += dt) {
      if (talkLeft > 0) talkLeft -= dt;
      if (clock.tick(dt, { paused: paused(t), speaking: talkLeft > 0 })) {
        out.push(t);
        talkLeft = talk;
      }
    }
    return out;
  }

  it('first line after FIRST_GAP, then every GAP seconds', () => {
    const s = starts(120, 5);
    expect(s[0]!).toBeGreaterThanOrEqual(FIRST_GAP[0] - 0.05);
    expect(s[0]!).toBeLessThanOrEqual(FIRST_GAP[1] + 0.05);
    for (let i = 1; i < s.length; i++) {
      const gap = s[i]! - s[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(GAP[0] - 0.05);
      expect(gap).toBeLessThanOrEqual(GAP[1] + 0.05);
    }
    expect(s.length).toBeGreaterThanOrEqual(6);
  });

  it('never starts over a line, and leaves a breath after a long one', () => {
    const s = starts(120, 18);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]! - s[i - 1]!).toBeGreaterThanOrEqual(18 + BREATH - 0.05);
    }
  });

  it('holds while a panel is open', () => {
    const s = starts(60, 5, (t) => t < 30);
    expect(s[0]!).toBeGreaterThanOrEqual(30 + FIRST_GAP[0] - 0.05);
  });
});
