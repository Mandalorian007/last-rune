import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Cell, MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// turn-clarity: the four second-stage altars (unlocked together after the intake desk) as a
// newcomer meets them, by mouse: arrival, the settled board, hovering the fixed gem, a Bend
// in hand over the socket beside it, R there, R and scroll over the fixed gem, setting the
// Bend down, clicking it (picks it up), scrolling over a placed Bend (turns it), and the whole
// route.
//   PLAYTEST_OUT=/tmp/pt-turn pnpm exec playwright test -c scripts/playtest/playwright.config.ts turn-clarity
// PT_ONLY=splitter-mill (optional). Runs 1920×1080 at 100% and 1280×720 at 150% text.

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-turn-clarity');
const ONLY = process.env.PT_ONLY?.split(',');
const ORDER = playOrder();
const ALTARS: MachineId[] = ['furnace', 'splitter-mill', 'relay-tower', 'conveyor-a'];
const VIEWS = [
  { w: 1920, h: 1080, scale: 100 },
  { w: 1280, h: 720, scale: 150 },
];

test.setTimeout(300_000);

async function open(page: Page, id: MachineId, placements: unknown[], scale: number) {
  await page.evaluate(
    ({ id, scale, placements }) => {
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
          d.progress.solved = ['intake-desk'];
          d.puzzles = { [id]: { attempts: 0, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, scale, placements },
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
    test(`turn clarity ${id} ${v.w}`, async ({ page }) => {
      expect(ORDER.indexOf(id)).toBeGreaterThan(0);
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
      await page.waitForTimeout(7000);
      await shot('settled');

      const fixed = p.fixed.find((f) => f.gem === 'split') ?? p.fixed[0]!;
      await at(fixed.cell);
      await shot(`hover-fixed-${fixed.gem}`);

      // A Bend from the tray, over the socket the intended route puts one in next to the fixed gem.
      const bendSlot = L.tray.find((s) => s.gem === 'bend')!;
      const q = await toPage(page, bendSlot.x, bendSlot.y);
      await page.mouse.move(q.x, q.y, { steps: 4 });
      await click();
      await shot('bend-in-hand');
      const bends = p.design.intended.filter((g) => g.gem === 'bend');
      const near = (c: Cell) => Math.abs(c.x - fixed.cell.x) + Math.abs(c.y - fixed.cell.y);
      const bend = bends.sort((a, b) => near(a.cell) - near(b.cell))[0]!;
      await at(bend.cell);
      await shot('bend-over-socket');
      await page.keyboard.press('r');
      await page.waitForTimeout(300);
      await shot('bend-over-socket-R');

      // The confusing case: R, then scroll, over the fixed gem with the Bend in hand.
      await at(fixed.cell);
      await shot('bend-over-fixed');
      await page.keyboard.press('r');
      await page.waitForTimeout(300);
      await shot('bend-over-fixed-R');
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(300);
      await shot('bend-over-fixed-scroll');

      // Set it down at its intended turn, then click it: picks it up (one rule).
      await at(bend.cell);
      await click();
      await shot('bend-placed');
      await click();
      await shot('bend-clicked');
      await click(); // set it back down
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(300);
      await shot('bend-placed-scrolled');
      await close(page);

      // The whole intended route.
      await open(page, id, p.design.intended, v.scale);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(8000);
      await shot('route');
      await close(page);
    });
  }
}
