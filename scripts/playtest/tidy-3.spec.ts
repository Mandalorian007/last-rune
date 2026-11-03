import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// tidy-3 captures:
// - FUSE's caption with and without a docked verdict on the relay (1280×720 at 100/125/150%
//   text, 1920×1080 at 100/150%);
// - Amplify's doubled diamond in the Codex and held over the altar;
// - the hall's open alcove doorway (first entry, focused, mid-game).
//   PLAYTEST_OUT=docs/design/screens/local/tidy-3/after \
//     pnpm exec playwright test -c scripts/playtest/playwright.config.ts tidy-3

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-tidy-3');

interface GameHandle {
  flow: { state: string; continueGame(): void; openPuzzle(id: string): boolean };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void };
  settings: { set(p: { textScale: number }): void };
  fuse: { hush(): void; say(line: string, opts?: { hold?: number }): Promise<void> };
}

async function boot(
  page: Page,
  vp: { width: number; height: number },
  scale: number,
  solved: string[],
  puzzles: Record<string, unknown> = {},
): Promise<void> {
  await page.setViewportSize(vp);
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, puzzles }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = solved.length > 0;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        Object.assign(d.puzzles, puzzles);
      });
      g.settings.set({ textScale: scale });
      g.flow.continueGame();
    },
    { scale, solved, puzzles },
  );
  await page.waitForTimeout(800);
}

const say = (page: Page, line: string) =>
  page.evaluate((line) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.fuse.hush();
    void g.fuse.say(line, { hold: 0 });
  }, line);

// FUSE's longest kind of card (20 words): the worst case for the caption's height.
const LONG =
  'Set a Bend facing a wall. The bolt went in and simply stopped there. Turn it toward the rest.';

const HD = { width: 1920, height: 1080 };
const SMALL = { width: 1280, height: 720 };

// The relay's Bend at (3,0) turned the wrong way: the root fizzle is on the top row, so the
// verdict docks under the board at 1280×720.
const TOP_ROW_ROOT = {
  'relay-tower': {
    attempts: 0,
    placements: [
      { gem: 'channel', cell: { x: 0, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 1, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 2, y: 1 }, rot: 0 },
      { gem: 'bend', cell: { x: 3, y: 0 }, rot: 0 },
      { gem: 'channel', cell: { x: 4, y: 0 }, rot: 0 },
      { gem: 'bend', cell: { x: 5, y: 0 }, rot: 2 },
      { gem: 'bend', cell: { x: 3, y: 2 }, rot: 0 },
      { gem: 'channel', cell: { x: 4, y: 2 }, rot: 0 },
      { gem: 'bend', cell: { x: 5, y: 2 }, rot: 3 },
    ],
  },
};

test.setTimeout(240_000);
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('caption: relay with and without a docked verdict', async ({ page }) => {
  for (const [name, vp, scale] of [
    ['1280-100', SMALL, 100],
    ['1280-125', SMALL, 125],
    ['1280-150', SMALL, 150],
    ['1920-100', HD, 100],
    ['1920-150', HD, 150],
  ] as const) {
    await boot(page, vp, scale, ['intake-desk', 'furnace', 'splitter-mill'], TOP_ROW_ROOT);
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.openPuzzle('relay-tower');
      g.fuse.hush();
    });
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.waitForTimeout(1200);
    await say(page, LONG);
    await waitFrames(page, 6);
    await page.screenshot({ path: join(OUT, `caption-${name}-plain.png`) });
    await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.fuse.hush());
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(page.locator('.lr-altar-verdict .lr-verdict-hint')).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(800);
    await say(page, LONG);
    await waitFrames(page, 6);
    await page.screenshot({ path: join(OUT, `caption-${name}-verdict.png`) });
  }
});

test('amplify: Codex portrait and the altar', async ({ page }) => {
  await boot(page, HD, 100, ['intake-desk']);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.flow.openPuzzle('furnace');
    g.fuse.hush();
  });
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'amplify-altar.png') });
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'amplify-altar-held.png') });
  await page.mouse.click(5, 5, { button: 'right' });
  await page.waitForTimeout(300);
  await page.locator('.lr-hud button', { hasText: 'Codex' }).click();
  await page.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) {
    const shot = page.locator('.lr-codex');
    if (await page.getByText('Amplify', { exact: false }).first().isVisible()) {
      await page.screenshot({ path: join(OUT, `amplify-codex-${i}.png`) });
    }
    if ((await shot.count()) === 0) break;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
  }
});

test('hall: the open doorway', async ({ page }) => {
  for (const [name, solved] of [
    ['first', []],
    ['mid', ['intake-desk', 'furnace', 'splitter-mill', 'relay-tower', 'conveyor-a']],
  ] as const) {
    await boot(page, HD, 100, [...solved]);
    await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.fuse.hush());
    await waitFrames(page, 10);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `hall-${name}.png`) });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(700);
    await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.fuse.hush());
    await page.screenshot({ path: join(OUT, `hall-${name}-focus.png`) });
  }
});
