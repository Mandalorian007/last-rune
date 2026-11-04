import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { GEM_KINDS, MACHINE_IDS } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, strikeToVerdict, trackProblems, waitFrames } from './helpers';

// bug-bash: what must fit on a 1280×720 screen at every text size (D-027: a first-time
// player never hunts for a hidden Done button or reads text under a tab row). Each check
// measures the DOM; the screenshots behind these are described in docs/workstreams/bug-bash.md.

interface GameHandle {
  flow: { state: string; continueGame(): void; openPuzzle(id: string): boolean };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
  settings: { set(p: { textScale: number }): void };
  fuse: { hush(): void; say(line: string, opts?: { hold?: number }): Promise<void> };
}

const SCALES = [100, 125, 150] as const;

/** Dev build at 1280×720, with a seeded save and text scale, in the hall. */
async function boot(
  page: Page,
  scale: number,
  solved: readonly string[] = [],
  puzzles: Record<string, unknown> = {},
  width = 1280,
) {
  await page.setViewportSize({ width, height: Math.round((width * 9) / 16) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, met, puzzles }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.codex.met = met;
        Object.assign(d.puzzles, puzzles);
      });
      g.settings.set({ textScale: scale });
      g.flow.continueGame();
    },
    { scale, solved: [...solved], met: [...GEM_KINDS], puzzles },
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
    // Walks every spread, and each turn has to be drawn before it is measured. Alone that is
    // about 2 s; a renderer starved by a full parallel run draws a few frames a second, which
    // took it past 30 s with nothing wrong (it waits on frames, not on time).
    test.setTimeout(90_000);
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
    await strikeToVerdict(page);
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

// newcomer-2: Relay Tower with one arm built (the split's lower arm empty). The verdict box,
// headline and gold "Try:" line, must be whole (wrapped, never clipped) and no fizzle tag or
// idle hint may sit on it, on either screen size and at the biggest text.
const ONE_ARM = {
  'relay-tower': {
    attempts: 0,
    placements: [
      { gem: 'channel', cell: { x: 0, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 1, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 2, y: 1 }, rot: 0 },
      { gem: 'bend', cell: { x: 3, y: 0 }, rot: 1 },
      { gem: 'channel', cell: { x: 4, y: 0 }, rot: 0 },
      { gem: 'bend', cell: { x: 5, y: 0 }, rot: 2 },
    ],
  },
};
for (const width of [1280, 1920] as const) {
  for (const scale of [100, 150] as const) {
    test(`relay one-arm at ${width}px, ${scale}%: verdict and Try line whole, no tag on them`, async ({
      page,
    }) => {
      const problems = trackProblems(page);
      await boot(page, scale, ['intake-desk', 'furnace', 'splitter-mill'], ONE_ARM, width);
      await page.evaluate(() => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        g.flow.openPuzzle('relay-tower');
        g.fuse.hush();
      });
      await expect(page.locator('.lr-altar')).toBeVisible();
      await page.waitForTimeout(400);
      // Provoke the idle "Bend already here" hint (a Bend onto the Bend), then strike at once.
      const L = computeLayout(puzzleFor('relay-tower'));
      const o = await page.locator('.tc-overlay:not([data-units="css"])').boundingBox();
      const k = o!.width / 1920;
      const at = (x: number, y: number) => page.mouse.click(o!.x + x * k, o!.y + y * k);
      const slot = L.tray.find((t) => t.gem === 'bend')!;
      const c = { x: 0, y: 0 };
      cellCenter(L, { x: 3, y: 0 }, c);
      await at(slot.x, slot.y);
      await page.waitForTimeout(200);
      await at(c.x, c.y);
      await expect(page.locator('.lr-altar-tag', { hasText: 'already here' })).toBeVisible();
      await strikeToVerdict(page);
      const hint = page.locator('.lr-altar-verdict .lr-verdict-hint');
      await expect(hint).toBeVisible({ timeout: 10_000 });
      // The empty lower arm outranks the lonely Gate it causes.
      await expect(hint).toHaveText('Try: put a gem in the socket at the red mark.');
      await expect(page.locator('.lr-altar-tag').first()).toBeVisible();
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const box = (el: Element) => {
          const b = el.getBoundingClientRect();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        };
        const v = document.querySelector<HTMLElement>('.lr-altar-verdict')!;
        const h = v.querySelector<HTMLElement>('.lr-verdict-hint')!;
        return {
          verdict: box(v),
          hint: box(h),
          clipped: h.scrollWidth - h.clientWidth,
          vClipped: v.scrollWidth - v.clientWidth,
          tags: [...document.querySelectorAll('.lr-altar-tag')].map((t) => ({
            text: t.textContent ?? '',
            ...box(t),
          })),
          vw: innerWidth,
        };
      });
      expect(r.clipped).toBeLessThanOrEqual(0);
      expect(r.vClipped).toBeLessThanOrEqual(0);
      expect(r.hint.left).toBeGreaterThanOrEqual(r.verdict.left);
      expect(r.hint.right).toBeLessThanOrEqual(r.verdict.right);
      expect(r.hint.bottom).toBeLessThanOrEqual(r.verdict.bottom);
      expect(r.verdict.left).toBeGreaterThanOrEqual(0);
      expect(r.verdict.right).toBeLessThanOrEqual(r.vw);
      expect(r.tags.some((t) => t.text.includes('already here'))).toBe(false);
      for (const t of r.tags) expect(hits(t, r.verdict), `${t.text} on the verdict`).toBe(false);
      for (let i = 0; i < r.tags.length; i++)
        for (let j = i + 1; j < r.tags.length; j++)
          expect(hits(r.tags[i]!, r.tags[j]!), 'two tags overlap').toBe(false);
      expect(problems).toEqual([]);
    });
  }
}

