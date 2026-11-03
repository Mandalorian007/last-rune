/// <reference types="@webgpu/types" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// Frame-time harness: title, hall (start, end), the Last Rune's strike, the ending (door, flood).
// Run from the repo root (see scripts/perf/README.md):
//   PERF_LABEL=before PERF_DPR=2 pnpm exec playwright test -c scripts/perf/playwright.config.ts
// Env:
//   PERF_DPR=1|2          device pixel ratio (viewport is 1920x1080 CSS px; PERF_W/PERF_H)
//   PERF_MOBILE=1         landscape phone emulation (852x393 at DPR 3, touch; see the config)
//   PERF_CPU=4            Chromium CPU throttle rate
//   PERF_TIER=auto|high|low   graphics setting seeded into the save (ignored by old builds)
//   PERF_BREAKDOWN=1      also time each scene with fog / rays / bloom off and at half res
//   PERF_SHOTS=dir        save a screenshot per scene
//   PERF_OUT=dir          where the JSON lands (default test-results/perf)

const OUT = resolve(process.env.PERF_OUT ?? 'test-results/perf');
const LABEL = process.env.PERF_LABEL ?? 'run';
const MOBILE = !!process.env.PERF_MOBILE;
const DPR = Number(process.env.PERF_DPR ?? (MOBILE ? 3 : 1));
const CPU = Number(process.env.PERF_CPU ?? 1);
const TIER = process.env.PERF_TIER ?? '';
const BREAKDOWN = !!process.env.PERF_BREAKDOWN;
const SHOTS = process.env.PERF_SHOTS ? resolve(process.env.PERF_SHOTS) : null;
const WINDOW_MS = Number(process.env.PERF_MS ?? 3000);
/** Timestamp-query sampling while measuring: every Nth frame (0 = leave the game's setting). */
const TS_EVERY = Number(process.env.PERF_TS_EVERY ?? 4);
/** A/B in one build: switch off the perf-low savings (flood pixel cap, scene-res composite). */
const BASELINE = !!process.env.PERF_BASELINE;

interface Stats {
  frames: number;
  /** Frame interval (rAF), what the player sees. */
  frame: { avg: number; p50: number; p95: number; max: number };
  /** GPU work per frame: submit → onSubmittedWorkDone (vsync on, so the queue is idle). */
  gpu: { avg: number; p50: number; p95: number; max: number };
  /**
   * GPU work per frame from timestamp queries (first pass → last pass), when the device has
   * `timestamp-query`. Unlike `gpu` it excludes queueing, so it stays honest when the GPU is
   * saturated. Samples about every other frame.
   */
  gpuTs?: { avg: number; p50: number; p95: number; max: number };
  /** Mean GPU ms per pass label (timestamp queries only). */
  passes?: Record<string, number>;
  /** CPU: beginFrame → endFrame returns (scene record + encode + submit). */
  cpu: { avg: number; p50: number; p95: number; max: number };
}

interface SceneResult {
  scene: string;
  base: Stats;
  draws: number;
  instances: number;
  canvas: string;
  scene_px: string;
  tier: string;
  breakdown?: Record<string, Stats>;
}

// biome-ignore lint/suspicious/noExplicitAny: page-side handle
type G = any;

async function boot(page: Page, seed: string) {
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(
    ({ seed, tier, solved, intended }) => {
      const g = (window as unknown as { __game: G }).__game;
      g.save.update((d: G) => {
        d.settings.captionSpeed = 'instant';
        d.settings.reducedMotion = 'full';
        if (tier) d.settings.graphics = tier;
        if (seed !== 'fresh') {
          d.flags.hallIntro = true;
          d.flags.titleKnock = true;
          d.progress.solved = solved;
          d.puzzles['the-last-rune'] = { placements: intended, attempts: 0 };
        }
      });
      g.settings.refresh?.();
    },
    {
      seed,
      tier: TIER,
      solved: MACHINE_IDS.filter((id) => id !== 'the-last-rune'),
      intended: puzzleFor('the-last-rune').design.intended,
    },
  );
}

