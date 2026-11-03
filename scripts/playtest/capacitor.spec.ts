import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// capacitor-clarity: the three two-strike altars as a newcomer meets them. Arrival card, the
// settled board, a first try (the obvious wrong route), its strike as a filmstrip (every
// ~350 ms until the verdict has settled), then the intended route and its strike.
//   PLAYTEST_OUT=/tmp/pt-cap pnpm exec playwright test -c scripts/playtest/playwright.config.ts capacitor
// PT_ONLY=capacitor-bay (optional). Runs 1920×1080 at 100% and 1280×720 at 150% text.

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-capacitor');
const ONLY = process.env.PT_ONLY?.split(',');
const ORDER = playOrder();
const ALTARS: MachineId[] = ['capacitor-bay', 'lift-shaft', 'roof-array'];
const VIEWS = [
  { w: 1920, h: 1080, scale: 100 },
  { w: 1280, h: 720, scale: 150 },
];

type P = { cell: { x: number; y: number }; gem: string; rot: number };

/** The first thing a newcomer tries at each altar. */
function firstTry(id: MachineId): P[] {
  const p = puzzleFor(id);
  if (id === 'capacitor-bay') {
    // Straight along the row through the ice.
    return [0, 1, 2, 3, 4, 6, 7].map((x) => ({ cell: { x, y: 2 }, gem: 'channel', rot: 0 }));
  }
  // The intended route with the ice swapped for a plain Channel: 4 + 4 on both strikes.
  return p.design.intended.map((q) =>
    q.gem === 'capacitor' ? { ...q, gem: 'channel', rot: 0 } : q,
  );
}

test.setTimeout(300_000);

async function open(
  page: Page,
  id: MachineId,
  placements: unknown[],
  scale: number,
  attempts: number,
) {
  await page.evaluate(
    ({ id, solved, scale, placements, attempts }) => {
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
          d.settings.textScale = scale;
          d.progress.solved = solved;
          d.puzzles = { [id]: { attempts, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, solved: ORDER.slice(0, ORDER.indexOf(id)), scale, placements, attempts },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
}

async function close(page: Page) {
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: dev handle
    (window as any).__game.flow.closePuzzle();
  });
  await page.waitForTimeout(300);
}

for (const id of ALTARS) {
  if (ONLY && !ONLY.includes(id)) continue;
  for (const v of VIEWS) {
    test(`capacitor ${id} ${v.w}`, async ({ page }) => {
      const dir = join(OUT, `${id}-${v.w}`);
      mkdirSync(dir, { recursive: true });
      let n = 0;
      const shot = async (name: string) => {
        await waitFrames(page, 2);
        await page.screenshot({ path: join(dir, `${String(++n).padStart(2, '0')}-${name}.png`) });
      };
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.goto(DEV_URL);
      await page.waitForFunction(
        () =>
          (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
          'title',
        null,
        { timeout: 30_000 },
      );

      await open(page, id, [], v.scale, 0);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(1500);
      await shot('arrive');
      await page.waitForTimeout(7000);
      await shot('settled');
      await close(page);

      const film = async (tag: string) => {
        await page.mouse.move(2, 2);
        await page.waitForTimeout(800);
        await shot(`${tag}-built`);
        await page.keyboard.press('f');
        const t0 = Date.now();
        let k = 0;
        let doneAt = 0;
        while (Date.now() - t0 < 15_000) {
          await page.waitForTimeout(350);
          await shot(`${tag}-strike-${String(++k).padStart(2, '0')}`);
          const shown = await page.locator('.lr-altar-verdict').isVisible();
          if (shown && !doneAt) doneAt = Date.now();
          if (doneAt && Date.now() - doneAt > 1200) break;
        }
      };

      await open(page, id, firstTry(id), v.scale, 0);
      await film('wrong');
      await close(page);

      await open(page, id, puzzleFor(id).design.intended, v.scale, 1);
      await film('right');
      await close(page);
    });
  }
}