// newcomer-3: Relay Tower with the top-row Bend at (3,0) turned the wrong way, so the root red
// mark sits on the top row, right under where the verdict hangs. The verdict (headline and Try
// line) must never cover that socket, and no tag may sit on the verdict, at 1280×720 or 1920.
const TOP_ROW_ROOT = {
  'relay-tower': {
    attempts: 0,
    placements: [
      { gem: 'channel', cell: { x: 0, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 1, y: 1 }, rot: 0 },
      { gem: 'channel', cell: { x: 2, y: 1 }, rot: 0 },
      { gem: 'bend', cell: { x: 3, y: 0 }, rot: 0 },
      { gem: 'channel', cell: { x: 4, y: 0 }, rot: 0 },
      { gem: 'bend', cell: { x: 5, y: 0 }, rot: 2 },
      { gem: 'bend', cell: { x: 3, y: 2 }, rot: 0 },
      { gem: 'channel', cell: { x: 4, y: 2 }, rot: 0 },
      { gem: 'bend', cell: { x: 5, y: 2 }, rot: 3 },
    ],
  },
};
for (const [width, scale] of [
  [1280, 150],
  [1280, 100],
  [1920, 150],
] as const) {
  test(`relay top-row root at ${width}px, ${scale}%: the verdict never hides the red mark`, async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await boot(page, scale, ['intake-desk', 'furnace', 'splitter-mill'], TOP_ROW_ROOT, width);
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.openPuzzle('relay-tower');
      g.fuse.hush();
    });
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.waitForTimeout(400);
    await strikeToVerdict(page);
    const hint = page.locator('.lr-altar-verdict .lr-verdict-hint');
    await expect(hint).toBeVisible({ timeout: 10_000 });
    await expect(hint).toHaveText('Try: turn the gem at the red mark (R or scroll).');
    await page.waitForTimeout(400);
    const L = computeLayout(puzzleFor('relay-tower'));
    const c = { x: 0, y: 0 };
    cellCenter(L, { x: 3, y: 0 }, c);
    const r = await page.evaluate(() => {
      const o = document
        .querySelector('.tc-overlay:not([data-units="css"])')!
        .getBoundingClientRect();
      const k = o.width / 1920;
      const box = (el: Element) => {
        const b = el.getBoundingClientRect();
        return {
          left: (b.left - o.left) / k,
          right: (b.right - o.left) / k,
          top: (b.top - o.top) / k,
          bottom: (b.bottom - o.top) / k,
        };
      };
      return {
        verdict: box(document.querySelector('.lr-altar-verdict')!),
        tags: [...document.querySelectorAll('.lr-altar-tag')].map((t) => ({
          text: t.textContent ?? '',
          ...box(t),
        })),
        tray: [...document.querySelectorAll('.lr-altar-count')].map(box),
      };
    });
    // The socket under the red mark, in design pixels.
    const rr = L.pitch * 0.4;
    const mark = { left: c.x - rr, right: c.x + rr, top: c.y - rr, bottom: c.y + rr };
    expect(hits(mark, r.verdict), 'the verdict covers the root red mark').toBe(false);
    expect(r.verdict.top).toBeGreaterThanOrEqual(0);
    expect(r.verdict.bottom).toBeLessThanOrEqual(1080);
    for (const t of r.tags) expect(hits(t, r.verdict), `${t.text} on the verdict`).toBe(false);
    for (const t of r.tray) expect(hits(t, r.verdict), 'the verdict on the tray').toBe(false);
    expect(problems).toEqual([]);
  });
}

