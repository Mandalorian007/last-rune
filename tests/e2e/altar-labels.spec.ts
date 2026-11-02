import { expect, test } from '@playwright/test';
import { auditAltar, playOrder } from './altar-audit';
import { DEV_URL } from './helpers';

// Every altar, as a player first meets it, at the tightest layout (1280×720, 150% text): the
// storm's "Gives" card and each machine's "Needs" card are up, no label collides with another
// label, the tray, the buttons or FUSE's caption, and the gem card never sits over the board.
// Strike does not glow on an empty board (it glows only once the route reaches every machine).

test.setTimeout(180_000);

test('altar labels clear at 1280×720, 150% text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
      'title',
    null,
    { timeout: 30_000 },
  );
  const order = playOrder();
  const problems: Record<string, string[]> = {};
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!;
    await page.evaluate(
      ({ id, solved }) => {
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
            d.settings.textScale = 150;
            d.progress.solved = solved;
            d.puzzles = {};
          },
        );
        if (g.flow.state === 'title') g.flow.continueGame();
        g.flow.openPuzzle(id);
      },
      { id, solved: order.slice(0, i) },
    );
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.mouse.move(2, 2);
    // The arrival line and the new-gem card are both up a second in.
    await page.waitForTimeout(1000);
    await expect(page.locator('.lr-altar-storm')).toBeVisible();
    await expect(page.locator('.lr-altar-need:not(.lr-altar-storm)')).not.toHaveCount(0);
    await expect(page.locator('.lr-altar-actions .lr-gold-button[data-ready]')).toHaveCount(0);
    const hits = await auditAltar(page, id);
    if (hits.length > 0) problems[id] = hits;
    await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: dev handle
      (window as any).__game.flow.closePuzzle();
    });
    await page.waitForTimeout(200);
  }
  expect(problems).toEqual({});
});