function summarise(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const r = (x: number) => Math.round(x * 100) / 100;
  if (!s.length) return { avg: 0, p50: 0, p95: 0, max: 0 };
  return {
    avg: r(s.reduce((a, b) => a + b, 0) / s.length),
    p50: r(s[Math.floor(s.length * 0.5)]!),
    p95: r(s[Math.floor(s.length * 0.95)]!),
    max: r(s[s.length - 1]!),
  };
}

/**
 * Frame intervals plus per-frame GPU and CPU time over `ms`. Wraps the renderer's
 * beginFrame/endFrame in the page, so it works on any build with the DEV handle.
 */
async function measure(page: Page, ms = WINDOW_MS): Promise<Stats> {
  const raw = await page.evaluate(
    async ({ ms, tsEvery }) => {
      const w = window as unknown as {
        __game: G;
        __perf?: {
          on: boolean;
          gpu: number[];
          cpu: number[];
          ts: number[];
          passes: Record<string, number[]>;
        };
      };
      const r = w.__game.renderer;
      if (!w.__perf) {
        const perf = {
          on: false,
          gpu: [] as number[],
          cpu: [] as number[],
          ts: [] as number[],
          passes: {} as Record<string, number[]>,
        };
        w.__perf = perf;
        // Timestamp queries (newer builds): every resolved frame, total and per pass.
        if (r.gpuTimer) {
          r.gpuTimer.onResult((res: { totalMs: number; passes: Record<string, number> }) => {
            if (!perf.on || !(res.totalMs > 0)) return;
            perf.ts.push(res.totalMs);
            for (const [k, v] of Object.entries(res.passes)) {
              const list = perf.passes[k] ?? [];
              list.push(v);
              perf.passes[k] = list;
            }
          });
        }
        const begin = r.beginFrame.bind(r);
        const end = r.endFrame.bind(r);
        let t0 = 0;
        r.beginFrame = (t: number, dt: number) => {
          t0 = performance.now();
          return begin(t, dt);
        };
        r.endFrame = () => {
          end();
          const t1 = performance.now();
          if (!perf.on) return;
          perf.cpu.push(t1 - t0);
          r.device.queue.onSubmittedWorkDone().then(() => perf.gpu.push(performance.now() - t1));
        };
      }
      const perf = w.__perf;
      perf.gpu.length = 0;
      perf.cpu.length = 0;
      perf.ts.length = 0;
      perf.passes = {};
      const every = r.timingEvery;
      if (r.gpuTimer && tsEvery > 0) r.timingEvery = tsEvery;
      perf.on = true;
      const ts: number[] = [];
      await new Promise<void>((done) => {
        const t0 = performance.now();
        const loop = (t: number) => {
          ts.push(t);
          if (t - t0 < ms) requestAnimationFrame(loop);
          else done();
        };
        requestAnimationFrame(loop);
      });
      await r.device.queue.onSubmittedWorkDone();
      await new Promise((done) => setTimeout(done, 50));
      perf.on = false;
      r.timingEvery = every;
      const passes: Record<string, number> = {};
      for (const [k, v] of Object.entries(perf.passes)) {
        passes[k] = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
      }
      return {
        frame: ts.slice(1).map((t, i) => t - ts[i]!),
        gpu: perf.gpu.slice(),
        cpu: perf.cpu.slice(),
        ts: perf.ts.slice(),
        passes,
      };
    },
    { ms, tsEvery: TS_EVERY },
  );
  const out: Stats = {
    frames: raw.frame.length,
    frame: summarise(raw.frame),
    gpu: summarise(raw.gpu),
    cpu: summarise(raw.cpu),
  };
  if (raw.ts.length) {
    out.gpuTs = summarise(raw.ts);
    const r = (x: number) => Math.round(x * 100) / 100;
    out.passes = Object.fromEntries(Object.entries(raw.passes).map(([k, v]) => [k, r(v)]));
  }
  return out;
}

