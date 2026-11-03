import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { GEM_KINDS, MACHINE_IDS } from '../../games/last-rune/rules/types';
import { computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, trackProblems, waitFrames } from './helpers';

// bug-bash: what must fit on a 1280×720 screen at every text size (D-027: a first-time
// player never hunts for a hidden Done button or reads text under a tab row). Each check
// measures the DOM; the screenshots behind these are described in docs/workstreams/bug-bash.md.

interface GameHandle {
  flow: { state: string; continueGame(): void; openPuzzle(id: string): boolean };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
  settings: { set(p: { textScale: number }): void };
  fuse: { hush(): void };
}

const SCALES = [100, 125, 150] as const;

/** Dev build at 1280×720, with a seeded save and text scale, in the hall. */
async function boot(page: Page, scale: number, solved: readonly string[] = []) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, met }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.codex.met = met;
      });
      g.settings.set({ textScale: scale });
      g.flow.continueGame();
    },
    { scale, solved: [...solved], met: [...GEM_KINDS] },
  );
  await page.waitForTimeout(600);
}

for (const scale of SCALES) {
  test(`Settings fits 1280×720 at ${scale}% text, Done on screen without scrolling`, async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await boot(page, scale);
    await page.keyboard.press('KeyO');
    await expect(page.locator('.lr-settings')).toBeVisible();
    await waitFrames(page, 4);
    const m = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.tc-panel')!;
      const done = [...panel.querySelectorAll('button')].find((b) => b.textContent === 'Done')!;
      return {
        over: panel.scrollHeight - panel.clientHeight,
        doneBottom: done.getBoundingClientRect().bottom,
        vh: innerHeight,
      };
    });
    expect(m.over).toBeLessThanOrEqual(1);
    expect(m.doneBottom).toBeLessThanOrEqual(m.vh);
    expect(problems).toEqual([]);
  });

  test(`every Codex spread fits at ${scale}% text, folio clear of the tab row`, async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await boot(page, scale, ['intake-desk', 'furnace', 'splitter-mill']);
    await page.keyboard.press('KeyC');
    await expect(page.locator('.lr-codex')).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    for (let s = 0; s < Math.ceil(GEM_KINDS.length / 2); s++) {
      await waitFrames(page, 3);
      const pages = await page.evaluate(() => {
        const nav = document.querySelector('.lr-codex-nav')!.getBoundingClientRect();
        const host = document.querySelector<HTMLElement>('.lr-codex-host')!;
        return {
          hostOver: host.scrollHeight - host.clientHeight,
          pages: [...document.querySelectorAll<HTMLElement>('.lr-codex-page')].map((pg) => {
            const f = pg.querySelector('.lr-codex-folio')!.getBoundingClientRect();
            return {
              title: pg.querySelector('h3')?.textContent ?? '',
              over: pg.scrollHeight - pg.clientHeight,
              folioUnderNav: f.bottom > nav.top && f.right > nav.left && f.left < nav.right,
            };
          }),
        };
      });
      for (const p of pages.pages) {
        expect(p.over, `${p.title} scrolls`).toBeLessThanOrEqual(1);
        expect(p.folioUnderNav, `${p.title} folio under the tabs`).toBe(false);
      }
      await page.keyboard.press('ArrowRight');
    }
    expect(problems).toEqual([]);
  });
}

type Box = { left: number; right: number; top: number; bottom: number };
const hits = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const id of ['archive', 'intake-desk'] as const) {
  test(`${id} at 150%: fizzle tags never cover the verdict`, async ({ page }) => {
    const problems = trackProblems(page);
    await boot(
      page,
      150,
      MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
    );
    await page.evaluate((id) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.openPuzzle(id);
      g.fuse.hush();
    }, id);
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.waitForTimeout(400);
    // Strike an empty board and skip to the verdict: the bolt fizzles at the first socket.
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.lr-altar-tag').first()).toBeVisible();
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const box = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return {
        verdict: box(document.querySelector('.lr-altar-verdict')!),
        tags: [...document.querySelectorAll('.lr-altar-tag')].map(box),
      };
    });
    for (const t of r.tags) expect(hits(t, r.verdict)).toBe(false);
    expect(problems).toEqual([]);
  });
}

test('the-last-rune at 150%: the storm card stays off the board', async ({ page }) => {
  const problems = trackProblems(page);
  await boot(
    page,
    150,
    MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
  );
  await page.evaluate(() => {
    (window as unknown as { __game: GameHandle }).__game.flow.openPuzzle('the-last-rune');
  });
  await expect(page.locator('.lr-altar-storm')).toBeVisible();
  await waitFrames(page, 4);
  const L = computeLayout(puzzleFor('the-last-rune'));
  const m = await page.evaluate(() => {
    const o = document.querySelector('.tc-overlay')!.getBoundingClientRect();
    const s = document.querySelector('.lr-altar-storm')!.getBoundingClientRect();
    const k = o.width / 1920;
    return { left: (s.left - o.left) / k, right: (s.right - o.left) / k };
  });
  // The first column of sockets starts at left + margin (west storm) or ends at right − margin.
  if (L.storm.side === 3) expect(m.right).toBeLessThanOrEqual(L.left + L.margin);
  else if (L.storm.side === 1) expect(m.left).toBeGreaterThanOrEqual(L.right - L.margin);
  expect(problems).toEqual([]);
});
