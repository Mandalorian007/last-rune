import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Cell, MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, readSave, waitFrames } from './helpers';

// One input rule at the altar (docs/design/altar-ux.md "Controls"): a click picks up and sets
// down, never turns; R / Q / scroll turn the gem under the pointer, and a gem that cannot turn
// says so at that gem instead of anything else turning. Splitter Mill: a fixed Split at (2,1).

const ID: MachineId = 'splitter-mill';
const P = puzzleFor(ID);
const L = computeLayout(P);
const SPLIT = P.fixed.find((f) => f.gem === 'split')!.cell;
const OPEN: Cell = { x: 4, y: 3 };

test.setTimeout(90_000);

async function open(page: Page, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements }) => {
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
          d.progress.solved = ['intake-desk'];
          d.puzzles = { [id]: { attempts: 0, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id: ID, placements },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(300);
}

/** Move the mouse to a design-space (1920×1080) point. */
async function moveTo(page: Page, x: number, y: number) {
  const r = (await page.locator('.tc-overlay').boundingBox())!;
  const s = r.width / 1920;
  await page.mouse.move(r.x + x * s, r.y + y * s, { steps: 3 });
  await waitFrames(page, 4);
}

async function hover(page: Page, c: Cell) {
  const pt = { x: 0, y: 0 };
  cellCenter(L, c, pt);
  await moveTo(page, pt.x, pt.y);
}

async function click(page: Page) {
  await page.mouse.down();
  await page.mouse.up();
  await waitFrames(page, 4);
}

type Saved = { gem: string; cell: Cell; rot: number };

/** The save's placements once the debounce has written the expected count. */
async function placements(page: Page, n: number): Promise<Saved[]> {
  await expect
    .poll(async () => (await readSave(page))?.puzzles[ID]?.placements.length, { timeout: 5_000 })
    .toBe(n);
  return (await readSave(page))!.puzzles[ID]!.placements as Saved[];
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
      'title',
    null,
    { timeout: 30_000 },
  );
});

test('R over a fixed Split with a Bend in hand: the Split says why, the Bend is not turned', async ({
  page,
}) => {
  await open(page, []);
  const slot = L.tray.find((s) => s.gem === 'bend')!;
  await moveTo(page, slot.x, slot.y);
  await click(page);
  await hover(page, SPLIT);
  // With a gem in hand, hovering the fixed gem already says it will not land there.
  await expect(page.locator('.lr-altar-tag')).toContainText('Part of the machine');
  await page.keyboard.press('KeyR');
  await waitFrames(page, 4);
  await expect(page.locator('.lr-altar-tag')).toContainText("Splits don't turn");
  await page.mouse.wheel(0, 120);
  await waitFrames(page, 4);
  await expect(page.locator('.lr-altar-tag')).toContainText("Splits don't turn");
  // Set down in an open socket: it lands unturned.
  await hover(page, OPEN);
  await click(page);
  const [b] = await placements(page, 1);
  expect(b).toMatchObject({ gem: 'bend', cell: OPEN, rot: 0 });
});

test('clicking a placed Bend picks it up (never turns it)', async ({ page }) => {
  await open(page, [{ gem: 'bend', cell: OPEN, rot: 1 }]);
  await hover(page, OPEN);
  await click(page);
  await placements(page, 0);
  // Set back down where it was: it keeps its turn.
  await click(page);
  const [b] = await placements(page, 1);
  expect(b).toMatchObject({ gem: 'bend', cell: OPEN, rot: 1 });
});

test('scrolling over a placed Bend turns it', async ({ page }) => {
  await open(page, [{ gem: 'bend', cell: OPEN, rot: 0 }]);
  await hover(page, OPEN);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(async () => (await readSave(page))?.puzzles[ID]?.placements[0], { timeout: 5_000 })
    .toMatchObject({ gem: 'bend', cell: OPEN, rot: 1 });
});
