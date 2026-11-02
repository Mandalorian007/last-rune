import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Placement } from '../../games/last-rune/rules';
import type { Cell, MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// split-rotate (D-031): every altar with a Split as a newcomer meets it, by mouse. Arrival; a
// fixed Split hovered and R pressed over it; a tray Split in hand over its socket (the rest of
// the intended route already set), turned once per R; set down at its intended turn; the whole
// route; the strike.
//   PLAYTEST_OUT=/tmp/pt-split pnpm exec playwright test -c scripts/playtest/playwright.config.ts split-rotate
// PT_ONLY=splitter-mill,press-unit-4 (optional). PT_VIEWS=1920 (optional; default 1920,1280).

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-split-rotate');
const ONLY = process.env.PT_ONLY?.split(',');
const ORDER = playOrder();
const ALTARS = ORDER.filter((id) => {
  const p = puzzleFor(id);
  return p.fixed.some((f) => f.gem === 'split') || (p.tray.split ?? 0) > 0;
});
const VIEWS = [
  { w: 1920, h: 1080, scale: 100 },
  { w: 1280, h: 720, scale: 150 },
].filter((v) => (process.env.PT_VIEWS ?? '1920,1280').split(',').includes(String(v.w)));

test.setTimeout(300_000);

async function open(page: Page, id: MachineId, placements: Placement[], scale: number) {
  const solved = ORDER.slice(0, ORDER.indexOf(id));
  await page.evaluate(
    ({ id, scale, placements, solved }) => {
      // biome-ignore lint/suspicious/noExplicitAny: dev handle
      const g = (window as any).__game;
      g.save.update(
        (d: {
          flags: Record<string, boolean>;
          settings: Record<string, unknown>;
          progress: { solved: string[] };
          puzzles: Record<string, unknown>;
        }) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.settings.textScale = scale;
          d.progress.solved = solved;
          d.puzzles = { [id]: { attempts: 0, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, scale, placements, solved },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
}

async function close(page: Page) {
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: dev handle
    (window as any).__game.flow.closePuzzle();
  });
  await page.waitForTimeout(300);
}

async function toPage(page: Page, x: number, y: number) {
  const r = await page.locator('.tc-overlay').boundingBox();
  const s = r!.width / 1920;
  return { x: r!.x + x * s, y: r!.y + y * s };
}

for (const id of ALTARS) {
  if (ONLY && !ONLY.includes(id)) continue;
  for (const v of VIEWS) {
    test(`split rotate ${id} ${v.w}`, async ({ page }) => {
      const dir = join(OUT, `${id}-${v.w}`);
      mkdirSync(dir, { recursive: true });
      let n = 0;
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${String(++n).padStart(2, '0')}-${name}.png`) });
      };
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.goto(DEV_URL);
      await page.waitForFunction(
        () =>
          (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
          'title',
        null,
        { timeout: 30_000 },
      );
      const p = puzzleFor(id);
      const L = computeLayout(p);
      const pt = { x: 0, y: 0 };
      const at = async (c: Cell) => {
        cellCenter(L, c, pt);
        const q = await toPage(page, pt.x, pt.y);
        await page.mouse.move(q.x, q.y, { steps: 4 });
        await page.waitForTimeout(250);
      };
      const click = async () => {
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(250);
      };

      await open(page, id, [], v.scale);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(1500);
      await shot('arrive');

      const fixed = p.fixed.find((f) => f.gem === 'split');
      if (fixed) {
        await page.waitForTimeout(7000);
        await shot('settled');
        await at(fixed.cell);
        await shot('hover-fixed-split');
        await page.keyboard.press('r');
        await page.waitForTimeout(300);
        await shot('fixed-split-R');
      }

      const traySplit = p.design.intended.find((g) => g.gem === 'split');
      if (traySplit) {
        await close(page);
        const rest = p.design.intended.filter((g) => g !== traySplit);
        await open(page, id, rest, v.scale);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(1500);
        const slot = L.tray.find((s) => s.gem === 'split')!;
        const q = await toPage(page, slot.x, slot.y);
        await page.mouse.move(q.x, q.y, { steps: 4 });
        await page.waitForTimeout(300);
        await shot('hover-tray-split');
        await click();
        await at(traySplit.cell);
        await shot('split-in-hand-rot0');
        for (let r = 1; r <= 3; r++) {
          await page.keyboard.press('r');
          await page.waitForTimeout(350);
          await shot(`split-in-hand-rot${r}`);
        }
        await page.keyboard.press('r'); // back to rot 0
        for (let r = 0; r < traySplit.rot; r++) await page.keyboard.press('r');
        await page.waitForTimeout(300);
        await click();
        await page.mouse.move(2, 2);
        await page.waitForTimeout(400);
        await shot(`split-placed-rot${traySplit.rot}`);
      }
      await close(page);

      // The whole intended route, then the strike.
      await open(page, id, p.design.intended, v.scale);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(8000);
      await shot('route');
      await page.keyboard.press('f');
      await page.waitForTimeout(9000);
      await shot('struck');
      await close(page);
    });
  }
}
