import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL } from '../../tests/e2e/helpers';

// Ending captures (ending-3, D-038): the ThunderClap Gaming hangout beyond the door. The full
// scene, a sidebar close-up and the reaction burst, at each step FUSE takes, then the flood
// and the end card. Three runs: 1920x1080; 1280x720 at 150% text; 1920x1080 reduced motion.
//   PLAYTEST_OUT=docs/design/screens/local/ending-3 pnpm exec playwright test -c scripts/playtest/playwright.config.ts ending-3

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-ending-3');

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
  { name: '1920', width: 1920, height: 1080, textScale: 100, motion: 'no-preference' },
  { name: '1280-text150', width: 1280, height: 720, textScale: 150, motion: 'no-preference' },
  { name: '1920-reduced-motion', width: 1920, height: 1080, textScale: 100, motion: 'reduce' },
] as const;

async function onTitle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
}

for (const run of RUNS) {
  test(`hangout captures ${run.name}`, async ({ page }) => {
    test.setTimeout(360_000);
    const dir = join(OUT, run.name);
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    const side = page.locator('.lr-hg-side');
    const sideShot = (name: string) => side.screenshot({ path: join(dir, `${name}.png`) });
    await page.emulateMedia({ reducedMotion: run.motion });
    await page.setViewportSize({ width: run.width, height: run.height });
    await page.goto(DEV_URL);
    await onTitle(page);
    await page.evaluate((r) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.titleKnock = true;
        d.settings.textScale = r.textScale;
      });
      g.save.flush();
    }, run);
    await page.reload();
    await onTitle(page);
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
    const t0 = Date.now();
    const hg = page.locator('.lr-hg');
    await expect(hg).toBeVisible({ timeout: 180_000 });
    const opened = Date.now();
    await page.waitForTimeout(1600);
    await shot('01-open-welcome');
    await expect(hg.locator('.lr-hg-sys .lr-hg-react')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(1300);
    await shot('02-join-reacts');
    await sideShot('02-sidebar-unread');
    // FUSE typing his introduction.
    await expect(hg.locator('.lr-hg-compose[data-typing]')).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(900);
    await shot('03-fuse-typing');
    await expect(hg.locator('.lr-hg-form')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(400);
    await shot('04-intro-form');
    await expect(hg.locator('.lr-hg-msg[data-who="thundersoap"]:not([data-old])')).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(1200);
    await shot('05-intro-welcome-home');
    await expect(page.locator('.lr-hg-ch[data-ch="the-hangout"][data-on]')).toBeAttached({
      timeout: 20_000,
    });
    await expect(
      hg.locator('.lr-hg-log[data-ch="the-hangout"] .lr-hg-msg[data-who="fuse"]'),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(2600);
    await shot('06-hangout-arguing');
    await expect(page.locator('.lr-hg-ch[data-ch="jammin-out"][data-on]')).toBeAttached({
      timeout: 20_000,
    });
    await page.waitForTimeout(1800);
    await shot('07-jammin-out');
    await expect(page.locator('.lr-hg-ch[data-ch="gearhead"][data-on]')).toBeAttached({
      timeout: 20_000,
    });
    await page.waitForTimeout(2400);
    await shot('08-gearhead');
    await sideShot('08-sidebar-gearhead');
    await expect(page.locator('.lr-hg-ch[data-ch="watch-me-grow"][data-on]')).toBeAttached({
      timeout: 20_000,
    });
    await expect(
      hg.locator('.lr-hg-log[data-ch="watch-me-grow"] .lr-hg-msg[data-who="fuse"]'),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(900);
    await shot('09-day1-burst');
    await expect(hg.locator('.lr-hg-msg[data-pinned]')).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot('10-day1-pinned');
    await sideShot('10-sidebar-final');
    await hg.locator('.lr-hg-msg[data-pinned]').screenshot({ path: join(dir, '10-reactions.png') });
    await expect(hg).toHaveAttribute('data-out', '', { timeout: 30_000 });
    const closed = Date.now();
    await page.waitForTimeout(700);
    await shot('11-folding-away');
    await expect(page.locator('.lr-end-card[data-in]')).toBeAttached({ timeout: 180_000 });
    await page.waitForTimeout(1500);
    await shot('12-end-card');
    console.log(
      `[${run.name}] solve→hangout ${((opened - t0) / 1000).toFixed(1)}s, hangout ${((closed - opened) / 1000).toFixed(1)}s, solve→end card ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  });
}
