/**
 * strike-free (D-043): Strike is a free test. The goal page says a miss costs nothing; the first
 * miss ever says it once more under the verdict, and never again; the altar shows no attempt
 * count ("Attempt N", "try N") anywhere. Verdicts lead with what happened ("Got 2, needs 4").
 *
 * SHOTS=<dir> saves what the checks saw to docs/design/screens/local/<dir>/<phone>/ (git-ignored).
 */
import { mkdirSync } from 'node:fs';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { FIRST_MISS_LINE } from '../../games/last-rune/scenes/altar/altar-defs';
import { playOrder } from './altar-audit';
import { expect, type Page, test } from './fixtures';
import { DEV_URL, settled, waitFrames } from './helpers';

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

const DIR = process.env.SHOTS ?? '';
const ORDER = playOrder();
/** Capacitor Bay's first try (capacitor.spec): strike 1 stores 8, strike 2 lets out 16 into 8. */
const BAY_FIRST_TRY = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

const PHONES = [
  { name: 'se', width: 667, height: 320, touch: true },
  { name: 'android', width: 915, height: 360, touch: true },
  { name: 'desktop', width: 1280, height: 720, touch: false },
] as const;

test.setTimeout(180_000);

async function snap(page: Page, folder: string, name: string) {
  if (!DIR) return;
  await settled(page, '#app *');
  await waitFrames(page, 6);
  const dir = `docs/design/screens/local/${DIR}/${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function boot(page: Page, touch: boolean) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  if (touch)
    await page.evaluate(() =>
      document.dispatchEvent(
        new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
      ),
    );
}

/** Open `id` as a player meets it: everything before it solved, `placements` on its board. */
async function open(page: Page, id: string, placements: unknown[]) {
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
      if (g.flow.state !== 'hall') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id as (typeof ORDER)[number])) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
}

/** The arrival card's page text, then close it page by page. */
async function readAndCloseCard(page: Page, touch: boolean): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    const tip = page.locator('.lr-altar-tip:not([hidden])');
    if ((await tip.count()) === 0) break;
    seen.push(((await tip.textContent()) ?? '').replace(/ /g, ' '));
    const next = page.locator('.lr-altar-tip .lr-info-next');
    if (!(await next.isVisible())) break;
    if (touch) await next.tap();
    else await next.click();
    await waitFrames(page, 4);
  }
  await page.evaluate(() => (window as G).__game.fuse.hush());
  return seen;
}

async function strike(page: Page, touch: boolean) {
  const btn = page.locator('[data-action="strike"]');
  if (touch) await btn.tap();
  else await btn.click();
  await waitFrames(page, 4);
  const sure = page.locator('.lr-confirm .lr-gold-button');
  if (await sure.isVisible()) await (touch ? sure.tap() : sure.click());
  await page.waitForFunction(
    () => {
      const v = document.querySelector<HTMLElement>('.lr-altar-verdict');
      return !!v && !v.hidden;
    },
    null,
    { polling: 'raf', timeout: 30_000 },
  );
  await waitFrames(page, 6);
}

/** Every word on the altar (shown or not), for the no-counter check. */
async function altarText(page: Page): Promise<string> {
  return page.evaluate(() =>
    ((document.querySelector('.lr-altar') as HTMLElement | null)?.textContent ?? '').replace(
      / /g,
      ' ',
    ),
  );
}

const COUNTER = /\bAttempt\b|\btry \d/i;

for (const vp of PHONES) {
  test.describe(`strike-free ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.touch,
      hasTouch: vp.touch,
      deviceScaleFactor: vp.touch ? 1 : undefined,
    });

    test(`a miss is free: said once, no counters, verdict as information (${vp.name})`, async ({
      page,
    }) => {
      await boot(page, vp.touch);
      await page.evaluate(() => (window as G).__game.flow.newGame());
      // The first altar, half built: its card opens with the goal.
      const intake = puzzleFor('intake-desk');
      const half = intake.design.intended.slice(0, Math.floor(intake.design.intended.length / 2));
      await open(page, 'intake-desk', half);
      await snap(page, vp.name, '1-goal');
      const pages = await readAndCloseCard(page, vp.touch);
      // Phones page their arrival card, goal first (desktop's card names the pieces only).
      if (vp.touch) expect(pages[0]).toContain('a miss costs nothing');

      // First miss ever: the verdict adds the free-test line.
      await strike(page, vp.touch);
      const free = page.locator('.lr-altar-verdict .lr-verdict-free');
      await expect(free).toHaveText(FIRST_MISS_LINE);
      await expect(free).toBeVisible();
      const head = await page.evaluate(
        () => document.querySelector('.lr-altar-verdict')?.firstChild?.textContent ?? '',
      );
      expect(head.replace(/ /g, ' ')).toMatch(/^(Got \d|The charge|No charge)/);
      expect(await altarText(page)).not.toMatch(COUNTER);
      await snap(page, vp.name, '2-first-miss');

      // Strike again, unchanged: a second miss, no line.
      await strike(page, vp.touch);
      await expect(page.locator('.lr-altar-verdict')).toBeVisible();
      await expect(free).toHaveCount(0);
      expect(await altarText(page)).not.toMatch(COUNTER);
      await snap(page, vp.name, '3-later-miss');

      // Back to edit: still no "try N" in the subtitle.
      const undo = page.locator('[data-action="undo"]');
      if (await undo.isEnabled()) await (vp.touch ? undo.tap() : undo.click());
      await waitFrames(page, 6);
      expect(await altarText(page)).not.toMatch(COUNTER);

      // Never again: another altar, another visit.
      // Its first meeting (an empty board): the card's strikes page.
      await open(page, 'capacitor-bay', []);
      await snap(page, vp.name, '4-strikes-page');
      await open(page, 'capacitor-bay', BAY_FIRST_TRY);
      await readAndCloseCard(page, vp.touch);
      await strike(page, vp.touch);
      await expect(free).toHaveCount(0);
      expect(await altarText(page)).not.toMatch(COUNTER);
      await snap(page, vp.name, '5-bay-miss');
      const save = await page.evaluate(() => (window as G).__game.save.get());
      expect(save.flags.missTold).toBe(true);
      expect(save.puzzles['capacitor-bay'].attempts).toBe(1);
    });
  });
}
