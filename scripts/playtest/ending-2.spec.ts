import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { beatLine } from '../../games/last-rune/content/lines';
import { DEV_URL } from '../../tests/e2e/helpers';

// Ending captures (ending-2, D-032/D-034): the title with its Ko-fi link, then the ending from
// the door through the white, the gold with FUSE's captions, the title card, the credits and
// the end card. Three runs: 1920x1080; 1280x720 at 150% text; 1920x1080 with Reduce flashes.
//   PLAYTEST_OUT=/tmp/pt-ending pnpm exec playwright test -c scripts/playtest/playwright.config.ts ending-2

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-ending-2');

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void; flush(): void };
}

const RUNS = [
  { name: '1920', width: 1920, height: 1080, textScale: 100, reduceFlashes: 'auto' },
  { name: '1280-text150', width: 1280, height: 720, textScale: 150, reduceFlashes: 'auto' },
  { name: '1920-reduce-flashes', width: 1920, height: 1080, textScale: 100, reduceFlashes: 'on' },
] as const;

const DOOR_LIST = beatLine('door-list').text;
const DOOR_KEY = beatLine('door-key').text;

async function onTitle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
}

for (const run of RUNS) {
  test(`ending captures ${run.name}`, async ({ page }) => {
    test.setTimeout(360_000);
    const dir = join(OUT, run.name);
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    await page.setViewportSize({ width: run.width, height: run.height });
    await page.goto(DEV_URL);
    await onTitle(page);
    await page.evaluate((r) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.titleKnock = true;
        d.settings.textScale = r.textScale;
        d.settings.reduceFlashes = r.reduceFlashes;
      });
      g.save.flush();
    }, run);
    await page.reload();
    await onTitle(page);
    await page.waitForTimeout(2500);
    await shot('00-title');

    await page.evaluate(async () => {
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
      });
      g.flow.continueGame();
      g.flow.openPuzzle('the-last-rune');
      g.flow.completePuzzle('the-last-rune');
      g.flow.finishSolve();
    });

    const caption = page.locator('.tc-caption-text');
    await expect(caption).toContainText(DOOR_LIST, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await shot('01-door');
    await expect(caption).toContainText(DOOR_KEY, { timeout: 60_000 });
    // Through the door: a short time-lapse of the white until FUSE speaks from the light.
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1500);
      if (((await caption.textContent()) ?? '').includes('Hello.')) break;
      await shot(`02-white-${String(i).padStart(2, '0')}`);
    }
    await expect(caption).toContainText('Hello.', { timeout: 60_000 });
    await page.waitForTimeout(3500);
    await shot('03-gold-hello');
    await expect(caption).toContainText('arguing about a game', { timeout: 30_000 });
    await page.waitForTimeout(2500);
    await shot('04-gold-arguing');
    await expect(caption).toContainText('Day 1.', { timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot('05-gold-day-1');
    await expect(page.locator('.lr-end-title[data-in]')).toBeAttached({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    await shot('06-title-card');
    await expect(page.locator('.lr-end-credits div[data-in]').first()).toBeAttached({
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    await shot('07-credits');
    await page.waitForTimeout(3500);
    await shot('08-credits-2');
    await expect(page.locator('.lr-end-card[data-in]')).toBeAttached({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    await shot('09-end-card');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await shot('10-end-card-coffee-focus');
  });
}
