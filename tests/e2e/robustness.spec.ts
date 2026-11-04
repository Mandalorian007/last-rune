/// <reference types="@webgpu/types" />
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational, type Placement } from '../../games/last-rune/rules';
import { GEM_KINDS } from '../../games/last-rune/rules/types';
import { cursorKeys } from './altar-keys';
import {
  PREVIEW_URL,
  pressKey,
  readSave,
  SAVE_KEY,
  trackProblems,
  waitForBoot,
  waitFrames,
} from './helpers';

// bug-bash: the production build under the things players do to a browser game. Resize and
// devicePixelRatio changes mid-scene, a hidden tab, a lost GPU device, a corrupt or old save,
// key spam on Strike and Back, and a reload in the middle of a strike. Each test fails on any
// console error or page error. PLAYTEST_OUT=/dir also writes a screenshot per beat.

const OUT = process.env.PLAYTEST_OUT ? resolve(process.env.PLAYTEST_OUT) : null;

async function snap(page: Page, name: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await waitFrames(page, 4);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

async function toTitle(page: Page) {
  await page.goto(PREVIEW_URL);
  await waitForBoot(page);
  await page.locator('#app canvas').first().waitFor();
  await expect(page.locator('.lr-title-menu').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
}

/** Title → hall → the first altar (intake-desk is the only open door on a new game). */
async function toFirstAltar(page: Page) {
  await toTitle(page);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await pressKey(page, 'ArrowRight');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function cursor(page: Page) {
  const v = await page.locator('.lr-altar').getAttribute('data-cursor');
  const [x, y] = (v ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Key in intake-desk's intended solution. */
async function buildIntake(page: Page) {
  const p = puzzleFor('intake-desk');
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const placed: Placement[] = [];
  for (const g of p.design.intended) {
    await pressKey(page, `Digit${tray.indexOf(g.gem) + 1}`);
    for (const k of cursorKeys(p, placed, await cursor(page), g.cell)) await pressKey(page, k);
    if (isRotational(g.gem)) await pressKey(page, 'KeyR', g.rot);
    await pressKey(page, 'Enter');
    placed.push({ gem: g.gem, cell: g.cell, rot: g.rot });
  }
  await expect
    .poll(async () => (await readSave(page))?.puzzles['intake-desk']?.placements.length)
    .toBe(p.design.intended.length);
}

// Resize/DPR mid-scene, the hidden-tab pause and GPU device loss are the engine's now: its
// e2e harness (packages/engine/e2e/surface.spec.ts, lifecycle.spec.ts) proves them on every
// matrix row. Play time not counting while hidden is a game/flow unit test.

// One shape is enough here: the game's notice and fresh start. The engine save tests recover
// all five (not JSON, no envelope, wrong shape, future version, empty string; D-041).
const BAD_SAVES: [string, string][] = [['not JSON', '{oops']];

for (const [what, raw] of BAD_SAVES) {
  test(`a corrupt save (${what}) boots to the title and says so`, async ({ page }) => {
    await page.addInitScript(
      ({ key, raw }) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, raw);
          sessionStorage.setItem('seeded', '1');
        }
      },
      { key: SAVE_KEY, raw },
    );
    const problems = trackProblems(page);
    await toTitle(page);
    await snap(page, `corrupt-${what.replace(/\s+/g, '-')}`);
    // The player is told, not left wondering where the progress went.
    await expect(page.locator('.tc-toast')).toContainText(/couldn.t be read/);
    // And the game plays on a fresh save.
    await pressKey(page, 'Enter');
    await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    expect((await readSave(page))?.progress.solved ?? []).toEqual([]);
    expect(problems.filter((p) => !p.includes('[save]'))).toEqual([]);
  });
}

test('an old save without the newer optional fields loads intact', async ({ page }) => {
  // A version-1 save from before codex.met, textScale, graphics and reduceFlashes existed.
  const old = {
    v: 1,
    t: 1,
    d: {
      progress: { solved: ['intake-desk'] },
      journal: { found: [1], read: [] },
      codex: { seen: [] },
      puzzles: {},
      settings: { reducedMotion: 'system', captionSpeed: 'normal' },
      stats: { playSeconds: 30, breakersTripped: 0, attempts: 1, startedAt: 1, completedAt: 0 },
      flags: { titleKnock: true, hallIntro: true },
    },
  };
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem('seeded', '1');
      }
    },
    { key: SAVE_KEY, raw: JSON.stringify(old) },
  );
  const problems = trackProblems(page);
  await toTitle(page);
  await expect(page.locator('.tc-toast')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
  expect((await readSave(page))?.progress.solved).toEqual(['intake-desk']);
  expect(problems).toEqual([]);
});

