/// <reference types="@webgpu/types" />
import { expect, test } from '@playwright/test';
import { trackProblems } from './helpers';

// The ending, end to end, on the dev server (the `window.__game` handle is DEV-only).
// Seeds a save one machine short of complete, solves the Last Rune through the flow,
// and lets the whole ending play to the end card. Reduced motion and instant captions
// keep it to a couple of minutes.
const DEV_URL = 'http://127.0.0.1:5175/';

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
}

test('the ending plays to the end card; the Discord door opens only on a click', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const problems = trackProblems(page);
  const popups: string[] = [];
  const offsite: string[] = [];
  page.on('popup', (p) => popups.push(p.url()));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) {
      offsite.push(r.url());
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  const navigations: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navigations.push(f.url());
  });

  const state = await page.evaluate(async () => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    const typesUrl = '/games/last-rune/rules/types.ts';
    const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
      MACHINE_IDS: string[];
    };
    g.save.update((d) => {
      d.flags.hallIntro = true;
      d.progress.solved = MACHINE_IDS.filter((id) => id !== 'the-last-rune');
      d.stats.playSeconds = 5321;
      d.stats.breakersTripped = 7;
      d.settings.captionSpeed = 'instant';
    });
    g.flow.continueGame();
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
    return g.flow.state;
  });
  expect(state).toBe('ending');
  // First viewing: no skip.
  await expect(page.locator('.lr-end-skip')).toHaveCount(0);
  // The end card (and its links) is not there to click until the ending reaches it.
  await expect(page.locator('.lr-end-card a.lr-end-join')).toBeHidden();
  await expect(page.locator('.lr-end-back')).toBeHidden();

  // The chat mock, then the end card.
  await expect(page.locator('.lr-chat')).toBeAttached({ timeout: 120_000 });
  const join = page.locator('.lr-end-card a.lr-end-join');
  await expect(join).toBeVisible({ timeout: 180_000 });
  await expect(join).toHaveAttribute('href', /^https:\/\/discord\.gg\//);
  await expect(join).toHaveAttribute('target', '_blank');
  await expect(join).toHaveAttribute('rel', 'noopener noreferrer');
  // The tip jar URL is blank: no tip button.
  await expect(page.locator('.lr-end-card a.lr-end-tip')).toHaveCount(0);
  await expect(page.locator('.lr-end-back')).toBeVisible();

  // Nothing navigated, opened a window or phoned out on its own.
  await page.waitForTimeout(1000);
  expect(popups).toEqual([]);
  expect(navigations).toEqual([]);
  expect(offsite).toEqual([]);

  // Back to the hall.
  await page.locator('.lr-end-back').click();
  await page.waitForFunction(
    () => (window as unknown as { __game: GameHandle }).__game.flow.state === 'hall',
  );
  expect(problems).toEqual([]);
});

test('a replay of the ending can be skipped straight to the end card', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  const state = await page.evaluate(async () => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    const typesUrl = '/games/last-rune/rules/types.ts';
    const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
      MACHINE_IDS: string[];
    };
    g.save.update((d) => {
      d.flags.hallIntro = true;
      d.progress.solved = [...MACHINE_IDS];
    });
    g.flow.continueGame();
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
    return g.flow.state;
  });
  expect(state).toBe('ending');
  const skip = page.locator('.lr-end-skip');
  await expect(skip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lr-end-card a.lr-end-join')).toBeVisible({ timeout: 10_000 });
  await expect(skip).toBeHidden();
  expect(problems).toEqual([]);
});
