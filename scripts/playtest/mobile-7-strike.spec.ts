import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-7-strike: Strike, the reach lamps, the two-strike verdict, the red mark and the solve
// card on the four phones.
//   M7_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-7-strike
// Writes docs/design/screens/local/mobile-7-strike/<tag>/<phone>/*.png.

const TAG = process.env.M7_TAG ?? 'after';
const OUT = resolve(process.env.M7_OUT ?? 'docs/design/screens/local/mobile-7-strike');
const PHONES = [
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;
const ROW = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

test.setTimeout(600_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.head.append(s);
    });
  }, px);
}

async function open(page: Page, id: MachineId, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.lr-altar-tip .lr-info-next');
    if (!(await next.isVisible())) break;
    await next.tap();
    await waitFrames(page, 4);
  }
  await page.evaluate(() => (window as G).__game.fuse.hush());
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`mobile-7-strike ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${name}.png`) });
      };
      await insets(page, vp.inset);
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );

      // Lamps: half a route (dark), the first try (one lit), solved (all lit, Strike glows).
      await open(page, 'capacitor-bay', ROW.slice(0, 3));
      await shot('01-bay-lamps-off');
      await open(page, 'capacitor-bay', ROW);
      await shot('02-bay-lamps-one');
      await open(page, 'capacitor-bay', puzzleFor('capacitor-bay').design.intended);
      await shot('03-bay-lamps-all-ready');

      // Two strikes: mid-run, then the verdict.
      await open(page, 'capacitor-bay', ROW);
      await page.locator('[data-action="strike"]').tap();
      await page.waitForTimeout(900);
      await shot('04-bay-mid-strike');
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(600);
      await shot('05-bay-verdict');

      // The Last Rune opened as is: an under / dead verdict on a big board.
      await open(page, 'the-last-rune', []);
      await shot('06-last-rune-lamps');
      await page.locator('[data-action="strike"]').tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(600);
      await shot('07-last-rune-verdict');

      // An empty socket and the red mark.
      await open(page, 'relay-tower', []);
      await page.locator('[data-action="strike"]').tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      await shot('08-relay-empty-socket');

      // The solve card on three altars, FUSE talking.
      for (const id of ['furnace', 'capacitor-bay', 'the-last-rune'] as MachineId[]) {
        await page.evaluate(
          ({ id, placements, solved }) => {
            const g = (window as G).__game;
            if (g.flow.state === 'puzzle') g.flow.closePuzzle();
            g.save.update((d: G) => {
              d.progress.solved = solved;
              d.puzzles = { [id]: { attempts: 0, placements } };
            });
            g.flow.openPuzzle(id);
            g.flow.completePuzzle(id);
          },
          {
            id,
            placements: puzzleFor(id).design.intended,
            solved: MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id)),
          },
        );
        await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 15_000 });
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.fuse.hush();
          void g.fuse.say('Stack two and the second one just feels important.', { hold: 0 });
        });
        await page.waitForTimeout(800);
        await shot(`09-solve-${id}`);
        await page.locator('.lr-solve-continue').tap();
        await waitFrames(page, 10);
      }
    });
  });
}
