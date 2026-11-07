/**
 * Phone screenshots for the D-040 blind review (gate set): every scene, every altar as it opens
 * and mid-play with a gem in hand, teach cards, verdicts, the solve and the ending, on the four
 * realistic landscape phones, plus an upright set. Touch first, as a phone player plays. Off
 * unless SHOTS=<dir name> is set; images go to docs/design/screens/local/<dir>/<phone>/
 * (git-ignored) and docs/design/screens/local/<dir>/portrait/.
 *
 *   SHOTS=gate5 pnpm exec playwright test tests/e2e/shots.spec.ts
 *   SHOTS=gate5 SHOTS_ONLY=se,portrait ...   (a subset: phone names and/or part names:
 *                                             chrome, altars, moments, ending)
 *
 * Every altar is met the way a player meets it: everything before it in play order solved,
 * its own board fresh, so first-appearance teaching shows (D-040 addendum 3).
 */
import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { type Cell, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { trayRemaining } from '../../games/last-rune/rules/validate';
import { type AltarLayout, cellCenter } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from './altar-audit';
import { DEV_URL, settled, waitFrames } from './helpers';

const DIR = process.env.SHOTS ?? '';
const ONLY = (process.env.SHOTS_ONLY ?? '').split(',').filter(Boolean);
const PARTS = ['chrome', 'altars', 'moments', 'ending'] as const;
type Part = (typeof PARTS)[number];

/** `safari`: an iPhone, so no Fullscreen API (as Safari on iPhone): no Full screen button. */
const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0, safari: true },
  { name: 'iphone', width: 844, height: 340, inset: 47, safari: true },
  { name: 'promax', width: 932, height: 380, inset: 59, safari: true },
  { name: 'android', width: 915, height: 360, inset: 0, safari: false },
] as const;

/** Whether SHOTS_ONLY asks for this phone (or 'portrait') and this part. */
function wanted(phone: string, part?: Part) {
  const phones = ONLY.filter((o) => !PARTS.includes(o as Part));
  const parts = ONLY.filter((o) => PARTS.includes(o as Part));
  return (
    (phones.length === 0 || phones.includes(phone)) &&
    (!part || parts.length === 0 || parts.includes(part))
  );
}

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

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.skip(!DIR, 'SHOTS=<dir> to take screenshots');
test.setTimeout(900_000);

const CAPTION = '.tc-caption';

