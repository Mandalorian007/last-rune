import { expect, type Page, test } from '@playwright/test';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { DEV_URL } from './helpers';

// capacitor-clarity: a two-strike altar says so before Strike, the Capacitor reads out what it
// keeps on strike 1 and lets out on strike 2 (in the plan and as it plays), and the verdict
// names the strike and tells what the ice did. Capacitor Bay: storm gives 8, two strikes, a
// fixed Capacitor at (5,2); the first try (up the lane, one Bend east through the ice) keeps 8
// then lets out 16 into a machine needing 8.

const ID: MachineId = 'capacitor-bay';
const ORDER = playOrder();
const ROW = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

test.setTimeout(90_000);

async function open(page: Page, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
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
          d.progress.solved = solved;
          d.puzzles = { [id]: { attempts: 0, placements } };
        },
      );
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id: ID, placements, solved: ORDER.slice(0, ORDER.indexOf(ID)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
      'title',
    null,
    { timeout: 30_000 },
  );
});

test('two strikes are announced and the Capacitor reads out both, before and during Strike', async ({
  page,
}) => {
  await open(page, ROW);
  // Before Strike: the storm and the Strike button both say two strikes.
  await expect(page.locator('.lr-altar-storm .lr-storm-strikes')).toHaveText('2 strikes');
  await expect(page.locator('.lr-altar-storm .lr-strike-pips i')).toHaveCount(2);
  await expect(page.locator('.lr-altar-actions .lr-strike-pips i')).toHaveCount(2);
  await expect(page.locator('.lr-altar-need').first()).toContainText('in either strike');
  // The plan read-out at the ice: what it keeps, then what it lets out.
  const cap = page.locator('.lr-altar-cap');
  await expect(cap).toHaveCount(1);
  await expect(cap).toHaveAttribute('data-plan', '');
  // altar-truth: 16 is more than the 8 the machine takes, so the plan says so and warns, and
  // so does that gauge.
  await expect(cap.locator('.lr-cap-line')).toHaveText([
    'Strike 1: keeps 8',
    'Strike 2 sends 16; needs 8.',
  ]);
  await expect(cap.locator('.lr-cap-line[data-warn]')).toHaveCount(1);
  await expect(page.locator('.lr-altar-need[data-warn]')).toHaveCount(1);
  await expect(page.locator('.lr-altar-need[data-warn]')).toContainText('8');

  // During strike 1 only its line shows; strike 2's line arrives with strike 2. Strike 1 lasts
  // well under a second of game time, too short for one-after-another polls from the test on a
  // loaded machine, so the page records the storm label and the shown lines every frame.
  await page.evaluate(() => {
    const w = window as unknown as { __capSeen: string[] };
    w.__capSeen = [];
    const tick = () => {
      const label = document.querySelector('.lr-altar-storm .lr-storm-strikes')?.textContent;
      const lines = [...document.querySelectorAll('.lr-altar-cap .lr-cap-line:not([hidden])')]
        .map((l) => (l.textContent ?? '').replace(/\u00a0/g, ' '))
        .join(' / ');
      const text = `${label} | ${lines}`;
      if (w.__capSeen.at(-1) !== text) w.__capSeen.push(text);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('KeyF');

  const verdict = page.locator('.lr-altar-verdict');
  await expect(verdict).toBeVisible({ timeout: 15_000 });
  const seen = await page.evaluate(() => (window as unknown as { __capSeen: string[] }).__capSeen);
  expect(seen).toContain('Strike 1 of 2 | Strike 1: keeps 8');
  expect(seen.some((s) => s.startsWith('Strike 2 of 2 |'))).toBe(true);
  expect(seen.indexOf('Strike 1 of 2 | Strike 1: keeps 8')).toBeLessThan(
    seen.findIndex((s) => s.startsWith('Strike 2 of 2 |')),
  );
  await expect(verdict).toContainText('Got 16 on strike 2, needs 8: breaker tripped');
  await expect(verdict.locator('.lr-verdict-story')).toHaveText(
    'Strike 1: the Capacitor kept 8. Strike 2: the Capacitor let out 8 + 8 = 16.',
  );
  await expect(cap.locator('.lr-cap-line:not([hidden])')).toHaveCount(2);
});

test('a machine never shows "got N" beside strike chips that disagree, at any frame', async ({
  page,
}) => {
  await open(page, ROW);
  // Watch the need label every frame. Once "got" shows on a two-strike altar, the newest
  // strike chip must carry the same number (bug-bash: "got 4" sat beside only "Strike 1: 2").
  await page.evaluate(() => {
    const w = window as unknown as { __mismatch: string[]; __seen: string[] };
    w.__mismatch = [];
    w.__seen = [];
    const tick = () => {
      for (const el of document.querySelectorAll('.lr-altar-need')) {
        const got = el.querySelector('.lr-need-got b')?.textContent;
        if (got == null) continue;
        const chips = [...el.querySelectorAll('.lr-need-strikes span')].map((c) => c.textContent);
        const text = `got ${got} | ${chips.join(', ')}`;
        if (w.__seen.at(-1) !== text) w.__seen.push(text);
        if (!(chips.at(-1) ?? '').endsWith(`: ${got}`)) w.__mismatch.push(text);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('KeyF');
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 15_000 });
  const r = await page.evaluate(() => {
    const w = window as unknown as { __mismatch: string[]; __seen: string[] };
    return { mismatch: w.__mismatch, seen: w.__seen };
  });
  expect(r.seen.length).toBeGreaterThan(0);
  expect(r.mismatch).toEqual([]);
});
