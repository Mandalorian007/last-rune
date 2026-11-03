import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, trackProblems } from './helpers';

// Codex unlock-on-sight (codex-2): a gem's page opens the first time the player sees it at an
// altar, marked "Seen" until it is earned, and shows the gem as the altar draws it.

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    closePuzzle(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void; get(): any };
}

async function boot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  // Intake Desk restored (Bend earned); no altar seen since.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.save.update((d) => {
      d.flags.hallIntro = true;
      d.settings.captionSpeed = 'instant';
      d.progress.solved = ['intake-desk'];
      d.codex.met = ['channel', 'bend'];
      d.codex.seen = [];
    });
    g.flow.continueGame();
  });
  await expect(page.locator('.lr-hud')).toBeVisible();
}

const page4 = (page: Page) => page.locator('.lr-codex-page[data-gem="amplify"]');

test('a gem seen at an altar gets its Codex page before it is earned', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await boot(page);

  // Before: Amplify has not been met, so its page is chained and its tab is a "?".
  await page.keyboard.press('KeyC');
  const codex = page.getByRole('dialog', { name: 'Codex' });
  await expect(codex).toBeVisible();
  const tab = codex.locator('.lr-codex-nav button').nth(3);
  await expect(tab).toHaveAttribute('data-status', 'unknown');
  await expect(tab).toHaveText('?');
  await page.keyboard.press('Escape');
  await expect(codex).toBeHidden();

  // The Furnace altar has an Amplify fixed on the board: seeing it is enough.
  await page.evaluate(() => {
    (window as unknown as { __game: GameHandle }).__game.flow.openPuzzle('furnace');
  });
  await page.waitForFunction(
    () => (window as unknown as { __game: GameHandle }).__game.flow.state === 'puzzle',
  );
  await page.evaluate(() => {
    (window as unknown as { __game: GameHandle }).__game.flow.closePuzzle();
  });
  await page.waitForFunction(
    () => (window as unknown as { __game: GameHandle }).__game.flow.state === 'hall',
  );

  const save = await page.evaluate(() => {
    const d = (window as unknown as { __game: GameHandle }).__game.save.get();
    return { met: d.codex.met as string[], solved: d.progress.solved as string[] };
  });
  expect(save.met).toContain('amplify');
  expect(save.solved).not.toContain('furnace');

  await page.keyboard.press('KeyC');
  await expect(codex).toBeVisible();
  await expect(tab).toHaveAttribute('data-status', 'seen');
  await expect(tab).toHaveAccessibleName('Amplify, seen, not yours yet');
  await tab.click();
  const amp = page4(page);
  await expect(amp).toBeVisible();
  await expect(amp).toHaveAttribute('data-status', 'seen');
  await expect(amp.locator('h3')).toContainText('Amplify');
  await expect(amp.locator('.lr-status')).toHaveText('Seen');
  await expect(amp).toContainText('Seen at an altar. Restore the Furnace to earn it.');
  await expect(amp.locator('.lr-codex-rule')).toBeVisible();
  // The picture: the real gem (rendered on the GPU), with the bolt's in and out charges.
  const plate = amp.getByRole('img');
  await expect(plate).toHaveAttribute('aria-label', /Amplify\. A bolt of 4 enters from below/);
  await expect(plate).toHaveAttribute('data-real', 'true');
  await expect(plate.locator('.lr-plate-chip')).toHaveText(['4', '8']);

  // Scoped to the book (the dev server's page shell differs from the shipped one).
  const axe = await new AxeBuilder({ page })
    .include('.lr-codex')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze();
  const found = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
  expect(found, found.join('\n')).toEqual([]);
  expect(problems).toEqual([]);
});
