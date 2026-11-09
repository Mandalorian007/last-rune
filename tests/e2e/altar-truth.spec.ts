import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { expect, type Page, test } from './fixtures';
import { DEV_URL } from './helpers';

// altar-truth: what the altar shows before Strike matches one rule. No charge numbers sit on the
// route before Strike, on any altar (the badges are gone: a number on a path only appears once
// charge runs). A restored board can be undone, gem by gem.

const ORDER = playOrder();

test.setTimeout(240_000);

async function open(page: Page, id: MachineId, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
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
          d.progress.solved = solved;
          d.puzzles = { [id]: { attempts: 0, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(250);
}

test('no altar shows charge numbers on the route before Strike, and Undo works on a restored board', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
      'title',
    null,
    { timeout: 30_000 },
  );
  const problems: string[] = [];
  for (const id of ORDER) {
    const intended = puzzleFor(id).design.intended;
    // Most of the intended answer placed: charge reaches gems, so a badge would have shown.
    const placed = intended.slice(0, Math.max(1, intended.length - 1));
    await page.goto(DEV_URL);
    await page.waitForFunction(
      () =>
        (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
        'title',
      null,
      { timeout: 30_000 },
    );
    await open(page, id, placed);
    const r = await page.evaluate(() => ({
      chips: [...document.querySelectorAll<HTMLElement>('.lr-altar-chip')].filter(
        (el) => el.offsetParent,
      ).length,
      undo: (document.querySelector('[data-action="undo"]') as HTMLButtonElement | null)?.disabled,
    }));
    if (r.chips) problems.push(`${id}: ${r.chips} charge badges on the route before Strike`);
    if (r.undo !== false) problems.push(`${id}: Undo is greyed with ${placed.length} gems placed`);
  }
  expect(problems).toEqual([]);
});
