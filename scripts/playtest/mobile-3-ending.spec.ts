import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-3-ending: the ending, hangout and end card, moment by moment, on the four realistic
// phone viewports plus desktop 1920×1080 and an iPad (unchanged-check), with a contact sheet each.
//   M3E_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-3-ending
// Writes docs/design/screens/local/mobile-3-ending/<tag>/<viewport>/*.png and
// docs/design/screens/local/mobile-3-ending/<tag>-<viewport>.png. M3E_ONLY=iphone,se (optional).

const TAG = process.env.M3E_TAG ?? 'after';
const OUT = resolve('docs/design/screens/local/mobile-3-ending');
const VIEWPORTS = [
  { name: 'iphone', width: 844, height: 340, inset: 47, phone: true },
  { name: 'se', width: 667, height: 320, inset: 0, phone: true },
  { name: 'promax', width: 932, height: 380, inset: 59, phone: true },
  { name: 'android', width: 915, height: 360, inset: 0, phone: true },
  { name: 'desktop', width: 1920, height: 1080, inset: 0, phone: false },
  { name: 'ipad', width: 1180, height: 820, inset: 0, phone: true },
] as const;
const ONLY = process.env.M3E_ONLY?.split(',');

test.setTimeout(600_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    document.documentElement.style.setProperty('--lr-safe-l', `${px}px`);
    document.documentElement.style.setProperty('--lr-safe-r', `${px}px`);
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

for (const vp of VIEWPORTS) {
  if (ONLY && !ONLY.includes(vp.name)) continue;
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
      deviceScaleFactor: vp.name === 'desktop' ? 1 : 2,
    });
    test(`mobile-3-ending ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shots: string[] = [];
      const shot = async (name: string) => {
        await waitFrames(page, 4);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
        shots.push(name);
      };
      const until = (sel: string, timeout = 120_000) =>
        page
          .locator(sel)
          .first()
          .waitFor({ state: 'visible', timeout })
          .catch(() => {});
      page.on('pageerror', (e) => console.log(`[${vp.name}] pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') console.log(`[${vp.name}] console: ${m.text()}`);
      });
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      if (vp.phone) {
        await page.evaluate(() =>
          document.dispatchEvent(
            new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
          ),
        );
      }
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
      // FUSE's first ending line, fully typed (Skip is up: a replay).
      await until('.tc-caption:not([hidden])', 30_000);
      await page.waitForTimeout(2500);
      await shot('30-ending-caption');
      await page.waitForTimeout(5000);
      await shot('30b-ending-caption');
      await until('.lr-hg[data-in]');
      await page.waitForTimeout(2600);
      await shot('31a-hangout-welcome');
      await until('.lr-hg-form');
      await page.waitForTimeout(400);
      await shot('31b-hangout-form');
      await page
        .locator('.lr-hg-typing b')
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => {});
      await shot('31c-hangout-typing');
      await page
        .locator('.lr-hg-log[data-ch="the-hangout"]:not([hidden])')
        .waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => {});
      await page
        .locator('.lr-hg-compose[data-typing]')
        .waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
      await shot('31d-hangout-compose');
      await until('.lr-hg-msg[data-pinned]');
      await page.waitForTimeout(1500);
      await shot('31e-hangout-pinned');
      await until('.lr-end-title[data-in]');
      await page.waitForTimeout(6000);
      await shot('32a-title-safety');
      await page.waitForTimeout(3000);
      await shot('32b-credits');
      // The end card itself (Escape skips the rest of the credits on a replay).
      await page.keyboard.press('Escape');
      await until('.lr-end-card a.lr-end-join', 30_000);
      await page.waitForTimeout(1500);
      await shot('33-end-card');

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
        `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${w}px);gap:10px 20px}figure{margin:0}img{display:block;width:${w}px;height:${hgt}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">mobile-3-ending ${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
      );
      await page.screenshot({ path: join(OUT, `${TAG}-${vp.name}.png`), fullPage: true });
    });
  });
}
