import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Page, test } from '@playwright/test';
import { DEV_URL } from '../../tests/e2e/helpers';

// tidy-2 captures: FUSE's clipboard drop on the ending, frame-stepped. When the ending reaches
// the 'through' beat the loop is stopped and stepped by hand, 1/20 s a shot, so the fall can be
// read frame by frame (1920x1080).
//   PLAYTEST_OUT=docs/design/screens/local/tidy-2/after pnpm exec playwright test -c scripts/playtest/playwright.config.ts tidy-2

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-tidy-2');
const STEP = 1 / 20;
const SHOTS = 36;

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
  };
  stack: { top?: { phase?: string } };
  loop: { stop(): void; start(): void; tickOnce(dt: number): void };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the playtest side
  save: { update(fn: (d: any) => void): void; flush(): void };
}

async function waitState(page: Page, state: string): Promise<void> {
  await page.waitForFunction(
    (s) => (window as unknown as { __game?: GameHandle }).__game?.flow.state === s,
    state,
    { timeout: 30_000 },
  );
}

test('tidy-2 clipboard drop, frame-stepped', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(DEV_URL);
  await waitState(page, 'title');
  await page.evaluate(async () => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    const typesUrl = '/games/last-rune/rules/types.ts';
    const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
      MACHINE_IDS: string[];
    };
    g.save.update((d) => {
      d.flags.titleKnock = true;
      d.flags.hallIntro = true;
      d.progress.solved = MACHINE_IDS.filter((id) => id !== 'the-last-rune');
      d.settings.captionSpeed = 'instant';
    });
    g.flow.continueGame();
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
  });
  await waitState(page, 'ending');
  // Stop on the first frame of the 'edge' beat's end, i.e. as 'through' begins.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        const poll = () => {
          if (g.stack.top?.phase === 'through') {
            g.loop.stop();
            done();
          } else setTimeout(poll, 0);
        };
        poll();
      }),
  );
  for (let i = 0; i < SHOTS; i++) {
    await page.screenshot({ path: join(OUT, `drop-${String(i).padStart(2, '0')}.png`) });
    await page.evaluate((dt) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.loop.tickOnce(dt);
    }, STEP);
  }
  await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.loop.start());
});
