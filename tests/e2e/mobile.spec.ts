import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational } from '../../games/last-rune/rules';
import { type Cell, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { type AltarLayout, cellCenter } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, readSave, trackProblems, waitFrames } from './helpers';

// Phones (D-039): every altar action works by finger alone, turning included (the ↻ Turn
// button), and each scene fits a landscape phone: no page scroll, text at least 11 CSS px
// (body 12–13, mobile-2), buttons at least 44 CSS px to the finger. Phones get their own altar
// layout (board first, buttons in the side bars), so taps use the live one (`__altarLayout`). The game runs with touch emulation; no mouse or
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
  const r = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const s = r.width / 1920;
  await page.touchscreen.tap(r.x + x * s, r.y + y * s);
  await waitFrames(page, 4);
}

/** The altar layout in use (the phone layout on a phone). */
async function liveLayout(page: Page): Promise<AltarLayout> {
  return page.evaluate(() => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout);
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
  const L = await liveLayout(page);
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
  // Touch words, no key caps. (The data-touch and data-phone flags behind them are the engine's
  // device mode: packages/engine/e2e/ui.spec.ts.)
  await expect(page.locator('.lr-altar-hint')).toContainText('Tap');
  await expect(page.locator('[data-action="undo"] kbd')).toBeHidden();

  await buildByTouch(page, 'intake-desk');
  // Undo by touch takes the last gem off; tapping its socket again puts it back.
  const p = puzzleFor('intake-desk');
  await page.locator('[data-action="undo"]').tap();
  await expect
    .poll(async () => (await readSave(page))?.puzzles['intake-desk']?.placements.length)
    .toBe(p.design.intended.length - 1);
  const L = await liveLayout(page);
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
  const L = await liveLayout(page);
  const slot = L.tray.find((s) => s.gem === 'bend')!;
  await tapAt(page, slot.x, slot.y);
  await expect(page.locator('.lr-altar-turnbtn')).toBeVisible();
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
  // Drag it off the altar, through the engine's input feed (Input + linked Gestures, the
  // same calls the DOM listeners make): down on the gem, eight moves to the floor, up.
  const r = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const s = r.width / 1920;
  const touch = (phase: 'down' | 'move' | 'up', x: number, y: number) =>
    page.evaluate(
      ({ phase, x, y }) => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        const input = (window as any).__game.input;
        const g = input.getGestures();
        input.pointerAt(x, y, 'touch');
        if (phase === 'down') {
          input.buttonDown(0);
          g.pointerDown(1, x, y);
        } else if (phase === 'move') g.pointerMove(1, x, y);
        else {
          g.pointerUp(1, x, y);
          input.buttonUp(0);
        }
      },
      { phase, x: r.x + x * s, y: r.y + y * s },
    );
  await touch('down', pt.x, pt.y);
  await waitFrames(page, 1);
  for (let i = 1; i <= 8; i++) {
    await touch('move', pt.x + (1700 - pt.x) * (i / 8), pt.y + (560 - pt.y) * (i / 8));
    await waitFrames(page, 1);
  }
  await touch('up', 1700, 560);
  await expect.poll(async () => (await readSave(page))?.puzzles.furnace?.placements.length).toBe(0);
});

// The upright turn-sideways card is the engine's rotate card, verified on every phone in
// packages/engine/e2e/ui.spec.ts; the game only supplies its words (ui/phone-chrome.ts).

test('the Last Rune at 667×375: a finger drag from the tray shows the loupe and lands on the meant socket', async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await boot(
    page,
    MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
  );
  await openAltar(page, 'the-last-rune');
  const p = puzzleFor('the-last-rune');
  const L = await liveLayout(page);
  const box = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const k = box.width / 1920;
  // Sockets here are under 44 CSS px apart: the loupe's whole reason.
  expect(L.pitch * k).toBeLessThan(44);
  // A gem the design puts high enough on the board that the finger, 56 CSS px under the aim,
  // is still on the screen.
  const g = p.design.intended.find((q) => q.cell.y <= 3)!;
  const slot = L.tray.find((s) => s.gem === g.gem)!;
  const target = { x: 0, y: 0 };
  cellCenter(L, g.cell as Cell, target);
  const client = (x: number, y: number) => ({ x: box.x + x * k, y: box.y + y * k });
  const from = client(slot.x, slot.y);
  // The finger ends 56 CSS px below the socket, a third of a pitch off to the side.
  const aim = client(target.x + L.pitch * 0.3, target.y);
  const end = { x: aim.x, y: aim.y + 56 };
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  const loupe = page.locator('.lr-loupe');
  // The first move follows the press at once, as a real drag does: a finger held still for
  // longPressMs (450 ms, wall clock) is a long-press, and three frames of a loaded page can
  // take that long, so a wait here made the drag a long-press that never lifts the aim.
  await touch('touchStart', from.x, from.y);
  for (let i = 1; i <= 10; i++) {
    await touch(
      'touchMove',
      from.x + (end.x - from.x) * (i / 10),
      from.y + (end.y - from.y) * (i / 10),
    );
    await waitFrames(page, 1);
  }
  await waitFrames(page, 3);
  await expect(loupe).toHaveAttribute('data-on', '');
  await expect(loupe).toHaveCSS('opacity', '1');
  await expect(page.locator('.lr-altar')).toHaveAttribute('data-loupe', `${g.cell.x},${g.cell.y}`);
  // The loupe sits beside the finger, not under it, and stays on screen.
  const lb = (await loupe.boundingBox())!;
  expect(
    end.x >= lb.x && end.x <= lb.x + lb.width && end.y >= lb.y && end.y <= lb.y + lb.height,
  ).toBe(false);
  expect(lb.x).toBeGreaterThanOrEqual(0);
  expect(lb.y).toBeGreaterThanOrEqual(0);
  expect(lb.x + lb.width).toBeLessThanOrEqual(667);
  // It shows the board, not a dark disc (a WebGPU canvas copied at the wrong moment is blank).
  const lit = await loupe.evaluate((el) => {
    const cv = el.querySelector('canvas')!;
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! + d[i + 1]! + d[i + 2]! > 120) n++;
    return n / (d.length / 4);
  });
  expect(lit).toBeGreaterThan(0.05);
  await page.screenshot({
    path: 'docs/design/screens/local/mobile-ui/667x375/13-altar-the-last-rune-loupe.png',
  });
  await touch('touchEnd');
  await waitFrames(page, 3);
  await expect(loupe).not.toHaveAttribute('data-on', '');
  await expect(loupe).toHaveCSS('opacity', '0');
  await expect
    .poll(async () => (await readSave(page))?.puzzles['the-last-rune']?.placements ?? [])
    .toContainEqual({ gem: g.gem, cell: g.cell, rot: 0 });
});
