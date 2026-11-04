import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import {
  type AltarLayout,
  cellAt,
  cellCenter,
  LOUPE_BELOW,
  orbExtent,
} from '../../games/last-rune/scenes/altar/layout';
import { LOCK_PIP, SOCKET_RADIUS } from '../../games/last-rune/shaders/stone-wgsl';
import { DEV_URL, readSave, waitFrames } from './helpers';

// dense-board (D-040 addendum 8): on a phone the densest boards take the room. The Last Rune's
// sockets are at least a set pitch apart on each realistic phone; every socket's hit area is its
// whole cell; no lock pip or source orb reaches into a neighbouring cell; and the touch loupe
// shows on every dense board. No two Gives/Needs cards overlap (dense-board-2). dense-board-3:
// every gauge on a board is one size, every orb (rings and foot) and gauge is on the screen,
// every card lies within its own height of its gauge, and the loupe never covers the aimed
// socket or its eight neighbours (polish-9: nor a Gives/Needs card or the open hint card).

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0, rune: 32 },
  { name: 'iphone', width: 844, height: 340, inset: 47, rune: 35 },
  { name: 'promax', width: 932, height: 380, inset: 59, rune: 40 },
  { name: 'android', width: 915, height: 360, inset: 0, rune: 38 },
] as const;

/** The dense boards, and Splitter Mill (its orb once covered a socket). */
const DENSE: readonly MachineId[] = [
  'the-last-rune',
  'lift-shaft',
  'capacitor-bay',
  'archive',
  'control-booth',
  'roof-array',
  'splitter-mill',
];
/** Boards the loupe must cover on every phone. */
const LOUPE: readonly MachineId[] = ['the-last-rune', 'lift-shaft'];
/**
 * dense-board-4: each dense board's pitch floor (CSS px) per phone: no board smaller than it
 * stood before the slim column, and on the SE the Archive gains the room the slim
 * column frees (it goes slim: four gem kinds or fewer; nothing else may shrink).
 */
const FLOOR: Record<string, Partial<Record<MachineId, number>>> = {
  se: {
    archive: 40,
    'control-booth': 39.5,
    'lift-shaft': 35.5,
    'capacitor-bay': 38,
    'roof-array': 46,
  },
  iphone: { archive: 46.5, 'control-booth': 47.5, 'lift-shaft': 38, 'capacitor-bay': 41 },
  promax: { archive: 51.5, 'control-booth': 51, 'lift-shaft': 43.5, 'capacitor-bay': 46.5 },
  android: { archive: 48.5, 'control-booth': 48.5, 'lift-shaft': 40.5, 'capacitor-bay': 44 },
};

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(300_000);

async function boot(page: Page, inset: number) {
  if (inset)
    await page.addInitScript((px) => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.addEventListener('DOMContentLoaded', () => document.head.append(s));
    }, inset);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(() =>
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    ),
  );
}

async function open(page: Page, id: MachineId): Promise<{ L: AltarLayout; cssPx: number }> {
  await page.evaluate(
    ({ solved, id }) => {
      const g = (window as G).__game;
      g.ui.stack.clear();
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = {};
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { solved: MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id)) as string[], id },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForFunction(() => !!(window as G).__altarLayout);
  await waitFrames(page, 3);
  const L = await page.evaluate(
    () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
  );
  return { L, cssPx: L.phone!.cssPx };
}

/** Client px of a design-px point, through the scaled overlay. */
async function toClient(page: Page) {
  const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const k = ob.width / 1920;
  return (x: number, y: number) => ({ x: ob.x + x * k, y: ob.y + y * k });
}

/** The gap between two boxes (0 when they touch or overlap). */
function gap(a: Box, b: Box) {
  return Math.hypot(Math.max(0, a.l - b.r, b.l - a.r), Math.max(0, a.t - b.b, b.t - a.b));
}
type Box = { l: number; t: number; r: number; b: number };

/** Each gauge as drawn (design px): the orb's rings and foot, a cabinet's body and cap. */
function gaugeBoxes(L: AltarLayout, strength: number): Box[] {
  const s = L.storm;
  const oe = orbExtent(s.size, strength);
  const gy = s.y - 0.048 * s.size;
  return [
    { l: s.x - oe.ring, t: gy - oe.ring, r: s.x + oe.ring, b: gy + oe.foot },
    ...L.machines.map((m) => ({
      l: m.x - 0.45 * m.size,
      t: m.y - 0.47 * m.size,
      r: m.x + 0.45 * m.size,
      b: m.y + 0.36 * m.size,
    })),
  ];
}

