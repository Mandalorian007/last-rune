/**
 * Phone screenshots for D-027 reviews (ws/port-altar): every altar on every phone row as a
 * first-time player sees it, plus the empty hand (altars open holding the first gem on touch), the hall, settings and the title upright. Off
 * unless SHOTS=<dir name> is set; images go to docs/design/screens/local/<dir>/ (git-ignored).
 *
 *   SHOTS=port-altar pnpm exec playwright test tests/e2e/shots.spec.ts
 *   SHOTS=port-altar SHOTS_ONLY=se,furnace ...   (a subset: phone names and machine ids)
 */
import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from './helpers';

const DIR = process.env.SHOTS ?? '';
const ONLY = (process.env.SHOTS_ONLY ?? '').split(',').filter(Boolean);
const want = (k: string) => ONLY.length === 0 || ONLY.includes(k);

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.skip(!DIR, 'SHOTS=<dir> to take screenshots');
test.setTimeout(600_000);

const out = (name: string) => `docs/design/screens/local/${DIR}/${name}.png`;

async function boot(page: Page, inset: number) {
  if (inset) {
    await page.addInitScript((px) => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.addEventListener('DOMContentLoaded', () => document.head.append(s));
    }, inset);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
}

async function touchMode(page: Page) {
  await page.evaluate(() =>
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    ),
  );
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`altars ${vp.name}`, async ({ page }) => {
      test.skip(!want(vp.name), 'not in SHOTS_ONLY');
      await boot(page, vp.inset);
      await touchMode(page);
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          // Mid-game, with an unread journal page (the ☰ badge shows).
          d.progress.solved = ['intake-desk', 'furnace', 'splitter-mill'];
          d.journal.found = [1, 2, 3, 4];
          d.journal.read = [1, 2, 3];
        });
        g.flow.continueGame();
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await page.waitForTimeout(300);
      await page.screenshot({ path: out(`${vp.name}-hall`) });
      for (const id of MACHINE_IDS) {
        if (ONLY.some((o) => MACHINE_IDS.includes(o as never)) && !want(id)) continue;
        await page.evaluate(
          ({ id, ids }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.progress.solved = ids.filter((m) => m !== id);
              d.puzzles = {};
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
          },
          { id, ids: [...MACHINE_IDS] as string[] },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(900);
        await page.screenshot({ path: out(`${vp.name}-${id}`) });
        await page.evaluate(() => (window as G).__game.fuse.hush());
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
        const k = ob.width / 1920;
        const s0 = L.tray[0];
        if (s0) {
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
          await waitFrames(page, 10);
          await page.screenshot({ path: out(`${vp.name}-${id}-empty-hand`) });
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
        }
      }
    });
  });
}

test.describe('upright', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  test('title, settings, altar upright', async ({ page }) => {
    test.skip(!want('portrait'), 'not in SHOTS_ONLY');
    await boot(page, 0);
    await touchMode(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: out('portrait-title') });
    await page.evaluate(() => (window as G).__game.openSettings());
    await page.waitForTimeout(500);
    await page.screenshot({ path: out('portrait-settings') });
    await page.evaluate(() => {
      const g = (window as G).__game;
      g.ui.stack.clear();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
      });
      g.flow.continueGame();
      g.flow.openPuzzle('furnace');
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: out('portrait-furnace') });
  });
});
