import { describe, expect, it } from 'vitest';
import { GraphicsController, type GraphicsTargets, TIERS } from './graphics';

function fakeTargets() {
  const t = {
    scale: 1,
    maxPixels: 0,
    post: TIERS.high.post,
    lights: 0,
    particles: 0,
    timing: -1,
    cap: null as number | null,
  };
  const targets: GraphicsTargets = {
    setResolution: (o) => {
      if (o.scale !== undefined) t.scale = o.scale;
      if (o.maxPixels !== undefined) t.maxPixels = o.maxPixels;
    },
    setPostQuality: (q) => {
      t.post = q;
    },
    setLightCap: (n) => {
      t.lights = n;
    },
    setParticleScale: (k) => {
      t.particles = k;
    },
    setTiming: (e) => {
      t.timing = e;
    },
    setFrameCap: (fps) => {
      t.cap = fps;
    },
  };
  return { t, targets };
}

/** Feed samples from a GPU whose cost at full scale is `fullMs`, 100 ms apart. */
function feed(g: GraphicsController, fullMs: number, fromMs: number, toMs: number) {
  for (let now = fromMs; now < toMs; now += 100) g.sample(fullMs * g.scale ** 2, now);
}

describe('GraphicsController', () => {
  it('applies high and low specs and turns timing on only when dynamic', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets);
    g.setPreference('high');
    expect(g.tier).toBe('high');
    expect(t).toMatchObject({ maxPixels: TIERS.high.maxPixels, lights: 16, timing: 0 });
    g.setPreference('low');
    expect(g.tier).toBe('low');
    expect(t).toMatchObject({ maxPixels: 1280 * 720, lights: TIERS.low.lights, particles: 0.5 });
    expect(t.timing).toBeGreaterThan(0);
  });

  it('caps the scene pixel budget under the tier and keeps the dynamic scale', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets);
    g.setPreference('high');
    g.capPixels(1920 * 1080);
    expect(t.maxPixels).toBe(1920 * 1080);
    g.capPixels(4000 * 3000); // above the tier: the tier wins
    expect(t.maxPixels).toBe(TIERS.high.maxPixels);
    g.capPixels(1920 * 1080);
    g.setPreference('low'); // the tier's budget is already under the cap
    expect(t.maxPixels).toBe(1280 * 720);
    g.setPreference('high'); // the cap survives a tier change
    expect(t.maxPixels).toBe(1920 * 1080);
    t.scale = 0.8;
    g.capPixels(null);
    expect(t).toMatchObject({ maxPixels: TIERS.high.maxPixels, scale: 0.8 });
  });

  it('auto stays high on a fast GPU', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets);
    feed(g, 8, 0, 30_000);
    expect(g.tier).toBe('high');
    expect(t.scale).toBe(1);
  });

  it('auto drops resolution a little on a borderline GPU but keeps high effects', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets);
    feed(g, 17, 0, 30_000);
    expect(g.tier).toBe('high');
    expect(t.scale).toBeLessThan(1);
    expect(t.scale).toBeGreaterThanOrEqual(0.6);
  });

  it('auto goes low after the probe on a slow GPU', () => {
    const { targets } = fakeTargets();
    const g = new GraphicsController(targets);
    feed(g, 60, 0, 6_000);
    expect(g.tier).toBe('low');
    expect(g.autoReason).toMatch(/probe/);
  });

  it('auto goes low when dynamic resolution saturates later on', () => {
    const { targets } = fakeTargets();
    const g = new GraphicsController(targets);
    feed(g, 10, 0, 10_000); // probe passes
    expect(g.tier).toBe('high');
    feed(g, 50, 10_000, 40_000); // a heavy scene arrives
    expect(g.tier).toBe('low');
    expect(g.autoReason).toMatch(/over budget/);
  });

  it('starts low on a fallback adapter, and an explicit high wins', () => {
    const { targets } = fakeTargets();
    const g = new GraphicsController(targets, { fallbackAdapter: true });
    expect(g.tier).toBe('low');
    g.setPreference('high');
    expect(g.tier).toBe('high');
  });

  it('ignores samples on high', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets);
    g.setPreference('high');
    feed(g, 60, 0, 30_000);
    expect(t.scale).toBe(1);
    expect(g.tier).toBe('high');
  });

  it('starts low on a handheld, and an explicit high wins', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets, { handheld: true });
    expect(g.tier).toBe('low');
    expect(g.autoReason).toBe('handheld');
    expect(t.maxPixels).toBe(TIERS.low.maxPixels);
    g.setPreference('high');
    expect(g.tier).toBe('high');
  });

  /** Samples and frames 16 ms apart: GPU cost `fullMs` at full scale, frames `intervalMs` apart. */
  function run(
    g: GraphicsController,
    fullMs: number,
    intervalMs: number,
    from: number,
    to: number,
  ) {
    for (let now = from; now < to; now += 16) {
      g.sample(fullMs * g.scale ** 2, now);
      g.frame(intervalMs, now);
    }
  }

  it('settles on a steady 30 when low is saturated and frames miss vsync', () => {
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets, { handheld: true });
    run(g, 60, 25, 0, 4000);
    expect(t.cap).toBeNull();
    run(g, 60, 25, 4000, 12_000);
    expect(g.frameCapped).toBe(true);
    expect(t.cap).toBe(30);
    // A new preference starts again at the display rate.
    g.setPreference('low');
    expect(g.frameCapped).toBe(false);
    expect(t.cap).toBeNull();
  });

  it('does not cap when frames hold 60 even if the GPU timer reads over budget', () => {
    // The queue-latency fallback timer can read high while vsync is met.
    const { t, targets } = fakeTargets();
    const g = new GraphicsController(targets, { handheld: true });
    run(g, 60, 16.7, 0, 12_000);
    expect(g.frameCapped).toBe(false);
    expect(t.cap).toBeNull();
  });

  it('does not cap on high or while dynamic resolution has headroom', () => {
    const a = fakeTargets();
    const high = new GraphicsController(a.targets);
    high.setPreference('high');
    run(high, 60, 25, 0, 12_000);
    expect(a.t.cap).toBeNull();
    const b = fakeTargets();
    const low = new GraphicsController(b.targets, { handheld: true });
    run(low, 8, 25, 0, 12_000); // slow frames for another reason (CPU): not the GPU's fault
    expect(b.t.cap).toBeNull();
  });
});