/** Whether a disc reaches into the square of cell (x, y), by more than half a design px. */
function discInCell(L: AltarLayout, x: number, y: number, cx: number, cy: number, r: number) {
  const c = { x: 0, y: 0 };
  cellCenter(L, { x, y }, c);
  const h = L.pitch / 2;
  const dx = Math.max(0, Math.abs(cx - c.x) - h);
  const dy = Math.max(0, Math.abs(cy - c.y) - h);
  return Math.hypot(dx, dy) < r - 0.5;
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });

    test(`dense boards ${vp.name}: pitch, hit areas, pips, orb, loupe`, async ({ page }) => {
      await boot(page, vp.inset);
      for (const id of DENSE) {
        const { L, cssPx } = await open(page, id);
        const pitch = L.pitch / cssPx;
        if (id === 'the-last-rune') {
          expect(pitch, `${vp.name} the-last-rune pitch (CSS px)`).toBeGreaterThanOrEqual(vp.rune);
        }
        if (LOUPE.includes(id)) {
          expect(pitch, `${vp.name} ${id}: the loupe shows`).toBeLessThan(LOUPE_BELOW);
        }
        const floor = FLOOR[vp.name]?.[id];
        if (floor)
          expect(pitch, `${vp.name} ${id} pitch floor (CSS px)`).toBeGreaterThanOrEqual(floor);
        // dense-board-4: a dense board's ×N badges and Gives/Needs cards meet the 14 px floor.
        if (L.phone?.dense) {
          // Rendered size (CSS px): the computed size times its overlay's scale.
          const small = await page.evaluate(() => {
            const ov = document.querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!;
            const k = ov.getBoundingClientRect().width / (ov.offsetWidth || 1);
            return [
              ...document.querySelectorAll<HTMLElement>(
                '.lr-altar-count, .lr-altar-count *, .lr-altar-need, .lr-altar-need *',
              ),
            ]
              .filter(
                (e) =>
                  e.getClientRects().length > 0 &&
                  [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()),
              )
              .map((e) => ({
                text: e.textContent?.trim().slice(0, 20),
                px:
                  Number.parseFloat(getComputedStyle(e).fontSize) *
                  (e.closest('.tc-overlay[data-units="css"]') ? 1 : k),
              }))
              .filter((q) => q.px < 13.95);
          });
          expect(small, `${vp.name} ${id}: text under 14px`).toEqual([]);
        }
        // Each socket's hit area is its whole cell: a point just inside any corner is that cell.
        const blocked = new Set(puzzleFor(id).blocked.map((b) => `${b.x},${b.y}`));
        const c = { x: 0, y: 0 };
        const e = L.pitch * 0.49;
        for (let y = 0; y < L.rows; y++) {
          for (let x = 0; x < L.cols; x++) {
            if (blocked.has(`${x},${y}`)) continue;
            cellCenter(L, { x, y }, c);
            for (const [sx, sy] of [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ] as const) {
              expect(cellAt(L, c.x + sx * e, c.y + sy * e), `${id} ${x},${y} corner`).toEqual({
                x,
                y,
              });
            }
          }
        }
        // A fixed gem's lock pip stays inside its own cell.
        const pipReach = Math.round(L.pitch * SOCKET_RADIUS) * (LOCK_PIP.at + LOCK_PIP.r);
        expect(pipReach, `${id}: lock pip reach`).toBeLessThanOrEqual(L.pitch / 2);
        // The source orb (glass, halo and shell: 0.33 of its size) covers no cell of the board.
        const s = L.storm;
        const oy = s.y - 0.048 * s.size;
        const over: string[] = [];
        for (let y = 0; y < L.rows; y++) {
          for (let x = 0; x < L.cols; x++) {
            if (discInCell(L, x, y, s.x, oy, 0.33 * s.size)) over.push(`${x},${y}`);
          }
        }
        expect(over, `${vp.name} ${id}: cells under the orb`).toEqual([]);
        // dense-board-2: no two Gives/Needs cards overlap (two north cards once sank into the
        // same carved stone).
        const clash = await page.evaluate(() => {
          const r = [...document.querySelectorAll('.lr-altar-need')].map((el) => ({
            t: el.textContent?.trim() ?? '',
            b: el.getBoundingClientRect(),
          }));
          const out: string[] = [];
          for (let i = 0; i < r.length; i++)
            for (let j = i + 1; j < r.length; j++) {
              const a = r[i]!.b;
              const c = r[j]!.b;
              if (a.width && c.width && a.left < c.right && c.left < a.right)
                if (a.top < c.bottom && c.top < a.bottom) out.push(`${r[i]!.t} / ${r[j]!.t}`);
            }
          return out;
        });
        expect(clash, `${vp.name} ${id}: cards that overlap`).toEqual([]);
        // dense-board-3: one gauge size on the board; every orb and gauge on the screen.
        expect(
          new Set(L.machines.map((m) => m.size)).size,
          `${vp.name} ${id}: gauge sizes`,
        ).toBeLessThanOrEqual(1);
        const at = await toClient(page);
        const app = (await page.locator('#app').boundingBox())!;
        const view = page.viewportSize()!;
        const boxes = gaugeBoxes(L, puzzleFor(id).storm.strength).map((g) => {
          const a = at(g.l, g.t);
          const b = at(g.r, g.b);
          return { l: a.x, t: a.y, r: b.x, b: b.y };
        });
        boxes.forEach((g, i) => {
          const name = `${vp.name} ${id}: ${i ? `gauge ${i}` : 'orb'} on screen`;
          expect(g.l, name).toBeGreaterThanOrEqual(Math.max(0, app.x) - 0.5);
          expect(g.r, name).toBeLessThanOrEqual(Math.min(view.width, app.x + app.width) + 0.5);
          expect(g.t, name).toBeGreaterThanOrEqual(-0.5);
          expect(g.b, name).toBeLessThanOrEqual(view.height + 0.5);
        });
        // Every card within its own height of a gauge, and no two cards on one gauge.
        const cards = await page.evaluate(() =>
          [...document.querySelectorAll('.lr-altar-need')]
            .map((el) => ({ t: el.textContent?.trim() ?? '', r: el.getBoundingClientRect() }))
            .filter((c) => c.r.width > 0)
            .map((c) => ({
              t: c.t,
              b: { l: c.r.left, t: c.r.top, r: c.r.right, b: c.r.bottom },
            })),
        );
        const owner = new Set<number>();
        for (const c of cards) {
          const d = boxes.map((g) => gap(c.b, g));
          const i = d.indexOf(Math.min(...d));
          expect(d[i]!, `${vp.name} ${id}: "${c.t}" to its gauge`).toBeLessThanOrEqual(
            c.b.b - c.b.t,
          );
          owner.add(i);
        }
        expect(owner.size, `${vp.name} ${id}: one card per gauge`).toBe(cards.length);
      }
    });

    test(`dense boards ${vp.name}: the loupe never covers the aimed socket or its neighbours`, async ({
      page,
    }) => {
      await boot(page, vp.inset);
      for (const id of LOUPE) {
        const { L } = await open(page, id);
        await page.evaluate(() => (window as G).__game.fuse.hush());
        const pz = puzzleFor(id);
        const at = await toClient(page);
        const view = page.viewportSize()!;
        const taken = new Set([
          ...pz.blocked.map((b) => `${b.x},${b.y}`),
          ...pz.fixed.map((f) => `${f.cell.x},${f.cell.y}`),
        ]);
        // Sockets at the board's four extremes (and its middle) whose finger, 56 CSS px under
        // the aim, is still on the screen.
        const free: { x: number; y: number }[] = [];
        const c = { x: 0, y: 0 };
        for (let y = 0; y < L.rows; y++)
          for (let x = 0; x < L.cols; x++) {
            if (taken.has(`${x},${y}`)) continue;
            cellCenter(L, { x, y }, c);
            if (at(c.x, c.y).y + 56 <= view.height - 4) free.push({ x, y });
          }
        const by = (f: (q: { x: number; y: number }) => number) =>
          [...free].sort((a, b) => f(a) - f(b))[0]!;
        const mx = (L.cols - 1) / 2;
        const my = (L.rows - 1) / 2;
        const picks = [
          by((q) => q.x),
          by((q) => -q.x),
          by((q) => q.y),
          by((q) => -q.y),
          by((q) => Math.hypot(q.x - mx, q.y - my)),
        ];
        const gem = Object.entries(pz.tray).find(([, n]) => (n ?? 0) > 0)![0];
        const slot = L.tray.find((t) => t.gem === gem)!;
        const from = at(slot.x, slot.y);
        const cdp = await page.context().newCDPSession(page);
        const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
          cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
          });
        const loupe = page.locator('.lr-loupe');
        for (const q of new Map(picks.map((p) => [`${p.x},${p.y}`, p])).values()) {
          cellCenter(L, q, c);
          const aim = at(c.x, c.y);
          const end = { x: aim.x, y: aim.y + 56 };
          await touch('touchStart', from.x, from.y);
          for (let i = 1; i <= 8; i++) {
            await touch(
              'touchMove',
              from.x + (end.x - from.x) * (i / 8),
              from.y + (end.y - from.y) * (i / 8),
            );
            await waitFrames(page, 1);
          }
          await waitFrames(page, 3);
          await expect(loupe).toHaveAttribute('data-on', '');
          const cell = await page.locator('.lr-altar').getAttribute('data-loupe');
          const [ax, ay] = (cell ?? '').split(',').map(Number);
          const lb = (await loupe.boundingBox())!;
          // polish-9: the Gives/Needs cards and the open hint or teach card, as they stand
          // while the loupe shows.
          const cards = await page.evaluate(() =>
            [
              ...document.querySelectorAll<HTMLElement>(
                '.lr-altar-need, .lr-altar-hint, .lr-altar-tip',
              ),
            ]
              .filter((e) => !e.hidden && e.getBoundingClientRect().width > 0)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return { cls: e.className, l: r.left, t: r.top, r: r.right, b: r.bottom };
              }),
          );
          await touch('touchEnd');
          await waitFrames(page, 3);
          // Start the next aim from the bare board.
          await open(page, id);
          await page.evaluate(() => (window as G).__game.fuse.hush());
          expect(cell, `${vp.name} ${id} ${q.x},${q.y}: aimed`).toBeTruthy();
          cellCenter(L, { x: ax!, y: ay! }, c);
          const n = 1.5 * L.pitch;
          const a = at(c.x - n, c.y - n);
          const b = at(c.x + n, c.y + n);
          const r = lb.width / 2;
          const o = { x: lb.x + r, y: lb.y + r };
          const d = Math.hypot(
            Math.max(0, a.x - o.x, o.x - b.x),
            Math.max(0, a.y - o.y, o.y - b.y),
          );
          expect(d, `${vp.name} ${id} ${cell}: loupe clear of the 3×3`).toBeGreaterThanOrEqual(r);
          // polish-9: nor any Gives/Needs card or the open hint card.
          for (const k of cards) {
            const dk = Math.hypot(
              Math.max(0, k.l - o.x, o.x - k.r),
              Math.max(0, k.t - o.y, o.y - k.b),
            );
            expect(dk, `${vp.name} ${id} ${cell}: loupe clear of ${k.cls}`).toBeGreaterThanOrEqual(
              r - 0.5,
            );
          }
          expect(lb.x, `${vp.name} ${id}: loupe on screen`).toBeGreaterThanOrEqual(0);
          expect(lb.y).toBeGreaterThanOrEqual(0);
          expect(lb.x + lb.width).toBeLessThanOrEqual(view.width);
          expect(lb.y + lb.height).toBeLessThanOrEqual(view.height);
        }
      }
    });

    test(`the Last Rune ${vp.name}: a tap near a socket's corner lands in it`, async ({ page }) => {
      await boot(page, vp.inset);
      const { L } = await open(page, 'the-last-rune');
      const p = puzzleFor('the-last-rune');
      // A socket the design wants with its lower-right neighbour open too.
      const taken = new Set([
        ...p.blocked.map((b) => `${b.x},${b.y}`),
        ...p.fixed.map((f) => `${f.cell.x},${f.cell.y}`),
      ]);
      const g = p.design.intended.find(
        (q) =>
          !taken.has(`${q.cell.x},${q.cell.y}`) &&
          q.cell.x + 1 < L.cols &&
          q.cell.y + 1 < L.rows &&
          !taken.has(`${q.cell.x + 1},${q.cell.y + 1}`),
      )!;
      expect(g, 'a socket with an open lower-right neighbour').toBeTruthy();
      const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
      const k = ob.width / 1920;
      // Dismiss whatever card is up so taps reach the board, then pick the gem up.
      await page.evaluate(() => (window as G).__game.fuse.hush());
      const slot = L.tray.find((t) => t.gem === g.gem)!;
      await page.touchscreen.tap(ob.x + slot.x * k, ob.y + slot.y * k);
      await page.waitForFunction((gem) => (window as G).__altarView?.held?.kind === gem, g.gem);
      const c = { x: 0, y: 0 };
      cellCenter(L, g.cell, c);
      const e = L.pitch * 0.44;
      await page.touchscreen.tap(ob.x + (c.x + e) * k, ob.y + (c.y + e) * k);
      await expect
        .poll(async () =>
          (
            ((await readSave(page))?.puzzles['the-last-rune']?.placements ?? []) as {
              cell: { x: number; y: number };
            }[]
          ).map((q) => `${q.cell.x},${q.cell.y}`),
        )
        .toContain(`${g.cell.x},${g.cell.y}`);
    });
  });
}

