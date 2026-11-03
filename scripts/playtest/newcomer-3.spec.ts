import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL } from '../../tests/e2e/helpers';

// newcomer-3 captures: the intake door hovered in the hall, the first altar (tray chips, the
// lit-ring line), the furnace's Amplify glyph and its Codex page, and the relay verdict with the
// root red mark on the top row at 1280×720 and 150% text.
//   PLAYTEST_OUT=docs/design/screens/local/newcomer-3/after \
//     pnpm exec playwright test -c scripts/playtest/playwright.config.ts newcomer-3

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-newcomer-3');

interface GameHandle {
  flow: { state: string; continueGame(): void; openPuzzle(id: string): boolean };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void };
  settings: { set(p: { textScale: number }): void };
  fuse: { hush(): void };
}

async function boot(
  page: Page,
  vp: { width: number; height: number },
  scale: number,
  solved: string[],
  puzzles: Record<string, unknown> = {},
  hallIntro = true,
): Promise<void> {
  await page.setViewportSize(vp);
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, puzzles, hallIntro }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = hallIntro;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        Object.assign(d.puzzles, puzzles);
      });
      g.settings.set({ textScale: scale });
      g.flow.continueGame();
    },
    { scale, solved, puzzles, hallIntro },
  );
  await page.waitForTimeout(800);
}

async function open(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.flow.openPuzzle(id);
    g.fuse.hush();
  }, id);
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(1200);
}

const HD = { width: 1920, height: 1080 };
const SMALL = { width: 1280, height: 720 };

test.setTimeout(180_000);

test('hall: the intake door hovered', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await boot(page, HD, 100, []);
  await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.fuse.hush());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, 'hall-intake-hover.png') });
});

test('intake desk: first view (tray chips, lit-ring line)', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  for (const [name, vp, scale] of [
    ['intake-1920', HD, 100],
    ['intake-1280-150', SMALL, 150],
  ] as const) {
    await boot(page, vp, scale, []);
    await open(page, 'intake-desk');
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    const tray = page.locator('.lr-altar-tray');
    if (await tray.count()) await tray.first().screenshot({ path: join(OUT, `${name}-tray.png`) });
  }
});

test('furnace: Amplify glyph on the board and in the Codex', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await boot(page, HD, 100, ['intake-desk']);
  await open(page, 'furnace');
  await page.screenshot({ path: join(OUT, 'furnace-1920.png') });
  // Hold an Amplify over a socket to see the glyph large.
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'furnace-amplify-held.png') });
  await page.mouse.click(5, 5, { button: 'right' });
  await page.waitForTimeout(300);
  await page.locator('.lr-hud button', { hasText: 'Codex' }).click();
  await page.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) {
    await page.screenshot({ path: join(OUT, `codex-${i}.png`) });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
  }
});

// The relay's Bend at (3,0) turned the wrong way: the root fizzle is on the top row.
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

test('relay: verdict with the root red mark on the top row', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  for (const [name, vp, scale] of [
    ['relay-top-root-1280-150', SMALL, 150],
    ['relay-top-root-1280-100', SMALL, 100],
    ['relay-top-root-1920-150', HD, 150],
  ] as const) {
    await boot(page, vp, scale, ['intake-desk', 'furnace', 'splitter-mill'], TOP_ROW_ROOT);
    await open(page, 'relay-tower');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(page.locator('.lr-altar-verdict .lr-verdict-hint')).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
  }
});
