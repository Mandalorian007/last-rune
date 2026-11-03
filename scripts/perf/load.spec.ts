import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from '@playwright/test';
import { PREVIEW_URL } from '../../tests/e2e/ports';

// Load harness: time to the first title frame, then the audio pre-render that starts on the
// first gesture, and whether anything blocks the title or input while it runs. Production
// build (vite preview of dist/). Run from the repo root after `pnpm build`:
//   PERF_LOAD=1 pnpm exec playwright test -c scripts/perf/playwright.config.ts
// Env: PERF_CPU (CPU throttle), PERF_RUNS (default 3), PERF_OUT, PERF_LABEL.

const OUT = resolve(process.env.PERF_OUT ?? 'test-results/perf');
const LABEL = process.env.PERF_LABEL ?? 'load';
const CPU = Number(process.env.PERF_CPU ?? 1);
const RUNS = Number(process.env.PERF_RUNS ?? 3);

interface LoadWindow {
  __load: {
    longtasks: { start: number; dur: number }[];
    events: { name: string; start: number; dur: number; delay: number }[];
    frames: number[];
  };
}

interface Run {
  /** Navigation start → response end of the document (ms). */
  html: number;
  domContentLoaded: number;
  /** Adapter + device ready (`lr:gpu-ready`). */
  gpuReady: number;
  /** First rendered title frame submitted (`lr:first-frame`). */
  firstFrame: number;
  /** Long tasks (> 50 ms) before the first frame. */
  bootLongTaskMax: number;
  /** Audio pre-render, gesture → `lr:audio-ready` (ms), and per group. */
  audioMs: number;
  audioGroups: number[];
  /** During the pre-render: */
  longTasks: number;
  longTaskMax: number;
  /** Longest gap between animation frames (ms) and frames drawn. */
  frameGapMax: number;
  frames: number;
  /** Slowest input event (Event Timing duration: input → next paint) and its input delay. */
  inputMax: number;
  inputDelayMax: number;
  inputs: number;
}

test('load and audio pre-render', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  if (CPU > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  await page.addInitScript(() => {
    const w = window as unknown as LoadWindow;
    const L: LoadWindow['__load'] = { longtasks: [], events: [], frames: [] };
    w.__load = L;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) L.longtasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceEventTiming[]) {
        L.events.push({
          name: e.name,
          start: e.startTime,
          dur: e.duration,
          delay: e.processingStart - e.startTime,
        });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    const tick = (t: number) => {
      L.frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const runs: Run[] = [];
  for (let i = 0; i < RUNS; i++) {
    await page.goto(`${PREVIEW_URL}/?run=${i}`);
    await page.waitForFunction(
      () => performance.getEntriesByName('lr:first-frame').length > 0,
      null,
      {
        timeout: 60_000,
      },
    );
    const boot = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const mark = (n: string) => performance.getEntriesByName(n)[0]?.startTime ?? -1;
      const ff = mark('lr:first-frame');
      const L = (window as unknown as LoadWindow).__load;
      return {
        html: nav.responseEnd,
        domContentLoaded: nav.domContentLoadedEventEnd,
        gpuReady: mark('lr:gpu-ready'),
        firstFrame: ff,
        bootLongTaskMax: Math.max(0, ...L.longtasks.filter((t) => t.start < ff).map((t) => t.dur)),
      };
    });
    // Let the title settle, then the first gesture unlocks audio and starts the pre-render.
    await page.waitForTimeout(1000);
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.click(20, 20);
    // Keep pressing keys while it renders (menu focus moves; nothing starts).
    const pressing = (async () => {
      for (let k = 0; k < 40; k++) {
        const done = await page.evaluate(
          () => performance.getEntriesByName('lr:audio-ready').length > 0,
        );
        if (done) return;
        await page.keyboard.press(k % 2 ? 'ArrowUp' : 'ArrowDown');
        await page.waitForTimeout(120);
      }
    })();
    await page.waitForFunction(
      () => performance.getEntriesByName('lr:audio-ready').length > 0,
      null,
      {
        timeout: 120_000,
      },
    );
    await pressing;
    const audio = await page.evaluate((t0) => {
      const m = performance.getEntriesByName('lr:audio-ready')[0] as PerformanceMark;
      const t1 = m.startTime;
      const stats = m.detail as { totalMs: number; groupMs: number[] };
      const L = (window as unknown as LoadWindow).__load;
      const tasks = L.longtasks.filter((t) => t.start >= t0 && t.start <= t1);
      const fr = L.frames.filter((t) => t >= t0 && t <= t1 + 50);
      let gap = 0;
      for (let i = 1; i < fr.length; i++) gap = Math.max(gap, fr[i]! - fr[i - 1]!);
      const ev = L.events.filter(
        (e) => e.start >= t0 && e.start <= t1 && /key|pointer|click/.test(e.name),
      );
      const r = (x: number) => Math.round(x * 10) / 10;
      return {
        audioMs: r(t1 - t0),
        audioGroups: stats.groupMs.map(r),
        longTasks: tasks.length,
        longTaskMax: r(Math.max(0, ...tasks.map((t) => t.dur))),
        frameGapMax: r(gap),
        frames: fr.length,
        inputMax: r(Math.max(0, ...ev.map((e) => e.dur))),
        inputDelayMax: r(Math.max(0, ...ev.map((e) => e.delay))),
        inputs: ev.length,
      };
    }, t0);
    const r = (x: number) => Math.round(x);
    const run: Run = {
      html: r(boot.html),
      domContentLoaded: r(boot.domContentLoaded),
      gpuReady: r(boot.gpuReady),
      firstFrame: r(boot.firstFrame),
      bootLongTaskMax: r(boot.bootLongTaskMax),
      ...audio,
    };
    runs.push(run);
    console.log(`run ${i}: ${JSON.stringify(run)}`);
  }
  const file = join(OUT, `${LABEL}-cpu${CPU}.json`);
  writeFileSync(file, JSON.stringify({ label: LABEL, cpu: CPU, runs }, null, 2));
  console.log(`wrote ${file}`);
});
