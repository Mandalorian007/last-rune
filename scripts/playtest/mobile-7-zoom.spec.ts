import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type CDPSession, expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-7-zoom: the zoomed view keeps its context (minimap, gutter chips, edge arrows), on
// the four phones, as a first-time player sees it.
//   M7_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-7-zoom
// Writes docs/design/screens/local/mobile-7-zoom/<tag>/<viewport>/*.png (git-ignored), and
// logs the column's boxes (CSS px) for each phone.

const TAG = process.env.M7_TAG ?? 'latest';
const OUT = resolve('docs/design/screens/local/mobile-7-zoom', TAG);
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

/** The column's boxes, CSS px. */
const boxes = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    const q = (name: string, sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || el.hidden) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1) return;
      out[name] =
        `${r.left.toFixed(0)},${r.top.toFixed(0)} → ${r.right.toFixed(0)},${r.bottom.toFixed(0)}`;
    };
    q('menu', '.lr-hud-menu');
    q('title', '.lr-altar-title');
    q('holding', '.lr-altar-holding');
    q('hint', '.lr-altar-hint');
    q('tip', '.lr-altar-tip');
    q('strike', '[data-action="strike"]');
    q('zoom', '[data-action="zoom"]');
    q('minimap', '.lr-zoom-map');
    return out;
  });

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`mobile-7-zoom ${vp.name}`, async ({ page }) => {
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
      const openAltar = async (id: MachineId) => {
        await page.evaluate(
          ({ id, ids }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.progress.solved = ids.filter((m: string) => m !== id);
              d.puzzles = {};
            });
            if (g.flow.state === 'puzzle') g.flow.closePuzzle();
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
            g.fuse.hush();
          },
          { id, ids: [...MACHINE_IDS] as string[] },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(600);
        await page.evaluate(() => (window as G).__game.fuse.hush());
      };
      const layout = () =>
        page.evaluate(() => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout);
      const log: string[] = [`${vp.name} ${vp.width}×${vp.height}`];

      // Every altar's fitted pitch and whether Zoom is offered (one rule on every phone).
      for (const id of MACHINE_IDS) {
        await openAltar(id);
        const L = await layout();
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const pitch = (L.pitch * ob.width) / 1920;
        const zoom = await page.locator('[data-action="zoom"]').isVisible();
        log.push(`  ${id.padEnd(16)} fit ${pitch.toFixed(1)}px zoom ${zoom ? 'yes' : 'no'}`);
        if (id === 'capacitor-bay') await shot('00-capacitor-bay');
      }

      await openAltar('the-last-rune');
      await shot('01-whole-board');
      log.push(`  fit: ${JSON.stringify(await boxes(page))}`);

      let ob = (await page.locator('.tc-overlay').boundingBox())!;
      let k = ob.width / 1920;
      const tap = (x: number, y: number) => page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
      const L = await layout();
      const s = L.storm;
      await tap(s.x + (L.cx - s.x) * 0.35, s.y + (L.cy - s.y) * 0.35);
      await shot('02-zoomed');
      log.push(`  zoomed: ${JSON.stringify(await boxes(page))}`);

      const Z = await layout();
      const slot = Z.tray.find((t) => t.gem === 'channel') ?? Z.tray[0]!;
      await tap(slot.x, slot.y);
      await shot('03-holding');
      log.push(`  holding: ${JSON.stringify(await boxes(page))}`);
      await tap(slot.x, slot.y);

      // Pan toward the far corner: gutter chips, edge arrows, the minimap's viewport.
      const cdp = await page.context().newCDPSession(page);
      const v = Z.phone!;
      const mx = (v.padL + v.colL) / 2;
      const my = (v.visT + v.visB) / 2;
      await drag(cdp, ob.x + mx * k, ob.y + my * k, ob.x + (mx - 260) * k, ob.y + (my - 200) * k);
      await shot('04-panned');
      await drag(cdp, ob.x + mx * k, ob.y + my * k, ob.x + (mx + 600) * k, ob.y + (my + 50) * k);
      await shot('05-panned-west');

      // An edge arrow pans one step.
      const arrow = page.locator('.lr-zoom-edge:not([hidden])').first();
      if (await arrow.isVisible()) {
        await arrow.tap();
        await shot('06-arrow-step');
      }
      // The minimap: a tap jumps there.
      const map = page.locator('.lr-zoom-map');
      if (await map.isVisible()) {
        const mb = (await map.boundingBox())!;
        await page.touchscreen.tap(mb.x + mb.width * 0.85, mb.y + mb.height * 0.8);
        await shot('07-map-jump');
      }

      // Strike while zoomed: the whole board, then the verdict.
      await page.locator('[data-action="strike"]').tap();
      await waitFrames(page, 4);
      const sure = page.locator('.lr-confirm .lr-gold-button');
      if (await sure.isVisible()) await sure.tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await shot('08-verdict');

      // The Holding pill and Menu on a light board (Splitter Mill).
      await openAltar('splitter-mill');
      ob = (await page.locator('.tc-overlay').boundingBox())!;
      k = ob.width / 1920;
      const M = await layout();
      const ch = M.tray.find((t) => t.gem === 'channel') ?? M.tray[0]!;
      await tap(ch.x, ch.y);
      await shot('09-splitter-mill-held');
      log.push(`  splitter held: ${JSON.stringify(await boxes(page))}`);
      console.log(log.join('\n'));
    });
  });
}
