import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Cell } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout, DESIGN_W } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, pressKey, waitFrames } from '../../tests/e2e/helpers';

// first-altar: the intake desk through fresh eyes. A brand-new save (nothing seeded), title →
// hall → intake desk, by mouse and by keyboard, screenshotting every beat.
//   PLAYTEST_OUT=/tmp/pt-first pnpm exec playwright test -c scripts/playtest/playwright.config.ts first-altar
// PT_VIEWPORTS=1280x720,1920x1080 (default both).

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-first-altar');
const VIEWPORTS = (process.env.PT_VIEWPORTS ?? '1280x720,1920x1080').split(',').map((v) => {
  const [width, height] = v.split('x').map(Number) as [number, number];
  return { width, height };
});
const P = puzzleFor('intake-desk');
const L = computeLayout(P);

test.setTimeout(180_000);

async function toAltar(page: Page) {
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
      'title',
    null,
    { timeout: 30_000 },
  );
  await waitFrames(page, 20);
}

/** Design-canvas point → page point (the overlay is a 16:9 box fitted to the viewport). */
async function toPage(page: Page, x: number, y: number) {
  const r = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.tc-overlay')!.getBoundingClientRect();
    return { l: el.left, t: el.top, w: el.width };
  });
  const s = r.w / DESIGN_W;
  return { x: r.l + x * s, y: r.t + y * s };
}

async function cellPoint(page: Page, c: Cell) {
  const o = { x: 0, y: 0 };
  cellCenter(L, c, o);
  return toPage(page, o.x, o.y);
}

for (const vp of VIEWPORTS) {
  for (const input of ['mouse', 'keys'] as const) {
    test(`intake-desk fresh ${input} ${vp.width}`, async ({ page }) => {
      const dir = join(OUT, `${input}-${vp.width}`);
      mkdirSync(dir, { recursive: true });
      let n = 0;
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${String(++n).padStart(2, '0')}-${name}.png`) });
      };
      await page.setViewportSize(vp);
      await toAltar(page);
      await shot('title');
      await pressKey(page, 'Enter');
      await page.waitForTimeout(2500);
      await shot('hall');
      // Walk to the intake desk.
      for (let i = 0; i < 20; i++) {
        const name = await page.evaluate(
          () => document.querySelector('.lr-nameplate span')?.textContent ?? '',
        );
        if (name === 'Intake Desk') break;
        await pressKey(page, 'ArrowRight');
      }
      await shot('hall-intake-focused');
      await pressKey(page, 'Enter');
      await expect(page.locator('.lr-altar')).toBeVisible();
      await page.waitForTimeout(800);
      await shot('altar-arrive');
      await page.waitForTimeout(4000);
      await shot('altar-5s');
      await page.waitForTimeout(6000);
      await shot('altar-11s-nudge');

      const route = P.design.intended;
      if (input === 'mouse') {
        const slot = L.tray[0]!;
        const sp = await toPage(page, slot.x, slot.y);
        await page.mouse.move(sp.x, sp.y);
        await page.waitForTimeout(400);
        await shot('hover-tray');
        await page.mouse.click(sp.x, sp.y);
        await page.waitForTimeout(300);
        const c0 = await cellPoint(page, route[0]!.cell);
        await page.mouse.move(c0.x, c0.y, { steps: 8 });
        await shot('held-over-first-socket');
        await page.mouse.click(c0.x, c0.y);
        await page.waitForTimeout(400);
        await shot('placed-1');
        for (let i = 1; i < route.length; i++) {
          // The hand is sticky after a place; take only if it emptied (the click would put it back).
          const held = await page.locator('.lr-altar-count[data-held]').count();
          if (!held) {
            await page.mouse.move(sp.x, sp.y, { steps: 4 });
            await waitFrames(page, 3);
            await page.mouse.click(sp.x, sp.y);
            await waitFrames(page, 3);
          }
          const c = await cellPoint(page, route[i]!.cell);
          await page.mouse.move(c.x, c.y, { steps: 6 });
          await waitFrames(page, 3);
          if (i === 2) await shot(`held-${i + 1}`);
          await page.mouse.click(c.x, c.y);
          await page.waitForTimeout(300);
          await shot(`placed-${i + 1}`);
        }
      } else {
        for (let i = 0; i < route.length; i++) {
          await pressKey(page, 'Digit1');
          await shot(`took-${i + 1}`);
          for (let k = 0; k < 12; k++) {
            const v = (await page.locator('.lr-altar').getAttribute('data-cursor')) ?? '';
            const [x, y] = v.split(',').map(Number);
            const t = route[i]!.cell;
            if (x === t.x && y === t.y) break;
            await pressKey(
              page,
              x! < t.x ? 'ArrowRight' : x! > t.x ? 'ArrowLeft' : y! < t.y ? 'ArrowDown' : 'ArrowUp',
            );
          }
          await pressKey(page, 'Enter');
          await page.waitForTimeout(300);
          await shot(`placed-${i + 1}`);
        }
      }
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(700);
      await shot('strike-mid');
      await page.waitForTimeout(900);
      await shot('strike-late');
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 30_000 });
      await shot('verdict');
      await page.waitForTimeout(2500);
      await shot('solve');
    });
  }
}
