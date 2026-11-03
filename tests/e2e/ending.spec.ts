/// <reference types="@webgpu/types" />
import { expect, test } from '@playwright/test';
import { trackProblems } from './helpers';
import { DEV_URL } from './ports';

// The ending, end to end, on the dev server (the `window.__game` handle is DEV-only).
// Seeds a save one machine short of complete, solves the Last Rune through the flow,
// and lets the whole ending play to the end card. Reduced motion and instant captions
// keep it to a couple of minutes.

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

test('the ending plays to the end card; the ThunderClap Gaming link opens only on a click', async ({
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

  // Beyond the door (D-032): FUSE speaks as an ordinary caption over the light. No chat window.
  await expect(page.locator('.tc-caption-text')).toContainText(
    'Hello. This unit has arrived somewhere with a great many people in it.',
    { timeout: 120_000 },
  );
  await expect(page.locator('.lr-ending')).toBeAttached();
  await expect(page.locator('[class*="lr-chat"]')).toHaveCount(0);
  await expect(page.locator('.tc-caption-text')).toContainText('Day 1.', { timeout: 60_000 });

  // The title card says where he went; the credits name the author.
  await expect(page.locator('.lr-end-title h2')).toHaveText([
    'FUSE went to ThunderClap Gaming.',
    'He made friends. Loud ones.',
    'He still has questions about your safety record.',
  ]);
  await expect(page.locator('.lr-end-credits')).toContainText('ThunderSoap');
  await expect(page.locator('.lr-ending')).not.toContainText(/discord|chat|channel|typing/i);

  // Then the end card.
  const join = page.locator('.lr-end-card a.lr-end-join');
  await expect(join).toBeVisible({ timeout: 180_000 });
  await expect(join).toHaveText('Join ThunderClap Gaming');
  await expect(join).toHaveAttribute('href', /^https:\/\/discord\.gg\//);
  await expect(join).toHaveAttribute('target', '_blank');
  await expect(join).toHaveAttribute('rel', 'noopener noreferrer');
  // Ko-fi (D-034): a smaller link under Join, same plain-link rules.
  const coffee = page.locator('.lr-end-card a.lr-end-coffee');
  await expect(coffee).toBeVisible();
  await expect(coffee).toHaveText('Buy ThunderSoap a coffee');
  await expect(coffee).toHaveAttribute('href', 'https://ko-fi.com/thundersoap');
  await expect(coffee).toHaveAttribute('target', '_blank');
  await expect(coffee).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(coffee.locator('img, iframe, script')).toHaveCount(0);
  const [jb, cb] = [await join.boundingBox(), await coffee.boundingBox()];
  expect(cb!.y).toBeGreaterThan(jb!.y + jb!.height);
  expect(cb!.height).toBeLessThan(jb!.height);
  // Arrow keys walk the card: Back has focus, Down wraps to Join, then Ko-fi.
  await expect(page.locator('.lr-end-back')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(join).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(coffee).toBeFocused();
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
