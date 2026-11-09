import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { simulate } from '../../games/last-rune/rules';
import { fromAscii } from '../../games/last-rune/rules/ascii';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { expect, type Page, test } from './fixtures';
import { DEV_URL, waitFrames } from './helpers';

// polish-9 (D-040 add. 10): a gauge's needle is a meter that tells the truth. Before Strike it
// rests at zero and never moves, whatever is on the board (D-043: nothing reads out an amount
// before Strike). After Strike it settles at what arrived, relative to Needs: exact on the mark
// (1), under short of it, over in the red (> 1); a multi-strike altar shows the last strike.
// Desktop and a phone.

const VIEWS = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'iphone', width: 844, height: 340, touch: true },
] as const;

const ORDER = playOrder();
/** Furnace (gives 4, needs 8): the short road misses both ambers and reads 4. */
const FURNACE_UNDER = fromAscii(['= = ┐ # . .', '. # = . *A .', '. *A = . # .', '# . └ = = =']);
/** Capacitor Bay's first try (capacitor.spec): strike 2 lets out 16 into 8. */
const BAY_OVER = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(180_000);

async function open(page: Page, id: MachineId, placements: readonly unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.lr-altar-tip .lr-info-next');
    if (!(await next.isVisible())) break;
    await next.click();
    await waitFrames(page, 4);
  }
  await page.evaluate(() => (window as G).__game.fuse.hush());
}

/** Every gauge's needle reading (0 .. 1.25), as drawn. */
const needles = (page: Page) =>
  page.evaluate(() =>
    ((window as G).__altarView.machines as { reading: number }[]).map((m) => m.reading),
  );

/** Readings sampled over a few frames: before Strike they must all be exactly 0. */
async function restingNeedles(page: Page) {
  const seen: number[] = [];
  for (let i = 0; i < 6; i++) {
    seen.push(...(await needles(page)));
    await waitFrames(page, 4);
  }
  return seen;
}

async function strike(page: Page) {
  await page.locator('[data-action="strike"]').click();
  await waitFrames(page, 4);
  const sure = page.locator('.lr-confirm .lr-gold-button');
  if (await sure.isVisible()) await sure.click();
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
  // Let the breaker's slam and every spring settle (the breaker lets go after 1.1 s).
  await page.waitForTimeout(2000);
  await waitFrames(page, 4);
}

for (const vp of VIEWS) {
  test.describe(`gauge needle ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.touch,
      hasTouch: vp.touch,
      deviceScaleFactor: 1,
    });

    test(`the needle rests at 0 before Strike and shows what arrived after (${vp.name})`, async ({
      page,
    }) => {
      // The fixtures read as they claim.
      const furnace = puzzleFor('furnace');
      const under = simulate(furnace, FURNACE_UNDER).machines[0]!;
      expect(under.outcome, 'furnace short road').toBe('under');
      expect(under.readings.at(-1)).toBe(4);
      expect(simulate(furnace, furnace.design.intended).outcome).toBe('exact');
      const bay = simulate(puzzleFor('capacitor-bay'), BAY_OVER as never);
      expect(bay.outcome, 'bay first try').toBe('over');

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate((touch) => {
        document.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerType: touch ? 'touch' : 'mouse',
            bubbles: true,
          }),
        );
      }, vp.touch);

      const after: Record<string, number> = {};
      const cases = [
        ['under', 'furnace', FURNACE_UNDER, 0],
        ['over', 'capacitor-bay', BAY_OVER, -1],
        // Last: an exact strike moves on to the solve moment, whose needles start on the mark.
        ['exact', 'furnace', furnace.design.intended, 0],
      ] as const;
      for (const [name, id, placements, gauge] of cases) {
        await open(page, id, placements);
        // D-043: before Strike, nothing on the dial moves; the route being whole changes nothing.
        const rest = await restingNeedles(page);
        expect(rest.length, `${name}: gauges read`).toBeGreaterThan(0);
        expect(
          rest.every((r) => r === 0),
          `${name}: needles before Strike ${rest}`,
        ).toBe(true);
        await strike(page);
        const read = await needles(page);
        // The gauge that decides the case (Capacitor Bay: the one the route reaches).
        after[name] = gauge >= 0 ? read[gauge]! : Math.max(...read);
      }
      expect(after.under!, 'under: short of the mark').toBeGreaterThan(0.3);
      expect(after.under!, 'under: short of the mark').toBeLessThan(0.95);
      expect(after.exact!, 'exact: on the mark').toBeGreaterThan(0.97);
      expect(after.exact!, 'exact: on the mark').toBeLessThan(1.03);
      expect(after.over!, 'over: in the red').toBeGreaterThan(1.05);
      expect(new Set([after.under, after.exact, after.over].map((v) => v!.toFixed(2))).size).toBe(
        3,
      );
    });
  });
}
