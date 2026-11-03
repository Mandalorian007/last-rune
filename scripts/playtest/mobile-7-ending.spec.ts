import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-7-ending: the ending beat by beat on the four phones (plus the end card at 1920×1080
// and on an iPad), with a realistic play time (1h 29m, 7 breakers), and a measurements file:
// how much of the chat area each hangout beat fills, and the end card's gaps.
//   M7E_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-7-ending
// Writes docs/design/screens/local/mobile-7-ending/<tag>/<viewport>/*.png, a contact sheet
// <tag>-<viewport>.png and <tag>/<viewport>/measure.json. M7E_ONLY=iphone,se (optional).

const TAG = process.env.M7E_TAG ?? 'after';
const OUT = resolve('docs/design/screens/local/mobile-7-ending');
const VIEWPORTS = [
  { name: 'iphone', width: 844, height: 340, inset: 47, phone: true },
  { name: 'se', width: 667, height: 320, inset: 0, phone: true },
  { name: 'promax', width: 932, height: 380, inset: 59, phone: true },
  { name: 'android', width: 915, height: 360, inset: 0, phone: true },
  { name: 'desktop', width: 1920, height: 1080, inset: 0, phone: false },
  { name: 'ipad', width: 1180, height: 820, inset: 0, phone: true },
] as const;
const ONLY = process.env.M7E_ONLY?.split(',');

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

/** The open channel's log: the share of its height the conversation covers. */
const chatFill = (page: Page) =>
  page.evaluate(() => {
    const log = document.querySelector<HTMLElement>('.lr-hg-log:not([hidden])');
    if (!log) return null;
    const lr = log.getBoundingClientRect();
    const kids = [...log.children].filter(
      (e) => !(e as HTMLElement).hidden && e.getClientRects().length,
    );
    if (!kids.length) return { fill: 0 };
    const top = Math.max(lr.top, kids[0]!.getBoundingClientRect().top);
    const bot = kids.at(-1)!.getBoundingClientRect().bottom;
    return {
      fill: +((bot - top) / lr.height).toFixed(2),
      gapBelow: +(lr.bottom - bot).toFixed(1),
      gapAbove: +(top - lr.top).toFixed(1),
    };
  });

/** The end card's boxes (client px): the title band, the slip, the card and the clipboard page. */
const endBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string, pseudo?: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!pseudo) return { t: r.top, b: r.bottom, l: r.left, r: r.right };
      const cs = getComputedStyle(el, pseudo);
      const k = document.querySelector('.tc-overlay')!.getBoundingClientRect().width / 1920;
      return {
        t: r.top + parseFloat(cs.top) * k,
        b: r.bottom - parseFloat(cs.bottom) * k,
        l: r.left,
        r: r.right,
      };
    };
    return {
      vh: window.innerHeight,
      vw: window.innerWidth,
      title: box('.lr-end-title', '::before'),
      safety: box('.lr-end-safety'),
      card: box('.lr-end-card'),
      clip: box('.lr-clip-note'),
    };
  });

for (const vp of VIEWPORTS) {
  if (ONLY && !ONLY.includes(vp.name)) continue;
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
      deviceScaleFactor: vp.name === 'desktop' ? 1 : 2,
    });
    test(`mobile-7-ending ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shots: string[] = [];
      const measure: Record<string, unknown> = {};
      const shot = async (name: string) => {
        await waitFrames(page, 4);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
        shots.push(name);
      };
      const hangoutShot = async (name: string) => {
        await page.waitForTimeout(1600);
        measure[name] = await chatFill(page);
        await shot(name);
      };
      const until = (sel: string, timeout = 120_000) =>
        page
          .locator(sel)
          .first()
          .waitFor({ state: 'visible', timeout })
          .catch(() => {});
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
            d.settings.captionSpeed = 'fast';
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
      if (vp.name !== 'desktop') {
        await until('.tc-caption:not([hidden])', 30_000);
        await page.waitForTimeout(2000);
        await shot('30-ending-caption');
        await until('.lr-hg[data-in]');
        await until('.lr-hg-sys .lr-hg-react');
        await hangoutShot('31a-welcome');
        await until('.lr-hg-form');
        await hangoutShot('31b-intro-form');
        await page
          .getByText('Welcome home, FUSE')
          .waitFor({ timeout: 60_000 })
          .catch(() => {});
        await hangoutShot('31c-intro-full');
        await until('.lr-hg-log[data-ch="the-hangout"]:not([hidden])');
        await hangoutShot('31d-hangout-open');
        await page
          .getByText('we are DISCUSSING')
          .waitFor({ timeout: 60_000 })
          .catch(() => {});
        await hangoutShot('31e-hangout-full');
        await until('.lr-hg-log[data-ch="jammin-out"]:not([hidden])');
        await hangoutShot('31f-jammin');
        await until('.lr-hg-log[data-ch="gearhead"]:not([hidden])');
        await hangoutShot('31g-gearhead');
        await until('.lr-hg-msg[data-pinned]');
        await hangoutShot('31h-pinned');
        await until('.lr-end-title[data-in]');
        await page.waitForTimeout(6000);
        await shot('32a-title-safety');
      }
      await page.keyboard.press('Escape');
      await until('.lr-end-card a.lr-end-join', 30_000);
      await page.waitForTimeout(2000);
      measure.endCard = await endBoxes(page);
      await shot('33-end-card');
      writeFileSync(join(dir, 'measure.json'), JSON.stringify(measure, null, 2));

      const cells = shots
        .map((n) => {
          const b64 = readFileSync(join(dir, `${n}.png`)).toString('base64');
          return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}</figcaption></figure>`;
        })
        .join('');
      const w = Math.min(vp.width, 960);
      const hgt = Math.round((vp.height * w) / vp.width);
      await page.setViewportSize({ width: w * 3 + 80, height: 800 });
      await page.setContent(
        `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${w}px);gap:10px 20px}figure{margin:0}img{display:block;width:${w}px;height:${hgt}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">mobile-7-ending ${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
      );
      await page.screenshot({ path: join(OUT, `${TAG}-${vp.name}.png`), fullPage: true });
    });
  });
}
