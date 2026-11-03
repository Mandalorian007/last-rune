/// <reference types="@webgpu/types" />
/**
 * Determinism hooks for the v1.0 baselines. Nothing here changes the game: everything is
 * applied from the test side before the page loads.
 *
 * - **Clock.** Playwright's fake clock replaces `performance.now`, `Date`, timers and
 *   `requestAnimationFrame`, so the game loop (engine/core/loop.ts) only runs when a spec calls
 *   `advance()`. Each frame is exactly 16 ms of sim time and every shader `time` uniform, caption
 *   timer and scene fade lands on the same value every run.
 * - **Randomness.** `Math.random` is a seeded PRNG (mulberry32), reset on every page load:
 *   lightning, particles, FUSE's strolls and the title chatter bag repeat exactly.
 * - **Save.** A full save envelope is written to `localStorage` before boot: graphics `high`
 *   (fixed resolution, no dynamic-resolution or auto-tier decisions taken from GPU timings),
 *   full motion, instant captions, and the progress each scene needs.
 * - **CSS.** Screenshots use `animations: 'disabled'`, which finishes finite CSS animations
 *   and transitions and stops infinite ones at their start.
 */
import type { Page } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { DEV_URL } from '../../tests/e2e/ports';
import { matchBaseline } from './compare';

// biome-ignore lint/suspicious/noExplicitAny: the DEV-only game handle
export type G = any;

/** localStorage key of the main save slot (games/last-rune/game/save.ts). */
const SAVE_KEY = 'thunderclap:last-rune:main';
/** Fixed wall clock (UTC): the start of v1.0's baseline day. */
export const CLOCK_START = Date.UTC(2026, 10, 3, 12, 0, 0);
/** One display frame of fake time, ms. */
const FRAME_MS = 16;

export interface SaveSeed {
  solved?: readonly MachineId[];
  hallIntro?: boolean;
  titleKnock?: boolean;
  journalFound?: number[];
  journalRead?: number[];
  codexSeen?: string[];
  codexMet?: string[];
  puzzles?: Record<string, { placements: unknown[]; attempts: number }>;
  playSeconds?: number;
  breakersTripped?: number;
  attempts?: number;
  startedAt?: number;
  completedAt?: number;
}

/** A full v1 save (games/last-rune/game/save.ts `SaveV1`) with the baseline settings. */
export function saveData(seed: SaveSeed = {}) {
  const started = seed.startedAt ?? (seed.solved?.length || seed.hallIntro ? CLOCK_START : 0);
  return {
    progress: { solved: [...(seed.solved ?? [])] },
    journal: { found: seed.journalFound ?? [], read: seed.journalRead ?? [] },
    codex: { seen: seed.codexSeen ?? [], met: seed.codexMet ?? [] },
    puzzles: seed.puzzles ?? {},
    settings: {
      reducedMotion: 'full',
      captionSpeed: 'instant',
      reduceFlashes: 'auto',
      graphics: 'high',
      textScale: 100,
    },
    stats: {
      playSeconds: seed.playSeconds ?? 0,
      breakersTripped: seed.breakersTripped ?? 0,
      attempts: seed.attempts ?? 0,
      startedAt: started,
      completedAt: seed.completedAt ?? 0,
    },
    flags: { titleKnock: seed.titleKnock ?? true, hallIntro: seed.hallIntro ?? false },
  };
}

/** Every machine except `skip`, in progression order. */
export function allBut(...skip: MachineId[]): MachineId[] {
  return MACHINE_IDS.filter((m) => !skip.includes(m));
}

/** The machines solved before `id` in the intended order (so `id` is open, nothing after it). */
export function solvedBefore(id: MachineId): MachineId[] {
  return MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id));
}

export function intended(id: MachineId) {
  return puzzleFor(id).design.intended.map((p) => ({
    gem: p.gem,
    cell: { x: p.cell.x, y: p.cell.y },
    rot: p.rot,
  }));
}

/**
 * Boot a fresh page on the fake clock, with a seeded PRNG and save, and run it to the title.
 * `save: null` boots with no save at all (a first-time visitor).
 */
export async function stage(page: Page, save: ReturnType<typeof saveData> | null) {
  // Installed clocks still flow with real time; paused, they move only on runFor(). Install a
  // minute early: pauseAt() can only move forward, and real time passes between the two calls.
  await page.clock.install({ time: CLOCK_START - 60_000 });
  await page.clock.pauseAt(CLOCK_START);
  await page.addInitScript(
    ({ key, env }) => {
      // mulberry32, fixed seed: every page load replays the same sequence.
      let a = 0x1d2c3b4a;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      try {
        localStorage.clear();
        if (env) localStorage.setItem(key, env);
      } catch {
        // Storage blocked: the game falls back to memory; the shot will show it.
      }
    },
    {
      key: SAVE_KEY,
      env: save ? JSON.stringify({ v: 1, t: CLOCK_START, d: save }) : null,
    },
  );
  await page.goto(DEV_URL);
  await until(page, () => (window as G).__game?.flow.state === 'title', 60_000);
  // A few frames so the first render is on screen and pipelines have compiled.
  await advance(page, 200);
}

/** Run the game for `ms` of fake time, a frame at a time, letting real GPU work settle. */
export async function advance(page: Page, ms: number) {
  // Chunks keep the GPU queue short (each chunk awaits a real round trip to the page).
  const CHUNK = FRAME_MS * 8;
  for (let t = 0; t < ms; t += CHUNK) await page.clock.runFor(Math.min(CHUNK, ms - t));
}

/**
 * Advance fake time until `fn` is true in the page. Boot and pipeline compiles are real async
 * work, so each step also yields real time.
 */
export async function until<A>(
  page: Page,
  fn: (arg: A) => unknown,
  maxFakeMs = 30_000,
  arg?: A,
): Promise<number> {
  let spent = 0;
  while (spent <= maxFakeMs) {
    if (await page.evaluate(fn as (a: unknown) => unknown, arg as unknown)) return spent;
    await page.clock.runFor(FRAME_MS * 4);
    spent += FRAME_MS * 4;
    // Real time for promises that are not on the fake clock (GPU, fetch, module loads).
    await page.waitForTimeout(5);
  }
  throw new Error(`baseline: condition not met after ${maxFakeMs} ms of game time: ${fn}`);
}

/** Run something against the game handle in the page. */
export function game<R, A = undefined>(page: Page, fn: (g: G, arg: A) => R, arg?: A) {
  return page.evaluate(
    ({ src, arg }) => {
      // biome-ignore lint/security/noGlobalEval: rebuilds the arrow passed from the spec
      const f = eval(src) as (g: unknown, a: unknown) => unknown;
      return f((window as unknown as { __game: unknown }).__game, arg);
    },
    { src: fn.toString(), arg },
  ) as Promise<Awaited<R>>;
}

/** Press a key and let the game read it (input is polled per fixed tick). */
export async function key(page: Page, k: string) {
  await page.keyboard.down(k);
  await advance(page, FRAME_MS * 3);
  await page.keyboard.up(k);
  await advance(page, FRAME_MS * 3);
}

/** The snapshot: a settled frame, then the compare (or a write, under BASELINE_UPDATE). */
export async function shot(page: Page, name: string) {
  await advance(page, FRAME_MS * 4);
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  await matchBaseline(png, name);
}
