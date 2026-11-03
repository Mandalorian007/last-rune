import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL } from '../../tests/e2e/helpers';

// finish-1 captures: a toast in the hall, then a replayed ending skipped to the end card and
// left idle until the post-credits clipboard note shows. 1920x1080 and 1280x720 at 150% text.
//   PLAYTEST_OUT=docs/design/screens/local/finish-1/after pnpm exec playwright test -c scripts/playtest/playwright.config.ts finish-1

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-finish-1');

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
    openJournal(): boolean;
  };
  ui: { toasts: { show(msg: string, opts?: { tone?: string }): unknown; clear(): void } };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void; flush(): void };
}

const RUNS = [
  { name: '1920', width: 1920, height: 1080, textScale: 100 },
  { name: '1280-text150', width: 1280, height: 720, textScale: 150 },
] as const;

async function waitState(page: Page, state: string): Promise<void> {
  await page.waitForFunction(
    (s) => (window as unknown as { __game?: GameHandle }).__game?.flow.state === s,
    state,
    { timeout: 30_000 },
  );
}

for (const run of RUNS) {
  test(`finish-1 captures ${run.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    const dir = join(OUT, run.name);
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    await page.setViewportSize({ width: run.width, height: run.height });
    await page.goto(DEV_URL);
    await waitState(page, 'title');
    await page.evaluate(async (r) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      const typesUrl = '/games/last-rune/rules/types.ts';
      const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
        MACHINE_IDS: string[];
      };
      g.save.update((d) => {
        d.flags.titleKnock = true;
        d.flags.hallIntro = true;
        d.settings.textScale = r.textScale;
        d.progress.solved = [...MACHINE_IDS];
        d.journal.found = Array.from({ length: 16 }, (_, i) => i + 1);
        d.stats.playSeconds = 5321;
        d.stats.breakersTripped = 7;
      });
      g.save.flush();
    }, run);
    await page.reload();
    await waitState(page, 'title');
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.continueGame();
    });
    await waitState(page, 'hall');
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.ui.toasts.show(
        'Your saved game couldn’t be read, so a new one begins. A backup was kept.',
        {
          tone: 'warn',
        },
      );
    });
    await page.waitForTimeout(600);
    await shot('00-hall-toast');

    // The journal's longest FUSE plate (page 4).
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.ui.toasts.clear();
      g.flow.openJournal();
    });
    await waitState(page, 'journal');
    await page.locator('.lr-j-slip[data-page="4"]').click();
    await page.waitForTimeout(1500);
    await shot('00-journal-plate');
    await page.keyboard.press('Escape');
    await waitState(page, 'hall');

    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.openPuzzle('the-last-rune');
      g.flow.completePuzzle('the-last-rune');
      g.flow.finishSolve();
    });
    await expect(page.locator('.lr-end-skip')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.lr-end-card[data-in]')).toBeAttached({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    await shot('01-end-card');
    await expect(page.locator('.lr-clip-note[data-flip]')).toBeAttached({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    await shot('02-post-credits-note');
  });
}
