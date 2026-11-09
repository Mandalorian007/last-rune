/// <reference types="@webgpu/types" />
import { expect, type Page, test } from './fixtures';
import { DEV_URL, pressKey, trackProblems, waitFrames } from './helpers';

// menu-flow (D-043): every panel closes with Esc (or its ✕ / Back) to where it was opened,
// focus where the player left it, and the Journal opens over an altar and comes back to the
// same board. Dev server: the `window.__game` handle is DEV-only.

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

const state = (page: Page) => page.evaluate(() => (window as G).__game.flow.state as string);

/** The live board of the altar on the stack (not the save): what the player sees. */
const board = (page: Page) =>
  page.evaluate(() => {
    const g = (window as G).__game;
    const altar = g.stack.scenes.find((s: G) => s.board && s.machine);
    return JSON.stringify(altar?.board.serialise() ?? null);
  });

const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return 'body';
    if (a.tagName === 'CANVAS') return 'canvas';
    return `${a.tagName.toLowerCase()}:${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim()}`;
  });

const panelOpen = (page: Page) => page.locator('.tc-panel:not([hidden])');

/** A returning player (two machines done, one unread page) on the title. */
async function boot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(() => {
    const g = (window as G).__game;
    g.save.update((s: G) => {
      s.flags.hallIntro = true;
      s.settings.captionSpeed = 'instant';
      s.progress.solved = ['intake-desk', 'furnace'];
      s.journal.found = [1, 2];
      s.journal.read = [1];
      s.stats.startedAt = 1;
    });
    g.flow.start();
  });
  await waitFrames(page, 6);
}

/** Into the furnace altar, with a gem of the player's own placed this visit. */
async function toAltar(page: Page) {
  await page.evaluate(() => {
    const g = (window as G).__game;
    if (g.flow.state === 'title') g.flow.continueGame();
    g.flow.openPuzzle('furnace');
  });
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 10);
}

test('desktop: Esc closes every panel back to its opener, focus restored', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = trackProblems(page);
  await boot(page);

  // Title → Settings (from its button) → Esc: back on the title, focus on Settings.
  const titleSettings = page.locator('[data-action="settings"]').first();
  await titleSettings.focus();
  await page.keyboard.press('Enter');
  await expect(panelOpen(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(panelOpen(page)).toHaveCount(0);
  expect(await state(page)).toBe('title');
  expect(await focused(page)).toBe('button:Settings');

  await page.evaluate(() => (window as G).__game.flow.continueGame());
  await waitFrames(page, 10);
  expect(await state(page)).toBe('hall');

  // HUD panels in the hall: Esc closes them to the hall. Focus goes home to the canvas so the
  // keys drive the game again (NO_RESTORE_FOCUS_ATTR on the HUD, a11y decision).
  for (const name of ['Codex', 'Settings']) {
    await page.locator('.lr-hud button', { hasText: name }).click();
    await expect(panelOpen(page)).toHaveCount(1);
    await pressKey(page, 'Escape');
    await expect(panelOpen(page)).toHaveCount(0);
    expect(await state(page)).toBe('hall');
    expect(await focused(page)).toBe('canvas');
  }

  // Journal from the hall: Esc back to the hall.
  await page.locator('.lr-hud [data-action="journal"]').click();
  await expect(page.locator('.lr-journal')).toBeVisible();
  await expect(page.locator('.lr-j-back')).toContainText('Back to the hall');
  await pressKey(page, 'Escape');
  await expect(page.locator('.lr-journal')).toHaveCount(0);
  expect(await state(page)).toBe('hall');

  // The altar: Codex and Settings close back to the same altar, never out of it.
  await toAltar(page);
  for (const name of ['Codex', 'Settings']) {
    await page.locator('.lr-hud button', { hasText: name }).click();
    await expect(panelOpen(page)).toHaveCount(1);
    await pressKey(page, 'Escape');
    await expect(panelOpen(page)).toHaveCount(0);
    expect(await state(page)).toBe('puzzle');
    expect(await focused(page)).toBe('canvas');
  }
  // Then Esc on the altar itself is Back to the hall.
  await pressKey(page, 'Escape');
  expect(await state(page)).toBe('hall');
  expect(problems).toEqual([]);
});

test('desktop: Journal from the altar comes back to the same board', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = trackProblems(page);
  await boot(page);
  await toAltar(page);
  // A gem of this visit: pick up the first tray gem and set it down at the cursor.
  await pressKey(page, 'Digit1');
  await pressKey(page, 'Enter');
  const before = await board(page);
  expect(before).not.toBe('[]');

  const journal = page.locator('.lr-hud [data-action="journal"]');
  await expect(journal).toBeVisible();
  await journal.click();
  await expect(page.locator('.lr-journal')).toBeVisible();
  expect(await state(page)).toBe('journal');
  await expect(page.locator('.lr-j-back')).toContainText('Back to the altar');
  // The altar's own buttons and labels are gone while the desk is up.
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  await page.locator('.lr-j-back').click();
  await expect(page.locator('.lr-altar')).toBeVisible();
  expect(await state(page)).toBe('puzzle');
  expect(await board(page)).toBe(before);

  // J opens it at the altar too, and J (or Esc) closes it back to the same board.
  await pressKey(page, 'KeyJ');
  await expect(page.locator('.lr-journal')).toBeVisible();
  await pressKey(page, 'KeyJ');
  await expect(page.locator('.lr-altar')).toBeVisible();
  expect(await board(page)).toBe(before);
  await pressKey(page, 'KeyJ');
  await expect(page.locator('.lr-journal')).toBeVisible();
  await pressKey(page, 'Escape');
  await expect(page.locator('.lr-altar')).toBeVisible();
  expect(await state(page)).toBe('puzzle');
  expect(await board(page)).toBe(before);
  // And the altar still plays: Back leaves it with the board saved as it was.
  await pressKey(page, 'Escape');
  expect(await state(page)).toBe('hall');
  const saved = await page.evaluate(() =>
    JSON.stringify((window as G).__game.flow.placementsFor('furnace')),
  );
  expect(saved).toBe(before);
  expect(problems).toEqual([]);
});

