import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational, type Placement } from '../../games/last-rune/rules';
import { initialState, solveMachine } from '../../games/last-rune/rules/progression';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { deriveHall, firstFocus, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';
import { cursorKeys } from './altar-keys';
import { expect, type Page, test } from './fixtures';
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
    // Input collapses repeat taps of one key inside a single tick, so wait three real frames
    // (at least one fixed-step tick, not wall time) before the next press. Under GPU load a frame can exceed any fixed delay.
    await page.evaluate(() => {
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      return raf().then(raf).then(raf);
    });
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

/**
 * Hall → altar: the first ArrowRight lands on the suggested door, later ones walk the alcoves in
 * focusOrder; Enter opens the focused one.
 */
async function openAltar(page: Page, machine: MachineId, solved: readonly MachineId[] = []) {
  const model = deriveHall(solved.reduce((s, id) => solveMachine(s, id), initialState()));
  const order = focusOrder(model);
  const i = order.indexOf(machine);
  expect(i).toBeGreaterThanOrEqual(0);
  const start = order.indexOf(firstFocus(model)!);
  await press(page, 'ArrowRight', 1 + ((i - start + order.length) % order.length));
  await press(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(500);
}

/** The altar's keyboard cursor (`data-cursor="x,y"` on `.lr-altar`). */
async function altarCursor(page: Page): Promise<{ x: number; y: number }> {
  const v = await page.locator('.lr-altar').getAttribute('data-cursor');
  const [x, y] = (v ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Build the intended solution with the keyboard: 1-6 picks, R turns, arrows and G move, Enter. */
async function buildSolution(page: Page, machine: MachineId) {
  const p = puzzleFor(machine);
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const placed: Placement[] = [];
  for (const g of p.design.intended) {
    await press(page, `Digit${tray.indexOf(g.gem) + 1}`);
    // The altar moves the cursor on to the route's open end after each Enter; plan from there.
    for (const k of cursorKeys(p, placed, await altarCursor(page), g.cell)) await press(page, k);
    // R turns the gem under the cursor: the held gem, over the socket it will land in.
    if (isRotational(g.gem)) await press(page, 'KeyR', g.rot);
    await press(page, 'Enter');
    placed.push({ gem: g.gem, cell: g.cell, rot: g.rot });
  }
}

async function solve(page: Page, machine: MachineId, solved: readonly MachineId[] = []) {
  await openAltar(page, machine, solved);
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
    await solve(page, 'furnace', ['intake-desk']);

    const save = await readSave(page);
    expect(save?.progress.solved).toEqual(expect.arrayContaining(['intake-desk', 'furnace']));
    expect(problems).toEqual([]);
  });
});