// dense-board-4: on the SE the Archive goes slim. The tray is a strip, the hint card is behind a
// "Rule" tab while a gem is held; the tab opens the card and the next tap (or placing) closes it.
// A first-sight teaching card is never hidden behind the tab.
test.describe('slim column', () => {
  test.use({
    viewport: { width: 667, height: 320 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });

  test('the Rule tab opens and closes the held gem’s card; teaching wins', async ({ page }) => {
    await boot(page, 0);
    const { L } = await open(page, 'archive');
    expect(L.phone?.slim, 'Archive on the SE is slim').toBe(true);
    const at = await toClient(page);
    const tab = page.locator('.lr-rule-tab');
    // A first-sight teaching card is up: the tab stays away while it shows.
    const teach = await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>('.lr-altar-tip');
      return !!t && !t.hidden && t.dataset.source === 'intro';
    });
    if (teach) await expect(tab).toBeHidden();
    await page.evaluate(() => (window as G).__game.fuse.hush());
    await waitFrames(page, 3);
    await expect(tab).toBeHidden();
    const slot = L.tray[0]!;
    const s = at(slot.x, slot.y);
    await page.touchscreen.tap(s.x, s.y);
    await page.waitForFunction(() => !!(window as G).__altarView?.held);
    await expect(tab).toBeVisible();
    const tb = (await tab.boundingBox())!;
    expect(tb.height, 'the tab is a 44 px target').toBeGreaterThanOrEqual(43.5);
    await tab.tap();
    await expect(tab).toBeHidden();
    await expect(page.locator('.lr-altar-tip')).toBeVisible();
    // The next tap anywhere closes the card; the gem stays held.
    const blocked = new Set(puzzleFor('archive').blocked.map((b) => `${b.x},${b.y}`));
    const fixed = new Set(puzzleFor('archive').fixed.map((f) => `${f.cell.x},${f.cell.y}`));
    const c = { x: 0, y: 0 };
    // A tap on the card itself closes it (in the column, it sets the gem back); nothing is
    // placed. Pick the gem up again: the tab is back, the card folded.
    const card = (await page.locator('.lr-altar-tip').boundingBox())!;
    await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
    await expect(page.locator('.lr-altar-tip')).toBeHidden();
    expect(((await readSave(page))?.puzzles.archive?.placements ?? []).length).toBe(0);
    if (!(await page.evaluate(() => !!(window as G).__altarView?.held))) {
      await page.touchscreen.tap(s.x, s.y);
      await page.waitForFunction(() => !!(window as G).__altarView?.held);
    }
    await expect(tab).toBeVisible();
    await expect(page.locator('.lr-altar-tip')).toBeHidden();
    // Open it again, then tap a socket: the tap closes the card and places the gem.
    await tab.tap();
    await expect(page.locator('.lr-altar-tip')).toBeVisible();
    let free = { x: 0, y: 0 };
    for (let y = 0; y < L.rows; y++)
      for (let x = 0; x < L.cols; x++)
        if (!blocked.has(`${x},${y}`) && !fixed.has(`${x},${y}`)) free = { x, y };
    cellCenter(L, free, c);
    const f = at(c.x, c.y);
    await page.touchscreen.tap(f.x, f.y);
    await expect
      .poll(async () => ((await readSave(page))?.puzzles.archive?.placements ?? []).length)
      .toBeGreaterThan(0);
    await expect(page.locator('.lr-altar-tip')).toBeHidden();
  });
});
