import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Cell, MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, readSave, waitFrames } from '../../tests/e2e/helpers';

// turn-2: does a turn you see stick? Place a Bend from the tray (the hand keeps a Bend), then
// R / scroll over the Bend just placed, then look away. Mouse and keyboard, on splitter-mill
// and furnace. Each step logs the saved turn of the placed Bend next to the screenshot.
//   PLAYTEST_OUT=/tmp/pt-turn2 pnpm exec playwright test -c scripts/playtest/playwright.config.ts turn-2

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-turn-2');
const ALTARS: MachineId[] = ['splitter-mill', 'furnace'];
const VIEWS = [
  { w: 1920, h: 1080, scale: 100 },
  { w: 1280, h: 720, scale: 150 },
];

test.setTimeout(180_000);

async function open(page: Page, id: MachineId, scale: number) {
  await page.evaluate(
    ({ id, scale }) => {
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
          d.puzzles = { [id]: { attempts: 0, placements: [] } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, scale },
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
  for (const v of VIEWS) {
    test(`turn-2 ${id} ${v.w}`, async ({ page }) => {
      const dir = join(OUT, `${id}-${v.w}`);
      mkdirSync(dir, { recursive: true });
      const log: string[] = [];
      let n = 0;
      const p = puzzleFor(id);
      const L = computeLayout(p);
      const bend = p.design.intended.find((g) => g.gem === 'bend')!.cell;
      const savedRot = async () => {
        await page.waitForTimeout(700); // save debounce
        const s = await readSave(page);
        const q = (
          (s?.puzzles[id]?.placements ?? []) as { cell: Cell; rot: number; gem: string }[]
        ).find((g) => g.cell.x === bend.x && g.cell.y === bend.y);
        return q ? `${q.gem} rot ${q.rot}` : 'empty';
      };
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        const file = `${String(++n).padStart(2, '0')}-${name}.png`;
        await page.screenshot({ path: join(dir, file) });
        log.push(`${file}: saved ${await savedRot()}`);
      };
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
      // Some open socket far from the Bend.
      const away: Cell = { x: bend.x >= L.cols / 2 ? 0 : L.cols - 1, y: bend.y };
      const slot = L.tray.findIndex((s) => s.gem === 'bend');

      await page.setViewportSize({ width: v.w, height: v.h });
      await page.goto(DEV_URL);
      await page.waitForFunction(
        () =>
          (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
          'title',
        null,
        { timeout: 30_000 },
      );

      // ── Mouse ──
      await open(page, id, v.scale);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(8000);
      const q = await toPage(page, L.tray[slot]!.x, L.tray[slot]!.y);
      await page.mouse.move(q.x, q.y, { steps: 4 });
      await click();
      await shot('m-bend-in-hand');
      await at(bend);
      await shot('m-bend-over-empty');
      await click();
      await shot('m-bend-placed');
      await page.keyboard.press('r');
      await page.waitForTimeout(300);
      await shot('m-placed-R');
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(300);
      await shot('m-placed-scroll');
      await at(away);
      await shot('m-look-away');
      await at(bend);
      await shot('m-back-over-placed');
      await click();
      await shot('m-click-placed-same-kind');
      const fixed = p.fixed[0];
      if (fixed) {
        await at(fixed.cell);
        await page.keyboard.press('r');
        await page.waitForTimeout(300);
        await shot(`m-R-over-fixed-${fixed.gem}`);
      }
      await close(page);

      // ── Keyboard ──
      await open(page, id, v.scale);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(1500);
      await page.keyboard.press(`Digit${slot + 1}`);
      // Put the cursor on the Bend's socket: hover it, then an arrow hands it to the keys.
      await at(bend);
      await page.keyboard.press('ArrowRight');
      await waitFrames(page, 4);
      await expect(page.locator('.lr-altar')).toHaveAttribute('data-cursor', `${bend.x},${bend.y}`);
      await shot('k-bend-at-cursor');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await shot('k-bend-placed');
      await page.keyboard.press('r');
      await page.waitForTimeout(300);
      await shot('k-placed-R');
      await page.keyboard.press(bend.x > 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForTimeout(300);
      await shot('k-cursor-away');
      await close(page);

      writeFileSync(join(dir, 'log.txt'), `${log.join('\n')}\n`);
    });
  }
}
