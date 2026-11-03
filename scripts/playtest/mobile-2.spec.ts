import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { hallLines, machineLine } from '../../games/last-rune/content/lines';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational } from '../../games/last-rune/rules';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-2: every scene on the realistic phone viewports (browser toolbars showing, notch safe
// areas emulated), touch first, plus one contact sheet per viewport.
//   M2_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2
// Writes docs/design/screens/local/mobile-2/<tag>/<viewport>/*.png and
// docs/design/screens/local/mobile-2/<tag>-<viewport>.png (the sheet).
// M2_ONLY=iphone,se (viewport names, optional). M2_OUT=<dir> writes somewhere else.

const TAG = process.env.M2_TAG ?? 'after';
const OUT = resolve(process.env.M2_OUT ?? 'docs/design/screens/local/mobile-2');
export const PHONES = [
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;
const ONLY = process.env.M2_ONLY?.split(',');

test.setTimeout(900_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

/** The notch insets: env(safe-area-inset-*) can't be emulated, so the app's box is set the same way. */
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
  if (ONLY && !ONLY.includes(vp.name)) continue;
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`mobile-2 ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shots: string[] = [];
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        const path = join(dir, `${name}.png`);
        await page.screenshot({ path, scale: 'css' });
        shots.push(name);
      };
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
      await page.waitForTimeout(1500);
      await shot('01-title');

      const seed = (solved: string[], extra?: Record<string, unknown>) =>
        page.evaluate(
          ({ solved, extra }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.settings.captionSpeed = 'instant';
              d.progress.solved = solved;
              d.puzzles = {};
              d.journal.found = [1, 2, 3, 4];
              Object.assign(d, extra ?? {});
            });
          },
          { solved, extra },
        );
      await seed(['intake-desk', 'furnace', 'splitter-mill']);
      await page.evaluate(() => (window as G).__game.flow.continueGame());
      await page.waitForTimeout(1200);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await waitFrames(page, 4);
      await shot('02-hall');
      await page.evaluate((t) => {
        void (window as G).__game.fuse.say(t, { hold: 0 });
      }, hallLines('ambient', 1)[0]!.text); // progressed save: an ambient line, not the welcome (mobile-4-chrome)
      await page.waitForTimeout(600);
      await shot('02-hall-fuse');
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await page.evaluate(() => (window as G).__game.openSettings());
      await page.waitForTimeout(500);
      await shot('03-settings');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());
      await page.evaluate(() => (window as G).__game.codex.open());
      await page.waitForTimeout(600);
      await shot('04-codex');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());
      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await page.waitForTimeout(1500);
      await shot('05-journal');
      await page.evaluate(() => (window as G).__game.flow.closeJournal());
      await page.waitForTimeout(500);

      const all = MACHINE_IDS.filter((m) => m !== 'the-last-rune');
      const ids = [
        'intake-desk',
        'relay-tower',
        'furnace',
        'archive',
        'control-booth',
        'the-last-rune',
      ] as const;
      for (const id of ids) {
        await seed(all);
        await page.evaluate((id) => {
          const g = (window as G).__game;
          if (g.flow.state !== 'hall') g.flow.continueGame();
          g.flow.openPuzzle(id);
        }, id);
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(1500);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await waitFrames(page, 4);
        await shot(`10-${id}`);
        if (id === 'intake-desk') {
          // What a new player meets: a fresh save, nothing restored. FUSE's arrival line, the
          // arrival card and the how-to line, as they come (mobile-5-moments).
          await page.evaluate(() => (window as G).__game.flow.closePuzzle());
          await seed([]);
          await page.evaluate(() => (window as G).__game.flow.openPuzzle('intake-desk'));
          await expect(page.locator('.lr-altar')).toBeVisible();
          await page.waitForTimeout(1500);
          await shot('11-intake-desk-fuse');
        }
        if (id === 'the-last-rune') {
          await page.evaluate(
            (t) => {
              void (window as G).__game.fuse.say(t, { hold: 0 });
            },
            (machineLine(id, 'arrive') ?? machineLine('intake-desk', 'arrive'))!.text,
          );
          await page.waitForTimeout(600);
          await shot(`11-${id}-fuse`);
          await page.evaluate(() => (window as G).__game.fuse.hush());
          // Dense board (mobile-6-integrate): a gem in hand, then a tap on the board zooms in
          // (at the whole board a tap zooms; it places nothing).
          const L = await page.evaluate(() => (window as G).__altarLayout);
          const box = (await page.locator('.tc-overlay').boundingBox())!;
          const k = box.width / 1920;
          const tap = (x: number, y: number) => page.touchscreen.tap(box.x + x * k, box.y + y * k);
          await tap(L.tray[0].x, L.tray[0].y);
          await waitFrames(page, 4);
          if ((await page.locator('.lr-altar[data-zoomable]').count()) > 0) {
            const c = { x: 0, y: 0 };
            cellCenter(L, { x: Math.floor(L.cols / 2), y: Math.floor(L.rows / 2) }, c);
            await tap(c.x, c.y);
            await page.waitForTimeout(800);
          }
          await shot(`10-${id}-zoomed`);
          // A fail verdict on the dense board: put the gem back and strike as it stands.
          await tap(L.tray[0].x, L.tray[0].y);
          await waitFrames(page, 4);
          await page.locator('.lr-altar-actions .lr-gold-button').tap();
          await page.waitForTimeout(300);
          const sure = page.locator('.lr-confirm .lr-gold-button, .lr-confirm button').first();
          if (await sure.isVisible()) await sure.tap();
          await page.waitForTimeout(2500);
          await shot(`13-${id}-verdict`);
        }
        if (id === 'relay-tower') {
          const p = puzzleFor(id);
          const L =
            (await page.evaluate(() => (window as G).__altarLayout ?? null)) ?? computeLayout(p);
          const g = p.design.intended.find((q) => isRotational(q.gem))!;
          const slot = L.tray.find((t: { gem: string }) => t.gem === g.gem)!;
          const box = (await page.locator('.tc-overlay').boundingBox())!;
          const k = box.width / 1920;
          const tap = (x: number, y: number) => page.touchscreen.tap(box.x + x * k, box.y + y * k);
          await tap(slot.x, slot.y);
          await waitFrames(page, 4);
          await shot(`12-${id}-held`);
          const pt = { x: 0, y: 0 };
          cellCenter(L, g.cell, pt);
          await tap(pt.x, pt.y);
          await page.waitForTimeout(3000);
          await shot(`12-${id}-placed`);
          await page.evaluate(() => (window as G).__game.flow.closePuzzle());
          await seed(all);
          await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
          await page.waitForTimeout(800);
          await page.locator('.lr-altar-actions .lr-gold-button').tap();
          await page.waitForTimeout(300);
          const sure = page.locator('.lr-confirm .lr-gold-button, .lr-confirm button').first();
          if (await sure.isVisible()) await sure.tap();
          await page.waitForTimeout(1500);
          await shot(`13-${id}-verdict`);
        }
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await page.waitForTimeout(300);
      }

      // Fresh progress: a new piece's first appearance, as a first-time player meets it
      // (mobile-5-moments). Relay Tower right after the Intake Desk (Split and Gate, pre-set);
      // the Capacitor Bay with everything before it restored.
      const teach = [
        ['14-relay-tower-teach', 'relay-tower', ['intake-desk']],
        [
          '15-capacitor-teach',
          'capacitor-bay',
          all.filter(
            (m) => !['capacitor-bay', 'lift-shaft', 'roof-array', 'control-booth'].includes(m),
          ),
        ],
      ] as const;
      for (const [name, id, solved] of teach) {
        await seed([...solved]);
        await page.evaluate((id) => {
          const g = (window as G).__game;
          if (g.flow.state !== 'hall') g.flow.continueGame();
          g.flow.openPuzzle(id);
          g.fuse.hush();
        }, id);
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(1500);
        await shot(name);
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await page.waitForTimeout(300);
      }

      // A really solved board under the solve card: the intended gems, placed (mobile-3-board).
      await seed(['intake-desk'], {
        puzzles: { furnace: { placements: puzzleFor('furnace').design.intended, attempts: 0 } },
      });
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.flow.openPuzzle('furnace');
        g.flow.completePuzzle('furnace');
      });
      await page.waitForTimeout(4000);
      await shot('20-solve');
      await page.evaluate(() => (window as G).__game.flow.finishSolve());
      await page.waitForTimeout(500);

      await seed([...MACHINE_IDS]);
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.flow.openPuzzle('the-last-rune');
        g.flow.completePuzzle('the-last-rune');
        g.flow.finishSolve();
      });
      await page.waitForTimeout(2000);
      await shot('30-ending');
      await page
        .locator('.lr-hg')
        .waitFor({ state: 'visible', timeout: 120_000 })
        .catch(() => {});
      await page.waitForTimeout(8000);
      await shot('31-hangout');
      await page.keyboard.press('Escape');
      await page
        .locator('.lr-end-card a.lr-end-join')
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});
      await page.waitForTimeout(800);
      await shot('32-end-card');

      // Contact sheet: every shot at 1:1 CSS px, three to a row, labelled.
      const cells = shots
        .map((n) => {
          const b64 = readFileSync(join(dir, `${n}.png`)).toString('base64');
          return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}</figcaption></figure>`;
        })
        .join('');
      await page.setViewportSize({ width: vp.width * 3 + 80, height: 800 });
      await page.setContent(
        `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${vp.width}px);gap:10px 20px}figure{margin:0}img{display:block;width:${vp.width}px;height:${vp.height}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">mobile-2 ${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
      );
      await page.screenshot({ path: join(OUT, `${TAG}-${vp.name}.png`), fullPage: true });
    });
  });
}
