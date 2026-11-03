import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type CDPSession, expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-6-zoom: the zoomed view on the four phones, as a first-time player sees it.
//   pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-6-zoom
// Writes docs/design/screens/local/mobile-6-zoom/<viewport>/*.png (git-ignored).

const OUT = resolve('docs/design/screens/local/mobile-6-zoom');
// As mobile-2 (importing its spec would run it too).
const PHONES = [
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

test.setTimeout(300_000);

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

async function drag(cdp: CDPSession, x0: number, y0: number, x1: number, y1: number) {
  const pt = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`mobile-6-zoom ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, vp.name);
      mkdirSync(dir, { recursive: true });
      const shot = async (name: string) => {
        await waitFrames(page, 8);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
      };
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() => {
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        );
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.progress.solved = [];
          d.puzzles = {};
        });
        g.flow.continueGame();
      });
      await page.waitForTimeout(800);
      await page.evaluate(
        (ids) => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.progress.solved = ids.filter((m) => m !== 'the-last-rune');
            d.puzzles = {};
          });
          g.flow.openPuzzle('the-last-rune');
          g.fuse.hush();
        },
        [...MACHINE_IDS] as string[],
      );
      await expect(page.locator('.lr-altar')).toBeVisible();
      await page.waitForTimeout(800);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await shot('01-whole-board');

      const ob = (await page.locator('.tc-overlay').boundingBox())!;
      const k = ob.width / 1920;
      const tap = (x: number, y: number) => page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
      const layout = () =>
        page.evaluate(() => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout);
      const L = await layout();
      // Tap near the storm: the view zooms in there.
      const s = L.storm;
      await tap(s.x + (L.cx - s.x) * 0.35, s.y + (L.cy - s.y) * 0.35);
      await shot('02-zoomed');

      // A gem from the tray, held over the zoomed board.
      const Z = await layout();
      const slot = Z.tray.find((t) => t.gem === 'bend') ?? Z.tray[0]!;
      await tap(slot.x, slot.y);
      await shot('03-holding');
      // Set down on a socket in view.
      const v = Z.phone!;
      const free = await page.evaluate(
        ({ v }) => {
          const S = (window as G).__altarLayout;
          const view = (window as G).__altarView;
          for (let y = 0; y < S.rows; y++)
            for (let x = 0; x < S.cols; x++) {
              const cx = S.left + S.margin + S.pitch * (x + 0.5);
              const cy = S.top + S.margin + S.pitch * (y + 0.5);
              if (cx < v.padL + S.pitch || cx > v.colL - S.pitch) continue;
              if (cy < v.visT + S.pitch || cy > v.visB - S.pitch) continue;
              if (view.gemAt({ x, y })) continue;
              return { x: cx, y: cy };
            }
          return null;
        },
        { v },
      );
      if (free) {
        await tap(free.x, free.y);
        await shot('04-placed');
      }

      // Pan toward the far corner: edge cues and pinned Needs cards.
      const cdp = await page.context().newCDPSession(page);
      const mx = (v.padL + v.colL) / 2;
      const my = (v.visT + v.visB) / 2;
      await drag(cdp, ob.x + mx * k, ob.y + my * k, ob.x + (mx - 260) * k, ob.y + (my - 200) * k);
      await shot('05-panned');

      // Strike while zoomed: it goes back to the whole board, then strikes.
      await page.locator('[data-action="strike"]').tap();
      await waitFrames(page, 4);
      const sure = page.locator('.lr-confirm .lr-gold-button');
      if (await sure.isVisible()) await sure.tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await shot('06-strike-at-fit');
    });
  });
}
