import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { hallLines } from '../../games/last-rune/content/lines';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-4-chrome: the hall, menus, hangout and end card on the realistic phone viewports, plus
// desktop 1920×1080 and an iPad (which must not change). Two contact sheets per viewport.
//   M4_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-4-chrome
// Writes docs/design/screens/local/mobile-4-chrome/<tag>/<viewport>/*.png and
// docs/design/screens/local/mobile-4-chrome/<tag>-<viewport>[-ending].png. M4_ONLY=iphone,se.
// M4_PART=chrome|ending runs one half. M4_OUT=<dir> writes somewhere else (mobile-5-chrome). Run desktop/iPad with --workers=1 (see mobile-3-ending).

const TAG = process.env.M4_TAG ?? 'after';
const OUT = resolve(process.env.M4_OUT ?? 'docs/design/screens/local/mobile-4-chrome');
const VIEWPORTS = [
  { name: 'iphone', width: 844, height: 340, inset: 47, phone: true },
  { name: 'se', width: 667, height: 320, inset: 0, phone: true },
  { name: 'promax', width: 932, height: 380, inset: 59, phone: true },
  { name: 'android', width: 915, height: 360, inset: 0, phone: true },
  { name: 'desktop', width: 1920, height: 1080, inset: 0, phone: false },
  { name: 'ipad', width: 1180, height: 820, inset: 0, phone: false, touch: true },
] as const;
const ONLY = process.env.M4_ONLY?.split(',');
const PART = process.env.M4_PART;

test.setTimeout(600_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function insets(page: Page, px: number, iosSafari: boolean) {
  await page.addInitScript(
    ({ px, iosSafari }) => {
      // iPhone Safari has no element Fullscreen API: emulate that on the iPhone-sized viewports.
      if (iosSafari) {
        Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      }
      if (!px) return;
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
        document.head.append(s);
      });
    },
    { px, iosSafari },
  );
}

async function sheet(
  page: Page,
  dir: string,
  shots: string[],
  vp: (typeof VIEWPORTS)[number],
  file: string,
) {
  const cells = shots
    .map((n) => {
      const b64 = readFileSync(join(dir, `${n}.png`)).toString('base64');
      return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}</figcaption></figure>`;
    })
    .join('');
  const w = vp.width > 1000 ? Math.round(vp.width / 2) : vp.width;
  const hgt = Math.round((vp.height * w) / vp.width);
  await page.setViewportSize({ width: w * 3 + 80, height: 800 });
  await page.setContent(
    `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${w}px);gap:10px 20px}figure{margin:0}img{display:block;width:${w}px;height:${hgt}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">mobile-4-chrome ${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
  );
  await page.screenshot({ path: join(OUT, file), fullPage: true });
}