function fmt(s: Stats): string {
  const f = (x: number) => x.toFixed(2).padStart(6);
  const ts = s.gpuTs ? ` | ts p50 ${f(s.gpuTs.p50)} p95 ${f(s.gpuTs.p95)}` : '';
  const passes = s.passes
    ? ` [${Object.entries(s.passes)
        .map(([k, v]) => `${k} ${v.toFixed(2)}`)
        .join(', ')}]`
    : '';
  return `frame p50 ${f(s.frame.p50)} p95 ${f(s.frame.p95)} | gpu p50 ${f(s.gpu.p50)} p95 ${f(s.gpu.p95)}${ts} | cpu p50 ${f(s.cpu.p50)} p95 ${f(s.cpu.p95)}${passes}`;
}

async function info(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    const r = g.renderer;
    const c = g.surface.canvas as HTMLCanvasElement;
    return {
      draws: r.stats.drawCalls + r.stats.drawables,
      instances: r.stats.instances,
      canvas: `${c.width}x${c.height}`,
      scene_px: `${r.width}x${r.height}`,
      tier: g.graphics
        ? `${g.graphics.preference}->${g.graphics.tier}@${Number(g.graphics.scale).toFixed(2)}${
            g.graphics.maxPixels ? ` budget ${(g.graphics.maxPixels / 1e6).toFixed(2)}MP` : ''
          }`
        : 'n/a',
    };
  });
}

/** Time the scene with one cost removed at a time (post settings restored after each). */
async function breakdown(page: Page, measureMs: number): Promise<Record<string, Stats>> {
  const out: Record<string, Stats> = {};
  const variants: [string, string][] = [
    ['no-fog', 'p.settings.fog.enabled = false'],
    ['no-rays', 'p.settings.godRays.enabled = false'],
    ['no-bloom', 'p.settings.bloom.enabled = false; p.settings.godRays.bloomSource = 0'],
    [
      'no-post',
      'p.settings.fog.enabled = false; p.settings.godRays.enabled = false; p.settings.bloom.enabled = false; p.settings.godRays.bloomSource = 0',
    ],
  ];
  for (const [name, code] of variants) {
    await page.evaluate((code) => {
      const g = (window as unknown as { __game: G; __saved?: string }).__game;
      (window as unknown as { __saved: string }).__saved = JSON.stringify(g.post.settings);
      new Function('p', code)(g.post);
    }, code);
    await waitFrames(page, 10);
    out[name] = await measure(page, measureMs);
    await page.evaluate(() => {
      const w = window as unknown as { __game: G; __saved: string };
      const saved = JSON.parse(w.__saved);
      for (const k of Object.keys(saved)) Object.assign(w.__game.post.settings[k], saved[k]);
    });
  }
  // Fill rate: scene targets at half size (the composite still writes the full canvas).
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    const c = g.surface.canvas as HTMLCanvasElement;
    if (g.renderer.setResolution) g.renderer.setResolution({ scale: 0.5 });
    else g.renderer.resize(c.width / 2, c.height / 2);
  });
  await waitFrames(page, 10);
  out['half-res'] = await measure(page, measureMs);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    const c = g.surface.canvas as HTMLCanvasElement;
    if (g.renderer.setResolution) g.renderer.setResolution({ scale: 1 });
    else g.renderer.resize(c.width, c.height);
  });
  await waitFrames(page, 10);
  return out;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

/**
 * Fast-forward the ending's script to `phase`, then `extra` more steps (1/30 s each). Returns
 * the phase it ends in (the flood's 120 steps land in the credits, still over full gold).
 * (A plain loop: `waitForFunction` treats an async predicate's promise as truthy.)
 */
