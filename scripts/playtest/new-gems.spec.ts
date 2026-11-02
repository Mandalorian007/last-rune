import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational } from '../../games/last-rune/rules';
import type { MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { newGems } from '../../games/last-rune/scenes/altar/teach';
import { playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// onboarding-2: fresh-eyes sequences for each altar that introduces a gem (as a player who
// follows the hall glow meets it): arrival card, settled board, hovering a fixed gem, a tray
// gem in hand over a socket (turned once if it turns), the route with the new gem in it, and
// the Strike-ready glow.
//   PLAYTEST_OUT=/tmp/pt-new pnpm exec playwright test -c scripts/playtest/playwright.config.ts new-gems
// PT_VIEWPORT=1920x1080 (default), PT_SCALE=100, PT_ONLY=furnace (optional).

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-new-gems');
const [VW, VH] = (process.env.PT_VIEWPORT ?? '1920x1080').split('x').map(Number) as [
  number,
  number,
];
const SCALE = Number(process.env.PT_SCALE ?? 100);
const ONLY = process.env.PT_ONLY?.split(',');
const ORDER = playOrder();

/** Altars that introduce something, in play order. */
const FIRSTS = ORDER.filter((id, i) => {
  const n = newGems(
    puzzleFor(id),
    ORDER.slice(0, i).map((q) => puzzleFor(q)),
  );
  return n.fixed.length + n.tray.length + n.turns.length > 0;
});

test.setTimeout(300_000);

async function open(page: Page, id: MachineId, placements: unknown[], attempts = 0) {
  const i = ORDER.indexOf(id);
  await page.evaluate(
    ({ id, solved, scale, placements, attempts }) => {
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
          d.puzzles = { [id]: { attempts, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, solved: ORDER.slice(0, i), scale: SCALE, placements, attempts },
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

/** Page point for a design-space (1920×1080) point. */
async function toPage(page: Page, x: number, y: number) {
  const r = await page.locator('.tc-overlay').boundingBox();
  const s = r!.width / 1920;
  return { x: r!.x + x * s, y: r!.y + y * s };
}

for (const id of FIRSTS) {
  if (ONLY && !ONLY.includes(id)) continue;
  test(`new gems at ${id}`, async ({ page }) => {
    const dir = join(OUT, id);
    mkdirSync(dir, { recursive: true });
    const shot = async (name: string) => {
      await waitFrames(page, 6);
      await page.screenshot({ path: join(dir, `${name}.png`) });
    };
    await page.setViewportSize({ width: VW, height: VH });
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
    const i = ORDER.indexOf(id);
    const news = newGems(
      p,
      ORDER.slice(0, i).map((q) => puzzleFor(q)),
    );
    const pt = { x: 0, y: 0 };
    const move = async (x: number, y: number) => {
      const q = await toPage(page, x, y);
      await page.mouse.move(q.x, q.y, { steps: 4 });
    };

    // 1. Arrival: the card names what is new, off the board.
    await open(page, id, []);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1500);
    await shot('1-arrive');
    await expect(page.locator('.lr-altar-tip')).toBeVisible();

    // 2. A few seconds later the card has gone: nothing over the board.
    await page.waitForTimeout(7000);
    await shot('2-settled');
    await expect(page.locator('.lr-altar-tip')).toBeHidden();

    // 3. Hover the new fixed gem (or any fixed gem): "Fixed in place".
    const f = news.fixed[0]?.cell ?? p.fixed[0]?.cell;
    if (f) {
      cellCenter(L, f, pt);
      await move(pt.x, pt.y);
      await page.waitForTimeout(300);
      await shot('3-hover-fixed');
      await expect(page.locator('.lr-altar-tip .lr-info-tag')).toHaveText('Fixed in place');
    }

    // 4. Take a tray gem (the turning one if this altar teaches turning) and hold it over the
    //    socket the intended route uses: the preview swings through it.
    const kind = news.turns[0] ?? news.tray[0] ?? L.tray[0]!.gem;
    const slot = L.tray.find((s) => s.gem === kind) ?? L.tray[0]!;
    await move(slot.x, slot.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    await shot('4-in-hand');
    const target = p.design.intended.find((q) => q.gem === slot.gem);
    if (target) {
      cellCenter(L, target.cell, pt);
      await move(pt.x, pt.y);
      await page.waitForTimeout(400);
      await shot('5-over-socket');
      if (isRotational(slot.gem)) {
        await expect(page.locator('.lr-altar-turn')).toBeVisible();
        await page.keyboard.press('r');
        await page.waitForTimeout(400);
        await shot('6-turned');
        await expect(page.locator('.lr-altar-turn')).toBeHidden();
      }
    }
    await close(page);

    // 7. The intended route but one gem: the preview carries the charge through the new gem.
    const intended = p.design.intended;
    await open(page, id, intended.slice(0, -1), 1);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(8000);
    await shot('7-route');
    await close(page);

    // 8. The whole route: Strike glows (reaches every machine; not a promise it is exact).
    await open(page, id, intended, 1);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(8000);
    await shot('8-ready');
    await expect(page.locator('.lr-altar-actions .lr-gold-button[data-ready]')).toHaveCount(1);
    await close(page);
  });
}
