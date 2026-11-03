import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational } from '../../games/last-rune/rules';
import { type Cell, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, readSave, trackProblems, waitFrames } from './helpers';

// Phones (D-039): every altar action works by finger alone, turning included (the ↻ Turn
// button), and each scene fits a landscape phone: no page scroll, text at least 14 CSS px,
// buttons at least 44 CSS px to the finger. The game runs with touch emulation; no mouse or
// key is used in the play tests.

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    closePuzzle(): void;
    openJournal(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
  openSettings(): void;
  codex: { open(): void };
  ui: { stack: { clear(): void } };
}

const PHONE = { width: 844, height: 390 };
test.use({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
test.setTimeout(120_000);

async function boot(page: Page, solved: readonly string[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ solved }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = {};
      });
    },
    { solved: [...solved] },
  );
}

/** Tap a design-space (1920×1080) point. */
async function tapAt(page: Page, x: number, y: number) {
  const r = (await page.locator('.tc-overlay').boundingBox())!;
  const s = r.width / 1920;
  await page.touchscreen.tap(r.x + x * s, r.y + y * s);
  await waitFrames(page, 4);
}

async function openAltar(page: Page, id: MachineId) {
  await page.evaluate((id) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    if (g.flow.state !== 'hall') g.flow.continueGame();
    g.flow.openPuzzle(id);
  }, id);
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 10);
}

/**
 * Build the intended solution by touch: tap the gem in the tray, tap its socket, then tap ↻
 * Turn until the placed gem faces the right way. Returns how many turns were tapped.
 */
async function buildByTouch(page: Page, id: MachineId): Promise<number> {
  const p = puzzleFor(id);
  const L = computeLayout(p);
  const turnBtn = page.locator('.lr-altar-turnbtn');
  let turns = 0;
  for (const g of p.design.intended) {
    const slot = L.tray.find((s) => s.gem === g.gem)!;
    await tapAt(page, slot.x, slot.y);
    const pt = { x: 0, y: 0 };
    cellCenter(L, g.cell as Cell, pt);
    await tapAt(page, pt.x, pt.y);
    if (isRotational(g.gem)) {
      await expect(turnBtn).toBeVisible();
      for (let i = 0; i < g.rot; i++) {
        await turnBtn.tap();
        await waitFrames(page, 3);
        turns++;
      }
    }
  }
  return turns;
}

async function expectSolved(page: Page, id: MachineId) {
  await expect
    .poll(async () => (await readSave(page))?.progress.solved ?? [], { timeout: 20_000 })
    .toContain(id);
}

test('intake desk by touch alone: tap gems onto sockets, tap Strike, tap Continue', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await boot(page, []);
  await openAltar(page, 'intake-desk');
  await expect(page.locator('.tc-overlay')).toHaveAttribute('data-touch', '');
  await expect(page.locator('.tc-overlay')).toHaveAttribute('data-phone', '');
  // Touch words, no key caps.
  await expect(page.locator('.lr-altar-hint')).toContainText('Tap');
  await expect(page.locator('.lr-altar-actions kbd').first()).toBeHidden();

  await buildByTouch(page, 'intake-desk');
  // Undo by touch takes the last gem off; tapping its socket again puts it back.
  const p = puzzleFor('intake-desk');
  await page.locator('[data-action="undo"]').tap();
  await expect
    .poll(async () => (await readSave(page))?.puzzles['intake-desk']?.placements.length)
    .toBe(p.design.intended.length - 1);
  const L = computeLayout(p);
  const last = p.design.intended.at(-1)!;
  const pt = { x: 0, y: 0 };
  cellCenter(L, last.cell, pt);
  await tapAt(page, L.tray[0]!.x, L.tray[0]!.y);
  await tapAt(page, pt.x, pt.y);

  await page.locator('[data-action="strike"]').tap();
  await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 20_000 });
  await page.locator('.lr-solve-continue').tap();
  await expectSolved(page, 'intake-desk');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.flow.state),
    )
    .toBe('hall');
  expect(problems).toEqual([]);
});

test('furnace by touch: four Bends turned with the ↻ Turn button, then Strike', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await boot(page, ['intake-desk']);
  await openAltar(page, 'furnace');
  const turns = await buildByTouch(page, 'furnace');
  expect(turns).toBeGreaterThan(0);
  const n = puzzleFor('furnace').design.intended.length;
  await expect.poll(async () => (await readSave(page))?.puzzles.furnace?.placements.length).toBe(n);
  const saved = (await readSave(page))!.puzzles.furnace!.placements as {
    gem: string;
    cell: Cell;
    rot: number;
  }[];
  for (const g of puzzleFor('furnace').design.intended) {
    const s = saved.find((q) => q.cell.x === g.cell.x && q.cell.y === g.cell.y);
    expect(s, `${g.gem} at ${g.cell.x},${g.cell.y}`).toMatchObject({ gem: g.gem, rot: g.rot });
  }
  await page.locator('[data-action="strike"]').tap();
  await expectSolved(page, 'furnace');
  expect(problems).toEqual([]);
});