test('spamming Strike, Back and Enter never stacks scenes or panels', async ({ page }) => {
  const problems = trackProblems(page);
  await toFirstAltar(page);
  await buildIntake(page);
  // Strike spam: one strike, one attempt.
  for (let i = 0; i < 12; i++) await page.keyboard.press('KeyF');
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  expect((await readSave(page))?.puzzles['intake-desk']?.attempts).toBe(1);
  // Enter and Esc spam on the solve card land in the hall once.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('.lr-solve')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('.lr-hud')).toBeVisible();
  // Settings toggle spam: at most one panel, and Esc spam closes it.
  for (let i = 0; i < 9; i++) await page.keyboard.press('KeyO');
  await page.waitForTimeout(300);
  expect(await page.locator('.lr-settings').count()).toBeLessThanOrEqual(1);
  // Esc in the hall opens Settings as the pause menu, so Esc toggles. Spam it (never more
  // than one panel), then settle: one deliberate Esc at a time must close whatever is open.
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Escape');
    expect(await page.locator('.tc-panel').count()).toBeLessThanOrEqual(1);
  }
  await page.waitForTimeout(400);
  for (let i = 0; i < 3 && (await page.locator('.tc-panel').count()) > 0; i++) {
    await pressKey(page, 'Escape');
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.tc-panel')).toHaveCount(0);
  // Into the altar and Back spam: one trip out, still in the hall, and the hall takes keys.
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 10; i++) await page.keyboard.press('Escape');
  await expect(page.locator('.lr-altar')).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(500);
  await expect(page.locator('.lr-hud')).toBeVisible();
  // Leftover presses may have opened the pause menu in the hall: never more than one.
  expect(await page.locator('.tc-panel').count()).toBeLessThanOrEqual(1);
  if ((await page.locator('.tc-panel').count()) === 1) await pressKey(page, 'Escape');
  await expect(page.locator('.tc-panel')).toHaveCount(0);
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  await snap(page, 'spam-end');
  expect(problems).toEqual([]);
});

test('a reload in the middle of a strike keeps the placements and the game goes on', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await toFirstAltar(page);
  await buildIntake(page);
  await pressKey(page, 'KeyF');
  await page.waitForTimeout(300);
  await page.reload();
  await waitForBoot(page);
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);
  // Either the strike finished before the reload (solved) or the gems wait on the altar.
  const save = await readSave(page);
  const solved = save?.progress.solved.includes('intake-desk');
  if (!solved) {
    expect(save?.puzzles['intake-desk']?.placements.length).toBe(
      puzzleFor('intake-desk').design.intended.length,
    );
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Enter');
    await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await pressKey(page, 'KeyF');
    await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  }
  await snap(page, 'reload-mid-strike');
  expect(problems).toEqual([]);
});

// ── Gamepad only ─────────────────────────────────────────────────────────────

/** A standard-mapping pad the test drives (navigator.getGamepads is stubbed). */
async function stubPad(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      id: 'test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
}

/** Press and release a pad button across a few frames. */
async function pad(page: Page, button: number) {
  const set = (on: boolean) =>
    page.evaluate(
      ([b, v]) => {
        const p = (window as unknown as { __pad: { buttons: unknown[] } }).__pad;
        p.buttons[b as number] = { pressed: v, touched: v, value: v ? 1 : 0 };
      },
      [button, on] as const,
    );
  await set(true);
  await waitFrames(page, 4);
  await set(false);
  await waitFrames(page, 4);
}

const PAD = { A: 0, B: 1, Y: 3, START: 9, DOWN: 13, RIGHT: 15 } as const;

test('a gamepad alone gets from the title through Settings, the Codex and an altar', async ({
  page,
}) => {
  await stubPad(page);
  const problems = trackProblems(page);
  await toTitle(page);
  // A on Play.
  await pad(page, PAD.A);
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  // Start opens Settings; the d-pad moves focus inside it; B closes it.
  await pad(page, PAD.START);
  await expect(page.locator('.lr-settings')).toBeVisible();
  const focused = () => page.evaluate(() => document.activeElement?.outerHTML ?? '');
  const before = await focused();
  await pad(page, PAD.DOWN);
  expect(await focused()).not.toBe(before);
  await pad(page, PAD.B);
  await expect(page.locator('.lr-settings')).toHaveCount(0);
  // Y opens the Codex; B closes it.
  await pad(page, PAD.Y);
  await expect(page.locator('.lr-codex')).toBeVisible();
  await pad(page, PAD.B);
  await expect(page.locator('.lr-codex')).toHaveCount(0);
  // D-pad to the first door, A opens the altar, B goes back to the hall.
  await pad(page, PAD.RIGHT);
  await pad(page, PAD.A);
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await snap(page, 'pad-altar');
  await pad(page, PAD.B);
  await expect(page.locator('.lr-altar')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('.lr-hud')).toBeVisible();
  expect(problems).toEqual([]);
});
