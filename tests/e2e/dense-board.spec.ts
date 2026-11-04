import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import {
  type AltarLayout,
  cellAt,
  cellCenter,
  LOUPE_BELOW,
} from '../../games/last-rune/scenes/altar/layout';
import { LOCK_PIP, SOCKET_RADIUS } from '../../games/last-rune/shaders/stone-wgsl';
import { DEV_URL, readSave, waitFrames } from './helpers';

// dense-board (D-040 addendum 8): on a phone the densest boards take the room. The Last Rune's
// sockets are at least a set pitch apart on each realistic phone; every socket's hit area is its
// whole cell; no lock pip or source orb reaches into a neighbouring cell; and the touch loupe
// shows on every dense board. No two Gives/Needs cards overlap (dense-board-2).

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0, rune: 32 },
  { name: 'iphone', width: 844, height: 340, inset: 47, rune: 34 },
  { name: 'promax', width: 932, height: 380, inset: 59, rune: 38.5 },
  { name: 'android', width: 915, height: 360, inset: 0, rune: 36 },
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