test('a gem in hand turns by ↻ before it is placed; dragging a placed gem off removes it', async ({
  page,
}) => {
  await boot(page, ['intake-desk']);
  await openAltar(page, 'furnace');
  const p = puzzleFor('furnace');
  const L = computeLayout(p);
  const slot = L.tray.find((s) => s.gem === 'bend')!;
  await tapAt(page, slot.x, slot.y);
  await expect(page.locator('.lr-altar-turnmark')).toBeVisible();
  await page.locator('.lr-altar-turnbtn').tap();
  await page.locator('.lr-altar-turnbtn').tap();
  const cell = { x: 1, y: 3 };
  const pt = { x: 0, y: 0 };
  cellCenter(L, cell, pt);
  await tapAt(page, pt.x, pt.y);
  await expect
    .poll(async () => (await readSave(page))?.puzzles.furnace?.placements)
    .toEqual([{ gem: 'bend', cell, rot: 2 }]);

  // A tap on the bare floor puts the gem in hand back in the tray.
  await tapAt(page, 1700, 620);
  await expect(page.locator('.lr-altar-count[data-held]')).toHaveCount(0);
  // Drag it off the altar (CDP touch: down on the gem, move to the floor, up).
  const r = (await page.locator('.tc-overlay').boundingBox())!;
  const s = r.width / 1920;
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: r.x + x * s, y: r.y + y * s }],
    });
  await touch('touchStart', pt.x, pt.y);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', pt.x + (1700 - pt.x) * (i / 8), pt.y + (560 - pt.y) * (i / 8));
    await waitFrames(page, 1);
  }
  await touch('touchEnd', 0, 0);
  await expect.poll(async () => (await readSave(page))?.puzzles.furnace?.placements.length).toBe(0);
});

/** Text under 14 CSS px, and buttons whose finger target is under 44 CSS px, in view now. */
async function fitProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    if (document.documentElement.scrollHeight > innerHeight + 1) out.push('page scrolls');
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
    };
    for (const el of document.querySelectorAll<HTMLElement>('.tc-overlay *')) {
      if (!visible(el) || el.closest('.tc-sr-only,[aria-hidden="true"]')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      const fs = Number.parseFloat(getComputedStyle(el).fontSize);
      if (own && fs < 13.5)
        out.push(`text ${fs.toFixed(1)}px: ${el.textContent?.trim().slice(0, 30)}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>(
      '.tc-overlay button, .tc-overlay a[href]',
    )) {
      if (!visible(el) || el.closest('.lr-j-stack')) continue;
      // The finger target: the box, grown by the ::before hit area where there is one.
      const r = el.getBoundingClientRect();
      const b = getComputedStyle(el, '::before');
      const grow = (v: string) => Math.max(0, -Number.parseFloat(v) || 0);
      const scale = r.width / (el.offsetWidth || r.width);
      const w = r.width + (grow(b.left) + grow(b.right)) * scale;
      const h = r.height + (grow(b.top) + grow(b.bottom)) * scale;
      if (w < 43.5 || h < 43.5)
        out.push(
          `tap ${w.toFixed(0)}x${h.toFixed(0)}: ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}`,
        );
    }
    return out;
  });
}

for (const vp of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`fits a ${vp.width}×${vp.height} phone: hall, panels and every altar`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(
      page,
      MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
    );
    await page.evaluate(() =>
      (window as unknown as { __game: GameHandle }).__game.flow.continueGame(),
    );
    await page.waitForTimeout(800);
    const found: Record<string, string[]> = {};
    const check = async (name: string) => {
      await waitFrames(page, 6);
      const f = await fitProblems(page);
      if (f.length) found[name] = f;
    };
    // A first touch puts the game in touch mode (the hall ignores a tap on bare floor).
    await page.touchscreen.tap(vp.width / 2, vp.height - 4);
    await check('hall');
    await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.openSettings());
    await page.waitForTimeout(400);
    await check('settings');
    await page.evaluate(() => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.ui.stack.clear();
      g.codex.open();
    });
    await page.waitForTimeout(400);
    await check('codex');
    await page.evaluate(() =>
      (window as unknown as { __game: GameHandle }).__game.ui.stack.clear(),
    );
    for (const id of MACHINE_IDS) {
      await page.evaluate((id) => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        g.flow.openPuzzle(id);
      }, id);
      await expect(page.locator('.lr-altar')).toBeVisible();
      await check(id);
      await page.evaluate(() =>
        (window as unknown as { __game: GameHandle }).__game.flow.closePuzzle(),
      );
      await page.waitForTimeout(200);
    }
    expect(found).toEqual({});
  });
}

test('upright, the phone shows the turn-sideways card; turning it back hides it', async ({
  page,
}) => {
  await boot(page, []);
  const card = page.locator('.lr-rotate');
  await expect(card).toBeHidden();
  await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Turn your phone sideways');
  await page.setViewportSize(PHONE);
  await expect(card).toBeHidden();
});
