import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL } from '../../tests/e2e/helpers';

// codex-2: the Codex as a newcomer sees it. Early (intake-desk restored, then the furnace altar
// opened: Amplify seen, not yours) and late (everything up to the foundry restored), every
// spread, at 1920×1080 / 100% and 1280×720 / 150% text.
//   PLAYTEST_OUT=/tmp/pt-codex pnpm exec playwright test -c scripts/playtest/playwright.config.ts codex-2

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-codex-2');
const VIEWS = [
  { w: 1920, h: 1080, scale: 100 },
  { w: 1280, h: 720, scale: 150 },
];
const ORDER = playOrder();

function gemsSeen(ids: readonly MachineId[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const p = puzzleFor(id);
    for (const f of p.fixed) out.add(f.gem);
    for (const g of GEM_KINDS) if ((p.tray[g] ?? 0) > 0) out.add(g);
  }
  return [...out];
}

interface Handle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    closePuzzle(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void; get(): any };
  settings: { set(p: { textScale: number }): void };
}

async function boot(page: Page, scale: number, solved: MachineId[], met: string[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: Handle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, met }) => {
      const g = (window as unknown as { __game: Handle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.settings.textScale = scale;
        d.progress.solved = solved;
        d.codex.met = met;
        d.codex.seen = [];
      });
      g.flow.continueGame();
      if (scale !== 100) g.settings.set({ textScale: scale });
    },
    { scale, solved, met },
  );
  await page.waitForTimeout(800);
}

async function shoot(page: Page, dir: string, tag: string) {
  await page.keyboard.press('KeyC');
  await expect(page.locator('.lr-codex')).toBeVisible();
  await page.waitForTimeout(500);
  for (let s = 0; s < 3; s++) {
    if (s === 0) {
      // Start from the first spread whatever page the book opened at.
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(250);
    }
    await page.screenshot({ path: join(dir, `${tag}-spread${s + 1}.png`) });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
  }
  await page.keyboard.press('Escape');
}

test.setTimeout(120_000);

for (const v of VIEWS) {
  const tag = `${v.w}`;
  test(`codex early ${tag}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: v.w, height: v.h });
    const solved = ORDER.slice(0, 1);
    await boot(page, v.scale, solved, gemsSeen(solved));
    await shoot(page, OUT, `early-${tag}`);
    // Open the furnace altar (fixed Amplify), go back, and look again.
    await page.evaluate(() => {
      const g = (window as unknown as { __game: Handle }).__game;
      g.flow.openPuzzle('furnace');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, `early-${tag}-furnace-altar.png`) });
    await page.evaluate(() => (window as unknown as { __game: Handle }).__game.flow.closePuzzle());
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `early-${tag}-after-furnace.png`) });
    await page.keyboard.press('Escape');
  });

  test(`codex late ${tag}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: v.w, height: v.h });
    const solved = ORDER.slice(0, ORDER.indexOf('foundry') + 1);
    await boot(page, v.scale, solved, gemsSeen(solved));
    await shoot(page, OUT, `late-${tag}`);
  });
}
