import { machineLine } from '../../games/last-rune/content/lines';
import { auditAltar, playOrder } from './altar-audit';
import { expect, test } from './fixtures';
import { DEV_URL, settled } from './helpers';

/** What the audit measures. */
const AUDITED =
  '.lr-altar-need, .lr-altar-actions, .lr-altar-title, .lr-altar-tip:not([hidden]), .tc-caption:not([hidden]), .lr-altar-count, .lr-hud button';

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
    // The arrival line, where the altar has one, is up (and the new-gem card, which shows from the first frame where
    // there is one), then the audited boxes hold still for 2 frames: game time, not wall time.
    if (machineLine(id, 'arrive'))
      await expect(page.locator('.tc-caption:not([hidden])')).not.toHaveText('');
    await settled(page, AUDITED);
    await expect(page.locator('.lr-altar-storm')).toBeVisible();
    await expect(page.locator('.lr-altar-need:not(.lr-altar-storm)')).not.toHaveCount(0);
    await expect(page.locator('.lr-altar-actions .lr-gold-button[data-ready]')).toHaveCount(0);
    const hits = await auditAltar(page, id);
    if (hits.length > 0) problems[id] = hits;
    await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: dev handle
      (window as any).__game.flow.closePuzzle();
    });
    await expect(page.locator('.lr-altar')).toHaveCount(0);
  }
  expect(problems).toEqual({});
});
