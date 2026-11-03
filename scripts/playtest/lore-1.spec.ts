import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { DEV_URL } from '../../tests/e2e/helpers';

// lore-1 captures: the reveal path a fast player sees at the end of Tier 3 (lift solve, booth
// solve with FUSE's realisation) and page 16 on the journal desk with its trailing signature.
// 1920x1080 and 1280x720 at 150% text.
//   PLAYTEST_OUT=docs/design/screens/local/lore-1/after pnpm exec playwright test -c scripts/playtest/playwright.config.ts lore-1

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-lore-1');

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
    openJournal(): boolean;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void; flush(): void };
}

const RUNS = [
  { name: '1920', width: 1920, height: 1080, textScale: 100 },
  { name: '1280-text150', width: 1280, height: 720, textScale: 150 },
] as const;

/** Still to restore when the capture starts (the end of Tier 3). */
const LEFT = ['lift-shaft', 'roof-array', 'control-booth', 'the-last-rune'];

async function waitState(page: Page, state: string): Promise<void> {
  await page.waitForFunction(
    (s) => (window as unknown as { __game?: GameHandle }).__game?.flow.state === s,
    state,
    { timeout: 30_000 },
  );
}

async function solve(page: Page, id: string): Promise<void> {
  await page.evaluate((m) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.flow.openPuzzle(m);
    g.flow.completePuzzle(m);
  }, id);
  await waitState(page, 'solve');
}

async function toHall(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { __game: GameHandle }).__game.flow.finishSolve(),
  );
  await waitState(page, 'hall');
}

for (const run of RUNS) {
  test(`lore-1 captures ${run.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    const dir = join(OUT, run.name);
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    const said: string[] = [];
    const card = async () =>
      (
        await page
          .locator('.tc-caption-text')
          .allInnerTexts()
          .catch(() => [])
      ).join(' | ');
    await page.setViewportSize({ width: run.width, height: run.height });
    await page.goto(DEV_URL);
    await waitState(page, 'title');
    await page.evaluate(
      async ({ r, left }) => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        const typesUrl = '/games/last-rune/rules/types.ts';
        const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
          MACHINE_IDS: string[];
        };
        g.save.update((d) => {
          d.flags.titleKnock = true;
          d.flags.hallIntro = true;
          d.settings.textScale = r.textScale;
          d.progress.solved = MACHINE_IDS.filter((id) => !left.includes(id));
          d.journal.found = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
          d.journal.read = [...d.journal.found];
        });
        g.save.flush();
      },
      { r: run, left: LEFT },
    );
    await page.reload();
    await waitState(page, 'title');
    await page.evaluate(() =>
      (window as unknown as { __game: GameHandle }).__game.flow.continueGame(),
    );
    await waitState(page, 'hall');
    await page.waitForTimeout(1500);

    // Two machines out: the lift. The slip "I… the Builder" should be readable at a glance.
    await solve(page, 'lift-shaft');
    await page.waitForTimeout(4200);
    said.push(`lift-shaft.solve: ${await card()}`);
    await shot('01-lift-solve');
    await toHall(page);
    await solve(page, 'roof-array');
    await page.waitForTimeout(1500);
    await toHall(page);

    // The booth: FUSE reads page 16 and says it.
    await solve(page, 'control-booth');
    await page.waitForTimeout(2600);
    said.push(`control-booth.solve (2.6 s): ${await card()}`);
    await shot('02-booth-solve-typing');
    await page.waitForTimeout(2600);
    said.push(`control-booth.solve (5.2 s): ${await card()}`);
    await shot('03-booth-solve');
    await toHall(page);
    await page.waitForTimeout(800);

    await page.evaluate(() =>
      (window as unknown as { __game: GameHandle }).__game.flow.openJournal(),
    );
    await waitState(page, 'journal');
    await page.locator('.lr-j-slip[data-page="16"]').click();
    await page.waitForTimeout(1500);
    await shot('04-journal-page-16');
    await page.locator('.lr-j-slip[data-page="14"]').click();
    await page.waitForTimeout(1500);
    await shot('05-journal-page-14');
    writeFileSync(join(dir, 'said.txt'), `${said.join('\n')}\n`);
  });
}
