import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { hallLines } from '../../games/last-rune/content/lines';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-3-chrome: the title, hall and menus on the realistic phone viewports (as mobile-2.spec)
// plus desktop 1920×1080 and two iPads, which must not change. One contact sheet per viewport.
//   M3_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-3-chrome
// Writes docs/design/screens/local/mobile-3-chrome/<tag>/<viewport>/*.png and
// docs/design/screens/local/mobile-3-chrome/<tag>-<viewport>.png. M3_ONLY=iphone,desktop.

const TAG = process.env.M3_TAG ?? 'after';
const OUT = resolve('docs/design/screens/local/mobile-3-chrome');
const VIEWPORTS = [
  { name: 'iphone', width: 844, height: 340, inset: 47, phone: true },
  { name: 'se', width: 667, height: 320, inset: 0, phone: true },
  { name: 'promax', width: 932, height: 380, inset: 59, phone: true },
  { name: 'android', width: 915, height: 360, inset: 0, phone: true },
  { name: 'desktop', width: 1920, height: 1080, inset: 0, phone: false },
  { name: 'ipad', width: 1180, height: 820, inset: 0, phone: false, touch: true },
  { name: 'ipad-mini', width: 1024, height: 768, inset: 0, phone: false, touch: true },
] as const;
const ONLY = process.env.M3_ONLY?.split(',');

test.setTimeout(300_000);

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
  const touch = vp.phone || ('touch' in vp && vp.touch);
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: touch,
      hasTouch: touch,
      deviceScaleFactor: vp.name === 'desktop' ? 1 : 2,
    });
    test(`mobile-3-chrome ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shots: string[] = [];
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
        shots.push(name);
      };
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        // The same FUSE title line every run (chatter is shuffled), so before/after compare.
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
      await page.waitForTimeout(1500);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await waitFrames(page, 4);
      await shot('01-title');
      await page.evaluate(() => {
        void (window as G).__game.fuse.say(
          "Oh. Someone's at the door. Nobody's at the door. Nobody is ever at the door.",
          { hold: 0 },
        );
      });
      await page.waitForTimeout(600);
      await shot('01-title-fuse');

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
      await waitFrames(page, 4);
      await shot('02-hall');
      await page.evaluate((t) => {
        void (window as G).__game.fuse.say(t, { hold: 0 });
      }, hallLines('first-entry', 1)[0]!.text);
      await page.waitForTimeout(600);
      await shot('02-hall-fuse');
      await page.evaluate(() => (window as G).__game.fuse.hush());
      if (vp.phone) {
        await page.locator('.lr-hud-menu').tap();
        await page.waitForTimeout(300);
        await shot('02-hall-menu');
        await page.locator('.lr-hud-menu').tap();
      }
      await page.evaluate(() => (window as G).__game.openSettings());
      await page.waitForTimeout(500);
      await shot('03-settings');
      await page.evaluate(() => {
        const b = document.querySelector('.lr-settings-body, .lr-settings');
        const scroller = [b, ...(b ? b.querySelectorAll('*') : [])].find(
          (e) =>
            e && e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible',
        );
        scroller?.scrollTo(0, 99999);
        const panel = document.querySelector('.tc-panel');
        panel?.scrollTo?.(0, 99999);
      });
      await page.waitForTimeout(200);
      await shot('03-settings-end');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());
      await page.evaluate(() => (window as G).__game.codex.open());
      await page.waitForTimeout(600);
      await shot('04-codex');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());
      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await page.waitForTimeout(1500);
      await shot('05-journal');

      const cells = shots
        .map((n) => {
          const b64 = readFileSync(join(dir, `${n}.png`)).toString('base64');
          return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}</figcaption></figure>`;
        })
        .join('');
      const cw = vp.phone ? vp.width : Math.round(vp.width / 2);
      const ch = vp.phone ? vp.height : Math.round(vp.height / 2);
      await page.setViewportSize({ width: cw * 3 + 80, height: 800 });
      await page.setContent(
        `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${cw}px);gap:10px 20px}figure{margin:0}img{display:block;width:${cw}px;height:${ch}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">mobile-3-chrome ${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
      );
      await page.screenshot({ path: join(OUT, `${TAG}-${vp.name}.png`), fullPage: true });
    });
  });
}