async function stepEnding(page: Page, phase: string, extra: number): Promise<string> {
  const ok = await page.evaluate(
    async ({ phase, extra }) => {
      const g = (window as unknown as { __game: G }).__game;
      const step = async (i: number) => {
        g.fuse.hush?.();
        g.stack.top.update(1 / 30);
        // Let the director's awaits run; yield to the page now and then.
        if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
        else await Promise.resolve();
      };
      let i = 0;
      for (; i < 20_000 && g.stack.top.phase !== phase; i++) await step(i);
      for (let k = 0; k < extra; k++) await step(i + k);
      return g.stack.top.phase as string;
    },
    { phase, extra },
  );
  return ok;
}

async function record(page: Page, scene: string, results: SceneResult[], settleFrames = 60) {
  await waitFrames(page, settleFrames);
  const base = await measure(page);
  const i = await info(page);
  await shot(page, scene);
  const res: SceneResult = { scene, base, ...i };
  if (BREAKDOWN) res.breakdown = await breakdown(page, Math.min(WINDOW_MS, 2000));
  results.push(res);
  console.log(
    `${scene.padEnd(13)} ${fmt(base)} | draws ${i.draws} canvas ${i.canvas} scene ${i.scene_px} tier ${i.tier}`,
  );
  if (res.breakdown) {
    for (const [k, v] of Object.entries(res.breakdown)) {
      console.log(`  ${k.padEnd(11)} ${fmt(v)}`);
    }
  }
}

test('frame times per scene', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  if (CPU > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  const results: SceneResult[] = [];
  if (BASELINE) {
    await page.addInitScript(() => {
      const t = setInterval(() => {
        const g = (window as unknown as { __game?: G }).__game;
        if (!g?.graphics || !g.post) return;
        clearInterval(t);
        g.graphics.capPixels = () => {};
        const setQuality = g.post.setQuality.bind(g.post);
        g.post.setQuality = (q: object) => setQuality({ ...q, compositeAtScene: false });
        g.post.setQuality({});
      }, 0);
    });
  }

  // Title.
  await boot(page, 'fresh');
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
  );
  await record(page, 'title', results, 120);

  // Hall, first visit.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    g.save.update((d: G) => {
      d.flags.hallIntro = true;
    });
    g.flow.continueGame();
  });
  await expect(page.locator('.lr-hud')).toBeVisible();
  await record(page, 'hall-start', results, 120);

  // Hall, every machine but the last restored.
  await boot(page, 'end');
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
  );
  await page.evaluate(() => (window as unknown as { __game: G }).__game.flow.continueGame());
  await expect(page.locator('.lr-hud')).toBeVisible();
  await record(page, 'hall-end', results, 120);

  // The Last Rune: altar open with the intended solution, then the strike.
  await page.evaluate(() =>
    (window as unknown as { __game: G }).__game.flow.openPuzzle('the-last-rune'),
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await record(page, 'altar', results, 90);
  await page.keyboard.press('KeyF', { delay: 50 });
  await waitFrames(page, 20);
  {
    const base = await measure(page, 2500);
    const i = await info(page);
    await shot(page, 'altar-strike');
    results.push({ scene: 'strike', base, ...i });
    console.log(`strike        ${fmt(base)} | draws ${i.draws}`);
  }

  // The ending: fast-forward the script to the gold flood.
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
  );
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    g.flow.continueGame();
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
  });
  await page.waitForFunction(
    () => (window as unknown as { __game: G }).__game.flow.state === 'ending',
  );
  // The door opening in the storm, then the gold flood (the costliest view in the game).
  await stepEnding(page, 'door', 60);
  await record(page, 'ending-door', results, 30);
  await stepEnding(page, 'flood', 120);
  await record(page, 'ending-flood', results, 30);

  const file = join(
    OUT,
    `${LABEL}${MOBILE ? '-mobile' : ''}-dpr${DPR}-cpu${CPU}${TIER ? `-${TIER}` : ''}.json`,
  );
  writeFileSync(
    file,
    JSON.stringify(
      { label: LABEL, mobile: MOBILE, dpr: DPR, cpu: CPU, tier: TIER, results },
      null,
      2,
    ),
  );
  console.log(`wrote ${file}`);
});