for (const vp of VIEWPORTS) {
  if (ONLY && !ONLY.includes(vp.name)) continue;
  const touch = vp.phone || ('touch' in vp && vp.touch);
  const ios = vp.name === 'iphone' || vp.name === 'se' || vp.name === 'promax';
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: touch,
      hasTouch: touch,
      deviceScaleFactor: vp.name === 'desktop' ? 1 : 2,
    });

    const boot = async (page: Page) => {
      await insets(page, vp.inset, ios);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        Math.random = () => 0.42;
      });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      if (touch) {
        await page.evaluate(() =>
          document.dispatchEvent(
            new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
          ),
        );
      }
    };
    const shooter = (page: Page, dir: string, shots: string[]) => async (name: string) => {
      await waitFrames(page, 6);
      const app = await page.evaluate(() => {
        const r = document.querySelector('#app')!.getBoundingClientRect();
        return { l: r.left, r: r.right };
      });
      if (vp.inset && (app.l < vp.inset - 0.5 || app.r > vp.width - vp.inset + 0.5)) {
        throw new Error(`${vp.name}: the ${vp.inset}px notch insets did not apply`);
      }
      await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
      shots.push(name);
    };

    if (PART !== 'ending')
      test(`mobile-4-chrome ${TAG} ${vp.name} chrome`, async ({ page }) => {
        const dir = join(OUT, TAG, vp.name);
        mkdirSync(dir, { recursive: true });
        const shots: string[] = [];
        const shot = shooter(page, dir, shots);
        await boot(page);
        await page.waitForTimeout(1500);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await shot('01-title');

        // The true first entry: a new game from the title (FUSE's welcome plays by itself).
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.settings.captionSpeed = 'instant';
          });
          g.flow.newGame();
        });
        await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
        await page.waitForTimeout(2500);
        await shot('02-hall-first');
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.fuse.hush();
          g.flow.toTitle();
        });
        await page.waitForFunction(() => (window as G).__game.flow.state === 'title');

        // A save in progress: the "Next" door, and FUSE speaking (an ambient line) beside it.
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.flags.hallIntro = true;
            d.settings.captionSpeed = 'instant';
            d.progress.solved = ['intake-desk', 'furnace', 'splitter-mill'];
            d.puzzles = {};
            d.journal.found = [1, 2, 3, 4];
            d.journal.read = [1, 2, 3];
          });
          g.flow.continueGame();
        });
        await page.waitForTimeout(1200);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await shot('02-hall');
        await page.evaluate((t) => {
          void (window as G).__game.fuse.say(t, { hold: 0 });
        }, hallLines('ambient', 1)[0]!.text);
        await page.waitForTimeout(600);
        await shot('02-hall-fuse');
        await page.evaluate(() => (window as G).__game.fuse.hush());
        // mobile-5-chrome: tapping a locked door names it and says what it needs; the menu open.
        if (vp.phone) {
          const at = await page.evaluate(() => {
            const st = (window as G).__game.stack.top.state;
            const a = st.model.alcoves.find((x: G) => x.status === 'locked');
            if (!a) return null;
            const f = st.frame;
            const ov = document.querySelector('.tc-overlay')!.getBoundingClientRect();
            const k = ov.width / 1920;
            return {
              x: ov.left + (960 + (a.x - 960 - f.camX) * f.zoom) * k,
              y: ov.top + (540 + (a.y - 540 - f.camY) * f.zoom) * k,
            };
          });
          if (at) {
            await page.touchscreen.tap(at.x, at.y);
            await page.waitForTimeout(700);
            await shot('02-hall-tap-locked');
            await page.evaluate(() => (window as G).__game.fuse.hush());
          }
          await page.locator('.lr-hud-menu').click();
          await page.waitForTimeout(300);
          await shot('02-hall-menu');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
        await page.evaluate(() => (window as G).__game.openSettings());
        await page.waitForTimeout(500);
        await shot('03-settings');
        await page.evaluate(() => {
          for (const e of document.querySelectorAll('.lr-settings-cols, .lr-settings'))
            e.scrollTo(0, 99999);
        });
        await page.waitForTimeout(400);
        await shot('03-settings-end');
        await page.evaluate(() => (window as G).__game.ui.stack.clear());
        await page.evaluate(() => (window as G).__game.codex.open());
        await page.waitForTimeout(600);
        await shot('04-codex');
        const tabs = page.locator('.lr-codex-nav button');
        if (vp.phone && (await tabs.count()) > 2) {
          await tabs.nth(2).click();
          await page.waitForTimeout(300);
          await shot('04-codex-3');
        }
        await page.evaluate(() => (window as G).__game.ui.stack.clear());
        await page.evaluate(() => (window as G).__game.flow.openJournal());
        await page.waitForTimeout(1500);
        await shot('05-journal');
        await sheet(page, dir, shots, vp, `${TAG}-${vp.name}.png`);
      });

    if (PART !== 'chrome')
      test(`mobile-4-chrome ${TAG} ${vp.name} ending`, async ({ page }) => {
        const dir = join(OUT, TAG, vp.name);
        mkdirSync(dir, { recursive: true });
        const shots: string[] = [];
        const shot = shooter(page, dir, shots);
        const until = (sel: string, timeout = 120_000) =>
          page
            .locator(sel)
            .first()
            .waitFor({ state: 'visible', timeout })
            .catch(() => {});
        await boot(page);
        await page.evaluate(
          (all) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.settings.captionSpeed = 'normal';
              d.progress.solved = all;
              d.puzzles = {};
              d.stats.playSeconds = 5321;
              d.stats.breakersTripped = 7;
            });
            g.flow.continueGame();
            g.flow.openPuzzle('the-last-rune');
            g.flow.completePuzzle('the-last-rune');
            g.flow.finishSolve();
          },
          MACHINE_IDS as unknown as string[],
        );
        page.on('pageerror', (e) => console.log(`[${vp.name}] page error: ${e.message}`));
        await until('.lr-hg[data-in]');
        await page.waitForTimeout(2600);
        await shot('31a-hangout-welcome');
        await until('.lr-hg-form');
        await page.waitForTimeout(400);
        await shot('31b-hangout-intro');
        await page
          .locator('.lr-hg-typing b')
          .first()
          .waitFor({ state: 'visible', timeout: 60_000 })
          .catch(() => {});
        await shot('31c-hangout-typing');
        await until('.lr-end-title[data-in]');
        await page.keyboard.press('Escape');
        await until('.lr-end-card a.lr-end-join', 30_000);
        await page.waitForTimeout(1500);
        await shot('32-end-card');
        await sheet(page, dir, shots, vp, `${TAG}-${vp.name}-ending.png`);
      });
  });
}