test.describe('phone (iPhone SE landscape)', () => {
  test.use({ viewport: { width: 667, height: 320 }, hasTouch: true, isMobile: true });

  test('Esc closes the ☰ list and nothing under it', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = trackProblems(page);
    await boot(page);
    await page.evaluate(() => (window as G).__game.flow.continueGame());
    await waitFrames(page, 10);
    const menu = page.locator('.lr-hud-menu');
    const hud = page.locator('.lr-hud');
    await menu.tap();
    await expect(hud).toHaveAttribute('data-open', '');
    await pressKey(page, 'Escape');
    await expect(hud).not.toHaveAttribute('data-open', '');
    // Not the hall's Esc (Settings) on top of it.
    await expect(panelOpen(page)).toHaveCount(0);
    expect(await state(page)).toBe('hall');
    expect(await focused(page)).toMatch(/^button:Menu/);

    // At the altar: Esc closes the list, it does not leave the altar.
    await toAltar(page);
    await menu.tap();
    await expect(hud).toHaveAttribute('data-open', '');
    await pressKey(page, 'Escape');
    await expect(hud).not.toHaveAttribute('data-open', '');
    expect(await state(page)).toBe('puzzle');
    expect(problems).toEqual([]);
  });

  test('☰ at the altar lists Journal; its ✕ comes back to the same board', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = trackProblems(page);
    await boot(page);
    await toAltar(page);
    const before = await board(page);
    await page.locator('.lr-hud-menu').tap();
    const rows = page.locator('.lr-hud > button:not([hidden]):not(.lr-hud-menu)');
    await expect(rows).toHaveCount(3);
    const journal = page.locator('.lr-hud [data-action="journal"]');
    await expect(journal).toBeVisible();
    // The three rows fit the SE's height, none clipped.
    const vh = page.viewportSize()!.height;
    for (const b of await rows.all()) {
      const r = (await b.boundingBox())!;
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(vh);
    }
    await journal.tap();
    await expect(page.locator('.lr-journal')).toBeVisible();
    await page.locator('.lr-j-x').tap();
    await expect(page.locator('.lr-altar')).toBeVisible();
    expect(await state(page)).toBe('puzzle');
    expect(await board(page)).toBe(before);
    // The altar's rail is back (Back, Undo, Clear on the left).
    await expect(page.locator('.lr-altar-back, [data-action="back"]').first()).toBeVisible();
    expect(problems).toEqual([]);
  });
});
