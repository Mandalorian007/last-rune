import { describe, expect, it } from 'vitest';
import { FuseStroll, type StrollSpot } from './fuse-stroll';

const A = { x: 1, y: 1 };
const B = { x: 2, y: 2 };
const SPOTS: StrollSpot[] = [
  { x: 700, looks: [A, null] },
  { x: 450, looks: [B] },
  { x: 300, looks: [A, B, null] },
];

/** Seeded LCG so runs are repeatable. */
function rng(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Steps the planner with a fake rig that arrives `walkTime` seconds after each new target. */
function run(stroll: FuseStroll, seconds: number, input: { hold?: boolean; still?: boolean }) {
  const xs = new Set<number>([stroll.x]);
  let x = stroll.x;
  let arriveIn = 0;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    if (stroll.x !== x && arriveIn <= 0) arriveIn = 3;
    if (arriveIn > 0) {
      arriveIn -= dt;
      if (arriveIn <= 0) x = stroll.x;
    }
    stroll.update(dt, { ...input, rolling: x !== stroll.x });
    xs.add(stroll.x);
  }
  return xs;
}

describe('FuseStroll', () => {
  it('starts at the start spot, standing', () => {
    const s = new FuseStroll(SPOTS, { start: 0, random: rng() });
    expect(s.x).toBe(700);
    expect(s.isWalking).toBe(false);
    expect(s.look).toBe(A);
  });

  it('strolls between spots now and then, never faster than the dwell allows', () => {
    const s = new FuseStroll(SPOTS, { random: rng(7), dwell: [7, 13] });
    let walks = 0;
    let was = s.isWalking;
    let x = s.x;
    for (let t = 0; t < 120; t += 1 / 60) {
      s.update(1 / 60, { rolling: s.isWalking && t % 3 < 2.9 });
      if (s.isWalking && !was) walks++;
      if (s.isWalking) expect(s.x).not.toBe(x);
      was = s.isWalking;
      if (!s.isWalking) x = s.x;
    }
    // 120 s with 7–13 s dwells (plus the walk itself): a handful of walks, not a frenzy.
    expect(walks).toBeGreaterThanOrEqual(5);
    expect(walks).toBeLessThanOrEqual(17);
  });

  it('visits more than one spot over a minute, and only listed spots', () => {
    const xs = run(new FuseStroll(SPOTS, { random: rng(3) }), 60, {});
    expect(xs.size).toBeGreaterThan(1);
    for (const x of xs) expect(SPOTS.map((p) => p.x)).toContain(x);
  });

  it('never walks under reduced motion, but still glances', () => {
    const s = new FuseStroll(SPOTS, { random: rng(5), start: 2 });
    const looks = new Set<unknown>();
    for (let t = 0; t < 90; t += 1 / 60) {
      s.update(1 / 60, { still: true, rolling: false });
      looks.add(s.look);
      expect(s.isWalking).toBe(false);
      expect(s.x).toBe(300);
    }
    expect(looks.size).toBeGreaterThan(1);
  });

  it('holds still while told to (he is talking)', () => {
    const xs = run(new FuseStroll(SPOTS, { random: rng(9) }), 60, { hold: true });
    expect([...xs]).toEqual([700]);
  });

  it('finishes a walk before standing again', () => {
    const s = new FuseStroll(SPOTS, { random: rng(2), dwell: [1, 1] });
    let t = 0;
    for (; t < 2 && !s.isWalking; t += 0.05) s.update(0.05, { rolling: false });
    expect(s.isWalking).toBe(true);
    expect(t).toBeGreaterThanOrEqual(0.95);
    s.update(0.05, { rolling: true });
    expect(s.isWalking).toBe(true);
    s.update(0.05, { rolling: false });
    expect(s.isWalking).toBe(false);
  });
});