/** A shot taken once the layout has stopped moving, on the page's own frames. */
async function snap(page: Page, folder: string, name: string, sel = '#app *') {
  await settled(page, sel);
  await waitFrames(page, 6);
  const dir = `docs/design/screens/local/${DIR}/${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function boot(page: Page, inset: number, safari = false) {
  if (safari) {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    });
  }
  if (inset) {
    await page.addInitScript((px) => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.addEventListener('DOMContentLoaded', () => document.head.append(s));
    }, inset);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  // Touch mode: the first input a phone player gives is a finger.
  await page.evaluate(() =>
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    ),
  );
}

/** Seed the save (progress, one altar's board) and stand in the hall. */
async function seed(
  page: Page,
  solved: readonly string[],
  puzzles: Record<string, unknown> = {},
  journal?: { found: number[]; read: number[] },
) {
  await page.evaluate(
    ({ solved, puzzles, journal }) => {
      const g = (window as G).__game;
      g.ui.stack.clear();
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        // Past the first altar a player has struck, which retires the dot legend (teach-6).
        d.flags.dotTold = solved.length > 0;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = puzzles;
        // teach-8: each altar as a player meets it in play order (no cards taught out of order).
        d.codex.taught = {};
        if (journal) {
          d.journal.found = journal.found;
          d.journal.read = journal.read;
        }
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
    },
    { solved: [...solved], puzzles, journal },
  );
  await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
}

/** Open `id` as a player meets it: everything before it solved, `placements` on its board. */
async function meet(page: Page, id: MachineId, placements: unknown[] = []) {
  await seed(page, ORDER.slice(0, ORDER.indexOf(id)), {
    [id]: { placements, attempts: 0 },
  });
  await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForFunction(() => !!(window as G).__altarLayout);
  await waitFrames(page, 10);
}

/**
 * Turn the arrival card's pages with a finger until it closes. FUSE speaking takes the right
 * column and hides the card for a while without closing it, so he is hushed before each look.
 */
async function dismissCard(page: Page) {
  const read = () =>
    page.evaluate(() => {
      const t = document.querySelector<HTMLElement>('.lr-altar-tip');
      const b = t?.querySelector<HTMLElement>('.lr-info-next');
      const r = b?.getBoundingClientRect();
      const cs = b && getComputedStyle(b);
      const shown =
        !!r && r.width > 0 && cs?.visibility !== 'hidden' && Number(cs?.opacity ?? 0) > 0.05;
      return {
        open: !!t && !t.hidden && !b?.closest('[hidden]') && shown,
        label: t?.querySelector('.lr-info-next')?.textContent ?? '',
      };
    });
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => (window as G).__game.fuse.hush());
    await waitFrames(page, 4);
    await settled(page, '.lr-altar-tip, .lr-altar-tip *');
    const before = await read();
    if (!before.open || !before.label) return;
    await page
      .locator('.lr-altar-tip:not([hidden]) .lr-info-next')
      .tap({ timeout: 2000 })
      .catch(() => {});
  }
  throw new Error('the arrival card never closed');
}

/** Tap a tray gem that is still in stock; returns its kind. */
async function holdOne(page: Page, id: MachineId, placed: unknown[]) {
  const L = await page.evaluate(
    () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
  );
  const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
  const k = ob.width / 1920;
  const pz = puzzleFor(id);
  const slot = L.tray.find((s) => trayRemaining(pz, placed as never, s.gem) > 0);
  if (!slot) return null;
  await page.touchscreen.tap(ob.x + slot.x * k, ob.y + slot.y * k);
  await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, slot.gem);
  return slot.gem;
}

/**
 * polish-8: every half-board above holds a Channel, so Turn is always dim there. These hold a
 * gem that turns, where it first comes to the tray (Bend at the Furnace, Split at Press Unit 4),
 * once as picked up (Turn lit) and once after one Turn.
 */
const TURN_HELD: readonly { id: MachineId; gem: string }[] = [
  { id: 'furnace', gem: 'bend' },
  { id: 'press-unit-4', gem: 'split' },
];

/** Tap the tray's `gem` (it must still be in stock). */
async function holdKind(page: Page, id: MachineId, placed: unknown[], gem: string) {
  const L = await page.evaluate(
    () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
  );
  const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
  const k = ob.width / 1920;
  const slot = L.tray.find(
    (s) => s.gem === gem && trayRemaining(puzzleFor(id), placed as never, s.gem) > 0,
  );
  expect(slot, `${id}: no ${gem} in the tray`).toBeTruthy();
  await page.touchscreen.tap(ob.x + slot!.x * k, ob.y + slot!.y * k);
  await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, gem);
}

/** dense-board: the densest boards get an aim shot: a finger held over a socket, loupe up. */
const AIM: readonly MachineId[] = ['the-last-rune', 'lift-shaft'];

/**
 * Drag a gem from the tray toward a socket the design still wants and hold it there, the
 * finger 56 CSS px under the aim, until the loupe shows; returns the finger's release.
 */
async function aimOne(page: Page, id: MachineId, placed: readonly unknown[]) {
  const L = await page.evaluate(
    () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
  );
  const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
  const k = ob.width / 1920;
  const view = page.viewportSize()!;
  const pz = puzzleFor(id);
  const client = (x: number, y: number) => ({ x: ob.x + x * k, y: ob.y + y * k });
  const at = { x: 0, y: 0 };
  // The highest socket the design still wants, so the finger under it stays on the screen.
  const g = pz.design.intended
    .slice(placed.length)
    .filter((q) => trayRemaining(pz, placed as never, q.gem) > 0)
    .sort((a, b) => a.cell.y - b.cell.y)[0]!;
  const slot = L.tray.find((s) => s.gem === g.gem)!;
  cellCenter(L, g.cell as Cell, at);
  const from = client(slot.x, slot.y);
  const aim = client(at.x + L.pitch * 0.2, at.y);
  const end = { x: aim.x, y: Math.min(view.height - 4, aim.y + 56) };
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
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
  await expect(page.locator('.lr-loupe')).toHaveAttribute('data-on', '');
  return () => touch('touchEnd');
}

/** Tap Strike (and confirm empty sockets if asked); wait for the verdict. */
async function strike(page: Page) {
  await page.locator('[data-action="strike"]').tap();
  await waitFrames(page, 4);
  const sure = page.locator('.lr-confirm .lr-gold-button');
  if (await sure.isVisible()) await sure.tap();
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 30_000 });
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const shot = (page: Page, name: string, sel?: string) => snap(page, vp.name, name, sel);

    test(`chrome ${vp.name}`, async ({ page }) => {
      test.skip(!wanted(vp.name, 'chrome'), 'not in SHOTS_ONLY');
      await boot(page, vp.inset, vp.safari);
      await expect(page.locator('.lr-title-menu')).toBeVisible();
      // The first visit's knock: FUSE speaks (his line's lane must keep off the storm cell).
      await expect(page.locator(CAPTION)).toBeVisible({ timeout: 10_000 });
      await shot(page, '01-title');

      // A first visit: New game, FUSE's welcome and the Start here marker.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.flow.newGame();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Start here/);
      await expect(page.locator(CAPTION)).toBeVisible();
      await shot(page, '02-hall');

      // Mid-game, with an unread journal page (the New page badge on Menu).
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        g.flow.toTitle();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'title');
      await seed(
        page,
        ['intake-desk', 'furnace', 'splitter-mill'],
        {},
        {
          found: [1, 2, 3, 4],
          read: [1, 2, 3],
        },
      );
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Next/);
      await expect(page.locator('.lr-hud-menu-new')).toBeVisible();
      await shot(page, '02-hall-mid');

      // Settings, both tabs.
      await page.evaluate(() => (window as G).__game.openSettings());
      await expect(page.locator('.lr-settings-tab').first()).toBeVisible();
      await shot(page, '03-settings-sound');
      await page.locator('.lr-settings-tab').nth(1).tap();
      await expect(page.locator('.lr-settings-tab').nth(1)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await shot(page, '03-settings-graphics');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      await page.evaluate(() => (window as G).__game.codex.open());
      await expect(page.locator('.lr-codex')).toBeVisible();
      await shot(page, '04-codex');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await page.waitForFunction(() => (window as G).__game.flow.state === 'journal');
      await waitFrames(page, 30);
      await shot(page, '05-journal');
      await page.evaluate(() => (window as G).__game.flow.closeJournal());
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await page.evaluate(() => (window as G).__game.fuse.hush());

      // The Menu, open: in the hall and at an altar.
      await page.locator('.lr-hud-menu').tap();
      await expect(page.locator('.lr-hud-scrim')).toBeVisible();
      await shot(page, '06-menu');
      await page.locator('.lr-hud-menu').tap();
      await expect(page.locator('.lr-hud-scrim')).toBeHidden();
      await meet(page, 'furnace');
      await dismissCard(page);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await page.locator('.lr-hud-menu').tap();
      await expect(page.locator('.lr-hud-scrim')).toBeVisible();
      await shot(page, '06-menu-altar');
    });

    test(`altars ${vp.name}`, async ({ page }) => {
      test.skip(!wanted(vp.name, 'altars'), 'not in SHOTS_ONLY');
      await boot(page, vp.inset, vp.safari);
      for (const id of MACHINE_IDS) {
        // As it opens: its arrival card (if it brings anything new) and FUSE's line.
        await meet(page, id);
        await shot(page, `10-${id}`);
        // Mid-play: half the intended gems placed, the card put away, one gem in hand.
        const half = puzzleFor(id).design.intended.slice(
          0,
          Math.floor(puzzleFor(id).design.intended.length / 2),
        );
        await meet(page, id, half);
        await dismissCard(page);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        const held = await holdOne(page, id, half);
        expect(held, `${id}: no tray gem left to hold`).not.toBeNull();
        await shot(page, `12-${id}-held`);
        // dense-board-4: a slim column folds the held gem's card behind its Rule tab; open it.
        const ruleTab = page.locator('.lr-rule-tab');
        if (await ruleTab.isVisible()) {
          await ruleTab.tap();
          await expect(page.locator('.lr-altar-tip')).toBeVisible();
          await shot(page, `12-${id}-held-rule`);
        }
        const turn = TURN_HELD.find((t) => t.id === id);
        if (turn) {
          await meet(page, id, half);
          await dismissCard(page);
          await page.evaluate(() => (window as G).__game.fuse.hush());
          await holdKind(page, id, half, turn.gem);
          const turnBtn = page.locator('.lr-altar-turnbtn');
          await expect(turnBtn).toBeEnabled();
          await shot(page, `12-${id}-held-${turn.gem}`);
          await turnBtn.tap();
          // The held gem eases round; shoot it once it rests.
          await waitFrames(page, 40);
          await shot(page, `12-${id}-held-${turn.gem}-turned`);
        }
        if (AIM.includes(id)) {
          await meet(page, id, half);
          await dismissCard(page);
          await page.evaluate(() => (window as G).__game.fuse.hush());
          const lift = await aimOne(page, id, half);
          await shot(page, `12-${id}-aim`);
          await lift();
        }
      }
    });

    test(`moments ${vp.name}`, async ({ page }) => {
      test.skip(!wanted(vp.name, 'moments'), 'not in SHOTS_ONLY');
      await boot(page, vp.inset, vp.safari);

      // The very first altar on a fresh save, straight from New game: the first teach card,
      // FUSE's arrival line beside it.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.flow.newGame();
        g.fuse.hush();
        g.flow.openPuzzle('intake-desk');
      });
      await expect(page.locator('.lr-altar-tip:not([hidden])')).toBeVisible();
      // polish-8: the card's first page is 10-intake-desk already; these are what comes next.
      // Its next page (the gold ring) when it has more than one.
      const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
      if (await next.isVisible()) {
        await next.tap();
        await waitFrames(page, 4);
        await shot(page, '14-intake-desk-teach-2');
      }
      // The first gem set on the board: what the card and the board say back.
      {
        const first = puzzleFor('intake-desk').design.intended[0]!;
        await holdKind(page, 'intake-desk', [], first.gem);
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
        const k = ob.width / 1920;
        const pt = { x: 0, y: 0 };
        cellCenter(L, first.cell as Cell, pt);
        await page.touchscreen.tap(ob.x + pt.x * k, ob.y + pt.y * k);
        await page.waitForFunction(() => !(window as G).__altarView?.held);
        await shot(page, '14-intake-desk-first-gem');
      }

      // The gauge dot's legend (teach-5/6): the first time a dot lights, once per game. Keyed
      // on the legend itself, so it follows teach-6 when that changes when it shows.
      {
        await meet(page, 'intake-desk', puzzleFor('intake-desk').design.intended);
        await dismissCard(page);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        const legend = page.locator('.lr-altar-hint[data-legend]:not([data-wait])');
        await expect.soft(legend, 'the dot legend on a lit dot').toBeVisible({ timeout: 10_000 });
        if (await legend.isVisible()) await shot(page, '16-dot-legend');
      }

      // A new gem's card past its first page (its first page is 10-relay-tower).
      await meet(page, 'relay-tower');
      await expect(page.locator('.lr-altar-tip:not([hidden])')).toBeVisible();
      const relayNext = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
      if (await relayNext.isVisible()) {
        await relayNext.tap();
        await waitFrames(page, 4);
        if (await page.locator('.lr-altar-tip:not([hidden])').isVisible())
          await shot(page, '14-relay-tower-teach-2');
      }

      // The Capacitor's card at Capacitor Bay.
      await meet(page, 'capacitor-bay');
      await expect(page.locator('.lr-altar-tip:not([hidden])')).toBeVisible();
      await shot(page, '15-capacitor-teach');
      for (let i = 2; i < 6; i++) {
        const more = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
        if (!(await more.isVisible())) break;
        await more.tap();
        await waitFrames(page, 4);
        if (/capacitor/i.test((await page.locator('.lr-altar-tip').textContent()) ?? ''))
          await shot(page, `15-capacitor-teach-${i}`);
      }

      // A failed verdict: half of Relay Tower's route, struck.
      const relayHalf = puzzleFor('relay-tower').design.intended.slice(0, 2);
      await meet(page, 'relay-tower', relayHalf);
      await dismissCard(page);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await strike(page);
      await shot(page, '13-relay-tower-fail');

      // A multi-strike verdict: Capacitor Bay's first try (strike 1: 0 · strike 2: 16).
      await meet(page, 'capacitor-bay', BAY_FIRST_TRY);
      await dismissCard(page);
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await shot(page, '13-capacitor-bay-before');
      await strike(page);
      await expect(page.locator('.lr-altar-verdict')).toContainText('Strike 2: 16.');
      await shot(page, '13-capacitor-bay-multi');

      // A solve: the Furnace really solved, under its solve card.
      await meet(page, 'furnace', puzzleFor('furnace').design.intended);
      await page.evaluate(() => (window as G).__game.flow.completePuzzle('furnace'));
      await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 20_000 });
      await shot(page, '20-solve');
    });

    test(`ending ${vp.name}`, async ({ page }) => {
      test.skip(!wanted(vp.name, 'ending'), 'not in SHOTS_ONLY');
      await boot(page, vp.inset, vp.safari);
      // The first time through (no Skip): everything else solved, then the Last Rune.
      await seed(
        page,
        MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
      );
      await page.evaluate(() => {
        const g = (window as G).__game;
        // A believable run for the safety record (chrome-polish-4): the game counts both for
        // real (flow.ts), but a seeded save has played for a minute and tripped nothing.
        g.save.update((d: G) => {
          d.stats.playSeconds = 47 * 60;
          d.stats.breakersTripped = 4;
        });
        g.flow.openPuzzle('the-last-rune');
        g.flow.completePuzzle('the-last-rune');
        g.flow.finishSolve();
      });
      await expect(page.locator(CAPTION)).toBeVisible({ timeout: 60_000 });
      await shot(page, '30-ending', CAPTION);
      const hg = page.locator('.lr-hg');
      await expect(hg).toBeVisible({ timeout: 240_000 });
      await expect(hg.locator('.lr-hg-form')).toBeVisible({ timeout: 120_000 });
      await shot(page, '31-hangout', '.lr-hg-log:not([hidden]) > *');
      await expect(page.locator('.lr-end-card a.lr-end-join')).toBeVisible({ timeout: 480_000 });
      await expect(page.locator('.lr-end-card')).toHaveAttribute('data-in', '');
      await shot(page, '32-end-card', '.lr-end-card *');
    });
  });
}

test.describe('portrait', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  test('portrait: title, settings, rotate card', async ({ page }) => {
    test.skip(!wanted('portrait'), 'not in SHOTS_ONLY');
    const shot = (name: string) => snap(page, 'portrait', name);
    await boot(page, 0, true);
    await expect(page.locator('.lr-title-menu')).toBeVisible();
    await expect(page.locator(CAPTION)).toBeVisible({ timeout: 10_000 });
    await shot('01-title');
    await page.evaluate(() => (window as G).__game.openSettings());
    await expect(page.locator('.lr-settings-tab').first()).toBeVisible();
    await shot('03-settings');
    await seed(
      page,
      MACHINE_IDS.filter((m) => m !== 'the-last-rune'),
    );
    await expect(page.locator('.tc-rotate')).toBeVisible();
    await shot('40-rotate-hall');
    await page.evaluate(() => (window as G).__game.flow.openPuzzle('the-last-rune'));
    await expect(page.locator('.lr-altar')).toBeAttached();
    await expect(page.locator('.tc-rotate')).toBeVisible();
    await shot('41-rotate-altar');
  });
});

/**
 * Desktop (1280×720, mouse): the altars whose text and visuals altar-truth checked against the
 * rules. Only when SHOTS_ONLY names `desktop`, so the phone gate set is unchanged.
 *   SHOTS=altar-truth/after SHOTS_ONLY=desktop pnpm exec playwright test tests/e2e/shots.spec.ts
 */
test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('desktop: altars', async ({ page }) => {
    test.skip(!ONLY.includes('desktop'), 'SHOTS_ONLY=desktop');
    const shot = (name: string) => snap(page, 'desktop', name);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEV_URL);
    await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
      timeout: 30_000,
    });
    const quiet = async () => {
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await waitFrames(page, 4);
    };
    const ids: MachineId[] = [
      'intake-desk',
      'furnace',
      'storm-cell-2',
      'control-booth',
      'lift-shaft',
      'the-last-rune',
    ];
    for (const id of ids) {
      await meet(page, id);
      await quiet();
      await shot(`10-${id}`);
      const half = puzzleFor(id).design.intended.slice(
        0,
        Math.floor(puzzleFor(id).design.intended.length / 2),
      );
      await meet(page, id, half);
      await quiet();
      const L = await page.evaluate(
        () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
      );
      const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
      const k = ob.width / 1920;
      const slot = L.tray.find((s) => trayRemaining(puzzleFor(id), half as never, s.gem) > 0);
      if (slot) {
        await page.mouse.click(ob.x + slot.x * k, ob.y + slot.y * k);
        await page.mouse.move(ob.x + 960 * k, ob.y + 1000 * k);
      }
      await shot(`12-${id}-held`);
    }
    const tries = [
      ['relay-tower', '13-relay-tower-fail', puzzleFor('relay-tower').design.intended.slice(0, 2)],
      ['capacitor-bay', '13-capacitor-bay-multi', BAY_FIRST_TRY],
    ] as const;
    for (const [id, name, place] of tries) {
      await meet(page, id, [...place]);
      await quiet();
      if (id === 'capacitor-bay') await shot('13-capacitor-bay-before');
      await page.keyboard.press('f');
      await waitFrames(page, 4);
      const sure = page.locator('.lr-confirm .lr-gold-button');
      if (await sure.isVisible()) await sure.click();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 30_000 });
      await quiet();
      await shot(name);
    }
  });
});
