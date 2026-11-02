import { describe, expect, it } from 'vitest';
import { FixedStepper, GameLoop } from './loop';

describe('FixedStepper', () => {
  it('runs one step per 1/60 s frame', () => {
    const s = new FixedStepper();
    let total = 0;
    for (let i = 0; i < 60; i++) total += s.advance(1 / 60);
    expect(total).toBe(60);
  });

  it('accumulates partial frames (120 Hz display)', () => {
    const s = new FixedStepper();
    let total = 0;
    for (let i = 0; i < 120; i++) total += s.advance(1 / 120);
    expect(total).toBe(60);
  });

  it('catches up on a 30 Hz display', () => {
    const s = new FixedStepper();
    expect(s.advance(1 / 30)).toBe(2);
  });

  it('clamps huge deltas', () => {
    const s = new FixedStepper({ maxFrameDt: 0.25, maxSteps: 100 });
    expect(s.advance(10)).toBe(15);
  });

  it('caps steps per frame and drops the remainder', () => {
    const s = new FixedStepper({ maxFrameDt: 1, maxSteps: 4 });
    expect(s.advance(1)).toBe(4);
    expect(s.accumulator).toBe(0);
  });

  it('reports alpha in [0,1)', () => {
    const s = new FixedStepper();
    s.advance(1.5 / 60);
    expect(s.alpha).toBeCloseTo(0.5);
  });

  it('ignores negative deltas', () => {
    const s = new FixedStepper();
    expect(s.advance(-1)).toBe(0);
  });
});

describe('GameLoop', () => {
  it('calls update at fixed rate and render once per frame', () => {
    let updates = 0;
    let renders = 0;
    const loop = new GameLoop(
      { update: () => updates++, render: () => renders++ },
      { raf: () => 0, caf: () => {}, now: () => 0 },
    );
    loop.tickOnce(1 / 30);
    loop.tickOnce(1 / 30);
    expect(updates).toBe(4);
    expect(renders).toBe(2);
    expect(loop.time.tick).toBe(4);
    expect(loop.time.simTime).toBeCloseTo(4 / 60);
  });

  it('skips update while paused but keeps rendering', () => {
    let updates = 0;
    let renders = 0;
    const loop = new GameLoop(
      { update: () => updates++, render: () => renders++ },
      { raf: () => 0, caf: () => {}, now: () => 0 },
    );
    loop.paused = true;
    loop.tickOnce(0.1);
    expect(updates).toBe(0);
    expect(renders).toBe(1);
  });

  it('drives frames from raf', () => {
    let t = 0;
    let pending: ((t: number) => void) | null = null;
    let updates = 0;
    const loop = new GameLoop(
      { update: () => updates++, render: () => {} },
      {
        now: () => t,
        raf: (cb) => {
          pending = cb;
          return 1;
        },
        caf: () => {
          pending = null;
        },
      },
    );
    loop.start();
    for (let i = 0; i < 10; i++) {
      t += 1000 / 60;
      pending!(t);
    }
    expect(updates).toBe(10);
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });
});
