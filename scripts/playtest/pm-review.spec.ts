import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// PM review (temporary): every altar, half the intended gems placed, at two phone viewports.
const OUT = resolve(process.env.PMR_OUT ?? 'docs/design/screens/local/mobile-2/pm-review-altars');
const PHONES = [
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'se', width: 667, height: 320, inset: 0 },
] as const;
test.setTimeout(900_000);
// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
async function insets(page: Page, px: number) {
  if (!px) return;
  // Init scripts run before <html> exists, so apply on DOMContentLoaded (mobile-3-ending finding).
  await page.addInitScript((px) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.head.append(s);
    });
  }, px);
}
for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`pm-review ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, vp.name);
      mkdirSync(dir, { recursive: true });
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );
      await page.waitForTimeout(1000);
      const all = MACHINE_IDS.filter((m) => m !== 'the-last-rune');
      let i = 0;
      for (const id of MACHINE_IDS) {
        i++;
        const placed = puzzleFor(id).design.intended;
        const half = placed.slice(0, Math.floor(placed.length / 2));
        await page.evaluate(
          ({ all, id, half }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.settings.captionSpeed = 'instant';
              d.progress.solved = all.filter((m: string) => m !== id);
              d.puzzles = { [id]: { placements: half, attempts: 0 } };
              d.journal.found = [1, 2, 3, 4];
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
          },
          { all, id, half },
        );
        await page.waitForTimeout(600);
        await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(1500);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await waitFrames(page, 6);
        await page.screenshot({
          path: join(dir, `${String(i).padStart(2, '0')}-${id}.png`),
          scale: 'css',
        });
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await page.waitForTimeout(400);
      }
    });
  });
}
