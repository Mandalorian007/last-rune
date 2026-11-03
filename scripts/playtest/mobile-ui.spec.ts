import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-ui (D-039): every scene on an emulated phone (touch, DPR 3), landscape and portrait.
// Screenshots plus a DOM audit (text under 14 CSS px, tap targets under 44 CSS px, page scroll,
// elements off screen) per scene.
//   PLAYTEST_OUT=docs/design/screens/local/mobile-ui pnpm exec playwright test \
//     -c scripts/playtest/playwright.config.ts mobile-ui
// MUI_SIZES=844x390,667x375 (default: the four landscape phones and their portraits).
// MUI_ONLY=title,hall,altar (scene groups, optional).

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'docs/design/screens/local/mobile-ui');
const LANDSCAPE = ['667x375', '844x390', '932x430', '915x412'];
const SIZES = (
  process.env.MUI_SIZES ??
  [...LANDSCAPE, ...LANDSCAPE.map((s) => s.split('x').reverse().join('x'))].join(',')
)
  .split(',')
  .map((v) => {
    const [width, height] = v.split('x').map(Number) as [number, number];
    return { width, height };
  });
const ONLY = process.env.MUI_ONLY?.split(',');
const want = (g: string) => !ONLY || ONLY.includes(g);

test.setTimeout(600_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function audit(page: Page, scene: string): Promise<string[]> {
  return page.evaluate((scene) => {
    const out: string[] = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const se = document.scrollingElement!;
    if (se.scrollHeight > vh + 1 || se.scrollWidth > vw + 1)
      out.push(`page scrolls ${se.scrollWidth}x${se.scrollHeight}`);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
      return !el.closest('[hidden],[inert],[aria-hidden="true"].tc-caption-card-never');
    };
    const scaleOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
    };
    const small = new Map<string, number>();
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1,
      );
      if (!own) continue;
      const px = Number.parseFloat(getComputedStyle(el).fontSize) * scaleOf(el);
      if (px < 14) {
        const key = `${el.className || el.tagName}`.toString().slice(0, 40);
        small.set(key, Math.min(small.get(key) ?? 99, Math.round(px * 10) / 10));
      }
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2)
        out.push(`off screen: ${(el.textContent ?? '').trim().slice(0, 30)}`);
    }
    for (const [k, v] of small) out.push(`text ${v}px: ${k}`);
    for (const el of document.querySelectorAll<HTMLElement>(
      'button, a, [role=button], input, select, summary',
    )) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44)
        out.push(
          `tap ${Math.round(r.width)}x${Math.round(r.height)}: ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}`,
        );
    }
    void scene;
    return out;
  }, scene);
}

for (const vp of SIZES) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    test(`mobile scenes ${vp.width}x${vp.height}`, async ({ page }) => {
      const dir = join(OUT, `${vp.width}x${vp.height}`);
      mkdirSync(dir, { recursive: true });
      const report: Record<string, string[]> = {};
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
        report[name] = await audit(page, name);
      };
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.waitForTimeout(1500);
      if (want('title')) await shot('01-title');

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
      if (want('hall')) await shot('02-hall');
      if (want('panels')) {
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
      }
      if (want('altar')) {
        const all = MACHINE_IDS.filter((m) => m !== 'the-last-rune');
        for (const id of [
          'intake-desk',
          'relay-tower',
          'archive',
          'capacitor-bay',
          'control-booth',
          'the-last-rune',
        ]) {
          await seed(all);
          await page.evaluate((id) => {
            const g = (window as G).__game;
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
          }, id);
          await expect(page.locator('.lr-altar')).toBeVisible();
          await page.waitForTimeout(1500);
          await shot(`10-altar-${id}`);
          if (id === 'relay-tower') {
            // A failed strike: verdict + tags.
            await page.keyboard.press('KeyF');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);
            await shot(`11-altar-${id}-verdict`);
          }
          await page.evaluate(() => (window as G).__game.flow.closePuzzle());
          await page.waitForTimeout(300);
        }
      }
      if (want('solve')) {
        await seed(['intake-desk']);
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.flow.openPuzzle('furnace');
          g.flow.completePuzzle('furnace');
        });
        await page.waitForTimeout(4000);
        await shot('20-solve');
        await page.evaluate(() => (window as G).__game.flow.finishSolve());
        await page.waitForTimeout(500);
      }
      if (want('ending')) {
        await seed([...MACHINE_IDS]);
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.flow.openPuzzle('the-last-rune');
          g.flow.completePuzzle('the-last-rune');
          g.flow.finishSolve();
        });
        await page.waitForTimeout(2000);
        await shot('30-ending-start');
        const hg = page.locator('.lr-hg');
        await hg.waitFor({ state: 'visible', timeout: 120_000 }).catch(() => {});
        await page.waitForTimeout(8000);
        await shot('31-ending-hangout');
        await page.keyboard.press('Escape');
        await page
          .locator('.lr-end-card a.lr-end-join')
          .waitFor({ state: 'visible', timeout: 20_000 })
          .catch(() => {});
        await page.waitForTimeout(800);
        await shot('32-end-card');
      }
      writeFileSync(join(dir, 'audit.json'), JSON.stringify(report, null, 2));
    });
  });
}
