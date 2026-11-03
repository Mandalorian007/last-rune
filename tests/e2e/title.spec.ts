import { expect, type Page, test } from '@playwright/test';
import { titleLines } from '../../games/last-rune/content/lines';
import { DEV_URL, trackProblems } from './helpers';

// The title screen while nobody presses anything: FUSE chatters (titleLines, ~every 12–20 s),
// his card keeps off the menu, and he goes quiet the moment the player starts.

interface GameHandle {
  flow: { state: string };
  save: { update(fn: (d: { flags: Record<string, boolean> }) => void): void; flush(): void };
}

const TITLE_TEXTS = new Set(titleLines().map((l) => l.text));

/** Text of the visible caption card ('' when none is up). */
async function captionText(page: Page): Promise<string> {
  const card = page.locator('.tc-caption:not([hidden])');
  if ((await card.count()) === 0) return '';
  return ((await card.first().textContent()) ?? '').trim();
}

/** The title line on the card, if one is up (its text is all in the DOM while it types). */
async function chatterOnCard(page: Page): Promise<string | null> {
  const text = await captionText(page);
  for (const t of TITLE_TEXTS) if (text.includes(t)) return t;
  return null;
}

test('FUSE chatters on the title, clear of the menu, and stops when the player starts', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  // Skip the first-visit knock so the first chatter line comes on its own clock.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.save.update((d) => {
      d.flags.titleKnock = true;
    });
    g.save.flush();
  });
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );

  // A title line arrives within the first gap (8–11 s) plus typing time.
  await expect
    .poll(() => chatterOnCard(page), { timeout: 25_000, intervals: [250] })
    .not.toBe(null);

  // The card never overlaps the menu buttons.
  const card = await page.locator('.tc-caption:not([hidden])').first().boundingBox();
  const menu = await page.locator('.lr-title-menu').boundingBox();
  expect(card && menu).toBeTruthy();
  const overlap =
    card!.x < menu!.x + menu!.width &&
    card!.x + card!.width > menu!.x &&
    card!.y < menu!.y + menu!.height &&
    card!.y + card!.height > menu!.y;
  expect(overlap).toBe(false);

  // Play: he stops mid-line, and no title chatter follows into the hall.
  await page.locator('[data-action="play"], [data-action="continue"]').first().click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.flow.state),
    )
    .toBe('hall');
  for (let i = 0; i < 6; i++) {
    expect(await chatterOnCard(page)).toBe(null);
    await page.waitForTimeout(500);
  }
  expect(problems).toEqual([]);
});

test('the title offers a quiet Ko-fi link that opens only on a click (D-034)', async ({ page }) => {
  test.setTimeout(60_000);
  const problems = trackProblems(page);
  const popups: string[] = [];
  page.on('popup', (p) => popups.push(p.url()));
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  const coffee = page.locator('a.lr-title-coffee');
  await expect(coffee).toBeVisible();
  await expect(coffee).toHaveText('Buy ThunderSoap a coffee');
  await expect(coffee).toHaveAttribute('href', 'https://ko-fi.com/thundersoap');
  await expect(coffee).toHaveAttribute('target', '_blank');
  await expect(coffee).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(coffee.locator('img, iframe, script')).toHaveCount(0);

  // Smaller than Play, and below the menu.
  const box = await coffee.boundingBox();
  const play = await page.locator('.lr-gold-button').first().boundingBox();
  const menu = await page.locator('.lr-title-menu').boundingBox();
  expect(box!.height).toBeLessThan(play!.height);
  expect(box!.y).toBeGreaterThan(menu!.y + menu!.height);

  // Arrow keys reach it (the pad drives the same up/down actions); its Copy link comes last.
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-action="title-coffee-copy"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(coffee).toBeFocused();

  await page.waitForTimeout(1000);
  expect(popups).toEqual([]);
  expect(problems).toEqual([]);
});
