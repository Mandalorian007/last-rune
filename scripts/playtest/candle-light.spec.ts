import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// candle-light captures at 1920×1080: altar (gem held over a live socket; big boards before the
// first strike), hall (first entry, mid-game), title, journal desk, end card. Also measures mean
// luminance (Rec. 709, 0..255) of the candle regions and of the selectable highlights, and a
// frame strip of one candle for the flicker.
//   PLAYTEST_OUT=docs/design/screens/local/candle-light/after \
//     pnpm exec playwright test -c scripts/playtest/playwright.config.ts candle-light
// Writes <shot>.png, <shot>.luma.json and flicker-NN.png.

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-candle-light');
const VP = { width: 1920, height: 1080 };

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    closePuzzle(): void;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
    openJournal?(): void;
  };
  fuse: { hush(): void };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
}

type Rect = [x: number, y: number, w: number, h: number];
/** Regions (1920×1080 px) whose mean luminance is logged per shot. */
const REGIONS: Record<string, Record<string, Rect>> = {
  altar: {
    candleL: [0, 560, 300, 520],
    candleR: [1560, 560, 360, 520],
    flameR: [1780, 720, 70, 90],
  },
  hall: { candles: [0, 700, 1920, 380] },
  title: { left: [0, 500, 520, 580], right: [1400, 500, 520, 580] },
  journal: { page: [560, 140, 800, 800] },
};
/** Mean luminance (Rec. 709, 0..255) of each region of a PNG. */
function measure(page: Page, png: Buffer, regions: Record<string, Rect>) {
  return page.evaluate(
    async ({ b64, regions }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const out: Record<string, number> = {};
      for (const [k, [x, y, w, h]] of Object.entries(regions)) {
        const d = g.getImageData(x, y, w, h).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) {
          s += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
        }
        out[k] = s / (d.length / 4);
      }
      return out;
    },
    { b64: png.toString('base64'), regions },
  );
}

/**
 * Screenshot, then measure the regions over 7 frames ~250 ms apart and keep the median of each
 * (so one candle swell or lightning strike does not skew it).
 */
async function shot(page: Page, name: string, regions?: Record<string, Rect>) {
  await waitFrames(page, 8);
  const png = await page.screenshot({ path: join(OUT, `${name}.png`) });
  if (!regions) return;
  const samples = [await measure(page, png, regions)];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(250);
    samples.push(await measure(page, await page.screenshot(), regions));
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(regions)) {
    const v = samples.map((s) => s[k]!).sort((a, b) => a - b);
    out[k] = Math.round(v[3]! * 10) / 10;
  }
  writeFileSync(join(OUT, `${name}.luma.json`), JSON.stringify(out));
}

async function boot(page: Page, solved: 'none' | 'some' | 'tier3' | 'most' | 'all', title = false) {
  await page.setViewportSize(VP);
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  if (title) return;
  await page.evaluate(
    ({ solved, ids }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = solved !== 'none';
        d.settings.captionSpeed = 'instant';
        d.journal.found = [1, 2, 3];
        d.progress.solved =
          solved === 'none'
            ? []
            : solved === 'some'
              ? ids.slice(0, 5)
              : solved === 'tier3'
                ? ids.slice(0, 11)
                : solved === 'all'
                  ? ids
                  : ids.filter((id) => id !== 'the-last-rune');
      });
      g.flow.continueGame();
    },
    { solved, ids: [...MACHINE_IDS] },
  );
  await page.waitForTimeout(1200);
}

const hush = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.fuse.hush());

test.setTimeout(240_000);
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('title', async ({ page }) => {
  await boot(page, 'none', true);
  await page.waitForTimeout(2500);
  await shot(page, 'title', REGIONS.title);
});

test('hall', async ({ page }) => {
  await boot(page, 'none');
  await hush(page);
  await shot(page, 'hall-first', REGIONS.hall);
  // Hover the first available alcove (keyboard focus).
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await shot(page, 'hall-first-focus', REGIONS.hall);
});

test('hall mid-game', async ({ page }) => {
  await boot(page, 'some');
  await hush(page);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await shot(page, 'hall-mid', REGIONS.hall);
});

test('hall tier 3', async ({ page }) => {
  // Capacitor bay (bottom-right of the tier-3 row) available, everything before it restored.
  await boot(page, 'tier3');
  await hush(page);
  await shot(page, 'hall-tier3', REGIONS.hall);
});

test('altar', async ({ page }) => {
  await boot(page, 'most');
  for (const id of ['intake-desk', 'archive', 'the-last-rune']) {
    await page.evaluate((id) => {
      (window as unknown as { __game: GameHandle }).__game.flow.openPuzzle(id);
    }, id);
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.waitForTimeout(800);
    await hush(page);
    if (id === 'intake-desk') {
      // Take the tray gem and hold it over a live socket (left of the fixed gem).
      await page.mouse.click(770, 955);
      await page.mouse.move(900, 600, { steps: 4 });
      await page.mouse.move(987, 325, { steps: 6 });
      await page.waitForTimeout(500);
    }
    await shot(page, `altar-${id}`, REGIONS.altar);
    if (id === 'intake-desk') {
      // Flicker strip: right candles over ~2.4 s.
      for (let i = 0; i < 12; i++) {
        await page.screenshot({
          path: join(OUT, `flicker-${String(i).padStart(2, '0')}.png`),
          clip: { x: 1500, y: 560, width: 420, height: 520 },
        });
        await page.waitForTimeout(200);
      }
    }
    await page.evaluate(() => {
      (window as unknown as { __game: GameHandle }).__game.flow.closePuzzle();
    });
    await page.waitForTimeout(400);
  }
});

test('journal', async ({ page }) => {
  await boot(page, 'some');
  await hush(page);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(1500);
  await shot(page, 'journal', REGIONS.journal);
});

test('end card', async ({ page }) => {
  await boot(page, 'all');
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('.lr-end-back')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, 'end', REGIONS.hall);
});
