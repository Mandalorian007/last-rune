/// <reference types="@webgpu/types" />
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { initialState } from '../../games/last-rune/rules/progression';
import { deriveHall, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';
import { DEV_URL, PREVIEW_URL, pressKey, trackProblems, waitForBoot } from './helpers';

// Accessibility (docs/design/a11y-audit.md): axe on every screen, the keyboard focus path,
// focus after a HUD-opened panel closes, and what the altar's live region says.
//
// axe can't see through the WebGPU canvas, so colour-contrast comes back "incomplete" rather
// than failing. DOM text contrast was measured against the rendered pixels instead (audit).

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];

async function expectNoAxeViolations(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const found = r.violations.map(
    (v) =>
      `${label}: [${v.impact}] ${v.id} on ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(found, found.join('\n')).toEqual([]);
}

/** A short description of the focused element: tag plus accessible-ish name. */
function focused(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'body';
    const name = (a.getAttribute('aria-label') ?? a.textContent ?? '').trim();
    return `${a.tagName.toLowerCase()}:${name}`;
  });
}

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
}

const flowState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.flow.state);

test('keyboard path title → settings → hall → altar, with axe and the strike announcement', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = trackProblems(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PREVIEW_URL);
  await waitForBoot(page);
  await page.locator('#app canvas').first().waitFor();
  await page.waitForTimeout(1200);

  // Title: the canvas holds focus at boot (Enter plays); Tab reaches the menu in order.
  expect(await focused(page)).toBe('canvas:Game view');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expectNoAxeViolations(page, 'title');
  await page.keyboard.press('Tab');
  expect(await focused(page)).toBe('button:Play');
  await page.keyboard.press('Tab');
  expect(await focused(page)).toBe('button:Settings');

  // Settings: focus moves in, Tab is trapped, Esc closes and focus returns to the opener.
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await expectNoAxeViolations(page, 'settings');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await focused(page)).toBe('button:Settings');

  // Play from the menu by keyboard.
  await page.keyboard.press('Shift+Tab');
  expect(await focused(page)).toBe('button:Play');
  await page.keyboard.press('Enter');
  await expect(page.locator('.lr-hud')).toBeVisible();
  await page.waitForTimeout(1200);
  await expectNoAxeViolations(page, 'hall');

  // A HUD button opens the codex; when it closes, focus goes to the canvas, not the button,
  // so the arrows and Enter drive the hall again.
  await page.locator('.lr-hud button', { hasText: 'Codex' }).click();
  const codex = page.getByRole('dialog', { name: 'Codex' });
  await expect(codex).toBeVisible();
  await expectNoAxeViolations(page, 'codex');
  await page.keyboard.press('Escape');
  await expect(codex).toBeHidden();
  expect(await focused(page)).toBe('canvas:Game view');

  // Hall → the first altar with the arrows; the name plate says what a door needs.
  const order = focusOrder(deriveHall(initialState()));
  await pressKey(page, 'ArrowRight', order.indexOf('intake-desk') + 1);
  await expect(page.locator('.lr-nameplate')).toContainText('Open');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible();

  // The live region briefs the altar: name, storm, what the machine needs, then the gems this
  // altar introduces (the same text as the arrival card).
  const need = puzzleFor('intake-desk').machines[0]!.need;
  const announce = page.locator('.lr-altar-announce');
  await expect(announce).toHaveAttribute('aria-live', 'polite');
  await expect(announce).toContainText(
    `Intake Desk altar. Storm ×1 gives 4. The machine needs exactly ${need}. New: Bend (Fixed in place):`,
  );
  await expect(announce).toContainText('New: Channel:');
  await page.waitForTimeout(500);
  await expectNoAxeViolations(page, 'altar');

  // Strike: the verdict is spoken through the live region, with a way forward.
  await pressKey(page, 'KeyF');
  const verdict = page.locator('.lr-altar-verdict');
  await expect(verdict).toBeVisible({ timeout: 20_000 });
  // The headline (first text node) and the visible next step are both spoken.
  const said = (await verdict.evaluate((el) => el.firstChild?.textContent ?? '')).trim();
  expect(said.length).toBeGreaterThan(0);
  await expect(announce).toContainText(said);
  const hint = (await verdict.locator('.lr-verdict-hint').textContent())!.trim();
  expect(hint).toMatch(/^Try: /);
  await expect(announce).toContainText(hint);
  await expect(announce).toContainText('Change anything to try again.');
  await expectNoAxeViolations(page, 'altar result');

  // Esc on a focused altar button still means Back.
  await page.locator('.lr-altar button[data-action="back"]').focus();
  await pressKey(page, 'Escape');
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('solve, journal and end card: axe, and Esc works from a focused button', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = trackProblems(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.save.update((d) => {
      d.flags.hallIntro = true;
      d.settings.captionSpeed = 'instant';
    });
    g.flow.continueGame();
    g.flow.openPuzzle('intake-desk');
    g.flow.completePuzzle('intake-desk');
  });

  // The solve card: its Continue button takes focus once the card is up.
  const cont = page.locator('.lr-solve > button');
  await expect(cont).toBeFocused({ timeout: 15_000 });
  await expectNoAxeViolations(page, 'solve');
  await page.keyboard.press('Enter');
  await expect.poll(() => flowState(page)).toBe('hall');

  // Journal: Tab to a page slip, then Esc (a button key) still goes back to the hall.
  await page.waitForTimeout(500);
  await pressKey(page, 'KeyJ');
  await expect.poll(() => flowState(page)).toBe('journal');
  await page.waitForTimeout(800);
  await expectNoAxeViolations(page, 'journal');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.matches('.lr-j-slip'))) break;
  }
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  await pressKey(page, 'Escape');
  await expect.poll(() => flowState(page)).toBe('hall');

  // End card (a replay, so Esc skips to it): axe and Tab order.
  await page.evaluate(async () => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    const typesUrl = '/games/last-rune/rules/types.ts';
    const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
      MACHINE_IDS: string[];
    };
    g.save.update((d) => {
      d.progress.solved = [...MACHINE_IDS];
    });
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
  });
  await expect.poll(() => flowState(page)).toBe('ending');
  await page.keyboard.press('Escape');
  const back = page.locator('.lr-end-back');
  await expect(back).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await expectNoAxeViolations(page, 'end card');
  const join = page.locator('.lr-end-card a.lr-end-join');
  await join.focus();
  // Tab order: Join, its Copy link, Ko-fi, its Copy link, Back.
  for (const sel of [
    '[data-action="ending-join-copy"]',
    '.lr-end-card a.lr-end-coffee',
    '[data-action="ending-coffee-copy"]',
  ]) {
    await page.keyboard.press('Tab');
    await expect(page.locator(sel)).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  expect(problems).toEqual([]);
});
