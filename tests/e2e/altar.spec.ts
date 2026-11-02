import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { altarDims, isRotational } from '../../games/last-rune/rules';
import { initialState } from '../../games/last-rune/rules/progression';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { deriveHall, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';
import { PREVIEW_URL, trackProblems, waitForBoot } from './helpers';

// Plays the first two altars of the production build by keyboard only, the way a pad or
// keyboard player would: title → hall → altar → strike → solve moment → hall.

const SAVE_KEY = 'thunderclap:last-rune:main';

interface SaveEnvelope {
  d: {
    progress: { solved: string[] };
    puzzles: Record<string, { attempts: number; placements: unknown[] }>;
  };
}

async function readSave(page: Page): Promise<SaveEnvelope['d'] | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  return raw ? (JSON.parse(raw) as SaveEnvelope).d : null;
}

async function press(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key, { delay: 50 });
    await page.waitForTimeout(40);
  }
}

/** Title → hall (Enter starts a new game, or continues a saved one). */
async function toHall(page: Page) {
  await page.goto(PREVIEW_URL);
  await waitForBoot(page);
  await page.locator('#app canvas').first().waitFor();
  await page.waitForTimeout(1200);
  await press(page, 'Enter');
  await page.waitForTimeout(1200);
}

/** Hall → altar: ArrowRight walks the alcoves in focusOrder; Enter opens the focused one. */
async function openAltar(page: Page, machine: MachineId) {
  const order = focusOrder(deriveHall(initialState()));
  const i = order.indexOf(machine);
  expect(i).toBeGreaterThanOrEqual(0);
  await press(page, 'ArrowRight', i + 1);
  await press(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(500);
}

/** Build the intended solution with the keyboard cursor: 1-6 picks, R turns, arrows, Enter. */
async function buildSolution(page: Page, machine: MachineId) {
  const p = puzzleFor(machine);
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const rows = altarDims(p.altar).h;
  // The altar's starting cursor (see AltarScene.enter).
  const cursor = { x: 0, y: Math.min(Math.max(0, p.storm.at.y), rows - 1) };
  for (const g of p.design.intended) {
    await press(page, `Digit${tray.indexOf(g.gem) + 1}`);
    if (isRotational(g.gem)) await press(page, 'KeyR', g.rot);
    const dx = g.cell.x - cursor.x;
    const dy = g.cell.y - cursor.y;
    await press(page, dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(dx));
    await press(page, dy > 0 ? 'ArrowDown' : 'ArrowUp', Math.abs(dy));
    cursor.x = g.cell.x;
    cursor.y = g.cell.y;
    await press(page, 'Enter');
  }
}

async function solve(page: Page, machine: MachineId) {
  await openAltar(page, machine);
  await buildSolution(page, machine);
  // Placements save on a short debounce.
  await expect
    .poll(async () => (await readSave(page))?.puzzles[machine]?.placements.length, {
      timeout: 5_000,
    })
    .toBe(puzzleFor(machine).design.intended.length);
  await press(page, 'KeyF');
  // Exact → the machine wakes → solve moment.
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  const save = await readSave(page);
  expect(save?.progress.solved).toContain(machine);
  expect(save?.puzzles[machine]?.attempts).toBe(1);
  // First press reveals the whole card, second continues to the hall.
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  await press(page, 'Enter');
  await expect(page.locator('.lr-solve')).toHaveCount(0, { timeout: 5_000 });
}

test.describe('altar (prod build, keyboard only)', () => {
  test('solves intake-desk then furnace and saves progress', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = trackProblems(page);
    await page.setViewportSize({ width: 1600, height: 900 });

    await toHall(page);
    await solve(page, 'intake-desk');

    // Reload: the save carries over and the title continues into a fresh hall.
    await toHall(page);
    await solve(page, 'furnace');

    const save = await readSave(page);
    expect(save?.progress.solved).toEqual(expect.arrayContaining(['intake-desk', 'furnace']));
    expect(problems).toEqual([]);
  });
});