// tidy-3: FUSE's caption, FUSE's body, the verdict and the red mark are all visible together.
// At 1280×720 and 150% text the verdict docks under the board; the caption used to flee to the
// bottom-left corner, over FUSE. A 20-word line is the tallest card he says.
const LONG_LINE =
  'Set a Bend facing a wall. The bolt went in and simply stopped there. Turn it toward the rest.';
/** FUSE's sprite on the altar (placed at x 300, feet at y 1046), in design px. */
const FUSE_BODY = { left: 205, right: 395, top: 815, bottom: 1046 };
for (const [width, scale] of [
  [1280, 100],
  [1280, 125],
  [1280, 150],
  [1920, 100],
  [1920, 150],
] as const) {
  test(`relay at ${width}px, ${scale}%: FUSE's caption keeps off FUSE, the verdict and the red mark`, async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await boot(page, scale, ['intake-desk', 'furnace', 'splitter-mill'], TOP_ROW_ROOT, width);
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.flow.openPuzzle('relay-tower');
      g.fuse.hush();
    });
    await expect(page.locator('.lr-altar')).toBeVisible();
    await page.waitForTimeout(400);
    const L = computeLayout(puzzleFor('relay-tower'));
    const c = { x: 0, y: 0 };
    cellCenter(L, { x: 3, y: 0 }, c);
    const rr = L.pitch * 0.4;
    const mark = { left: c.x - rr, right: c.x + rr, top: c.y - rr, bottom: c.y + rr };
    const measure = async () => {
      await page.evaluate((line) => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        g.fuse.hush();
        void g.fuse.say(line, { hold: 0 });
      }, LONG_LINE);
      await expect(
        page.locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]'),
      ).toBeVisible();
      await waitFrames(page, 2);
      return page.evaluate(() => {
        const o = document
          .querySelector('.tc-overlay:not([data-units="css"])')!
          .getBoundingClientRect();
        const k = o.width / 1920;
        const box = (el: Element | null) => {
          if (!el || (el as HTMLElement).hidden) return null;
          const b = el.getBoundingClientRect();
          return {
            left: (b.left - o.left) / k,
            right: (b.right - o.left) / k,
            top: (b.top - o.top) / k,
            bottom: (b.bottom - o.top) / k,
          };
        };
        return {
          caption: box(
            document.querySelector(
              '.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]',
            ),
          )!,
          verdict: box(document.querySelector('.lr-altar-verdict')),
          tray: [...document.querySelectorAll('.lr-altar-count')].map((e) => box(e)!),
        };
      });
    };
    // Before the strike: no verdict.
    const before = await measure();
    expect(hits(before.caption, FUSE_BODY), 'the caption covers FUSE').toBe(false);
    expect(hits(before.caption, mark), 'the caption covers the red-mark socket').toBe(false);
    // After the strike: the fail verdict (docked under the board at 1280×720, 150%).
    await strikeToVerdict(page);
    await expect(page.locator('.lr-altar-verdict .lr-verdict-hint')).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(400);
    const after = await measure();
    expect(after.verdict).not.toBeNull();
    expect(hits(after.caption, FUSE_BODY), 'the caption covers FUSE').toBe(false);
    expect(hits(after.caption, after.verdict!), 'the caption covers the verdict').toBe(false);
    expect(hits(after.caption, mark), 'the caption covers the red-mark socket').toBe(false);
    expect(hits(after.verdict!, mark), 'the verdict covers the red-mark socket').toBe(false);
    expect(hits(after.verdict!, FUSE_BODY), 'the verdict covers FUSE').toBe(false);
    for (const t of after.tray) {
      expect(hits(t, after.caption), 'the caption on the tray').toBe(false);
      expect(hits(t, after.verdict!), 'the verdict on the tray').toBe(false);
    }
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
    const o = document
      .querySelector('.tc-overlay:not([data-units="css"])')!
      .getBoundingClientRect();
    const s = document.querySelector('.lr-altar-storm')!.getBoundingClientRect();
    const k = o.width / 1920;
    return { left: (s.left - o.left) / k, right: (s.right - o.left) / k };
  });
  // The first column of sockets starts at left + margin (west storm) or ends at right − margin.
  if (L.storm.side === 3) expect(m.right).toBeLessThanOrEqual(L.left + L.margin);
  else if (L.storm.side === 1) expect(m.left).toBeGreaterThanOrEqual(L.right - L.margin);
  expect(problems).toEqual([]);
});
