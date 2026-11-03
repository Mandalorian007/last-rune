import { type CDPSession, expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from './helpers';

// mobile-6-zoom: on phones, every socket on every altar is placed at ≥44 CSS px. Boards whose
// fitted sockets are under 44 CSS px get the zoomed view: a tap on the board zooms in around
// it (nothing is placed at the small size), a drag pans (nothing is placed), the rail's button
// shows the whole board, and Strike goes back to the whole board first.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

/** The effective socket pitch every placement happens at, CSS px. */
const TOUCH_MIN = 44;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(240_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

const layout = (page: Page) =>
  page.evaluate(() => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout);

async function open(page: Page, id: MachineId) {
  await page.evaluate(
    ({ id, ids }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.progress.solved = ids.filter((m) => m !== id);
        d.puzzles = {};
      });
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      if (g.flow.state !== 'hall') g.flow.continueGame();
      g.flow.openPuzzle(id);
      g.fuse.hush();
    },
    { id, ids: [...MACHINE_IDS] as string[] },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 8);
}

/** A one-finger drag through CDP (Playwright's touchscreen only taps). */
async function drag(cdp: CDPSession, x0: number, y0: number, x1: number, y1: number) {
  const pt = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const center = (L: AltarLayout, x: number, y: number) => ({
  x: L.left + L.margin + L.pitch * (x + 0.5),
  y: L.top + L.margin + L.pitch * (y + 0.5),
});

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    test(`dense boards zoom so every socket is placed at ≥${TOUCH_MIN} px (${vp.width}×${vp.height})`, async ({
      page,
    }) => {
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() => {
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        );
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.progress.solved = [];
          d.puzzles = {};
        });
        g.flow.continueGame();
      });
      await expect(page.locator('.tc-overlay')).toHaveAttribute('data-phone', '');
      const ob = (await page.locator('.tc-overlay').boundingBox())!;
      const k = ob.width / 1920;
      const tap = (x: number, y: number) => page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
      const problems: string[] = [];
      const table: string[] = [];

      // 1. Every altar: the pitch a finger places at (fitted, or zoomed in by a tap).
      for (const id of MACHINE_IDS) {
        await open(page, id);
        const L = await layout(page);
        const fit = L.pitch * k;
        const zoomable = await page.locator('.lr-altar[data-zoomable]').count();
        let placeAt = fit;
        if (zoomable) {
          await expect(page.locator('[data-action="zoom"]')).toBeVisible();
          const c = center(L, (L.cols - 1) / 2, (L.rows - 1) / 2);
          await tap(c.x, c.y);
          await waitFrames(page, 4);
          placeAt = (await layout(page)).pitch * k;
          await page.locator('[data-action="zoom"]').tap();
          await waitFrames(page, 4);
          const back = (await layout(page)).pitch * k;
          if (Math.abs(back - fit) > 0.01) problems.push(`${id}: Whole board left ${back}px`);
        } else if (fit < TOUCH_MIN) problems.push(`${id}: ${fit.toFixed(1)}px and no zoom`);
        if (placeAt < TOUCH_MIN) problems.push(`${id}: placed at ${placeAt.toFixed(1)}px`);
        table.push(
          `${id.padEnd(16)} ${`${L.cols}×${L.rows}`.padEnd(6)} fit ${fit.toFixed(1)}px${zoomable ? ` → zoomed ${placeAt.toFixed(1)}px` : ''}`,
        );
      }
      console.log(`\n${vp.name} ${vp.width}×${vp.height}\n${table.join('\n')}`);

      // 2. The Last Rune: a gem from the tray onto the socket farthest from it, by taps.
      const id: MachineId = 'the-last-rune';
      await open(page, id);
      const pz = puzzleFor(id);
      const L = await layout(page);
      const taken = (x: number, y: number) =>
        [...pz.blocked, ...pz.fixed.map((f) => f.cell)].some((c) => c.x === x && c.y === y);
      const slot = L.tray[0]!;
      let far = { x: 0, y: 0 };
      let best = -1;
      for (let y = 0; y < L.rows; y++)
        for (let x = 0; x < L.cols; x++) {
          if (taken(x, y)) continue;
          const c = center(L, x, y);
          const d = Math.hypot(c.x - slot.x, c.y - slot.y);
          if (d > best) {
            best = d;
            far = { x, y };
          }
        }
      const gemAt = (c: { x: number; y: number }) =>
        page.evaluate((c) => {
          const b = (window as G).__altarView.gemAt(c);
          return b && !b.hidden && !b.fixed ? true : null;
        }, c);
      const held = () => page.evaluate(() => !!(window as G).__altarView.held);

      // Take a gem, tap the far socket at the whole board: it zooms there, the gem stays held.
      await tap(slot.x, slot.y);
      await waitFrames(page, 4);
      expect(await held()).toBe(true);
      const f0 = center(L, far.x, far.y);
      await tap(f0.x, f0.y);
      await waitFrames(page, 4);
      expect(await held(), 'a tap at the whole board zooms; the gem stays in hand').toBe(true);
      expect(await gemAt(far), 'nothing is placed at the whole board').toBeNull();
      const Z = await layout(page);
      expect(Z.pitch * k).toBeGreaterThanOrEqual(TOUCH_MIN);

      // A drag pans and places nothing; the gem is still held after it.
      const cdp = await page.context().newCDPSession(page);
      const v = Z.phone!;
      const mid = { x: (v.padL + v.colL) / 2, y: (v.visT + v.visB) / 2 };
      const z0 = await page.evaluate(() => ({ ...(window as G).__altarView.zoom }));
      await drag(
        cdp,
        ob.x + mid.x * k,
        ob.y + mid.y * k,
        ob.x + mid.x * k + 60,
        ob.y + mid.y * k + 40,
      );
      await waitFrames(page, 4);
      const z1 = await page.evaluate(() => ({ ...(window as G).__altarView.zoom }));
      expect(z1.z).toBe(z0.z);
      expect(Math.hypot(z1.ox - z0.ox, z1.oy - z0.oy), 'the drag panned').toBeGreaterThan(1);
      expect(await held(), 'a pan keeps the gem in hand').toBe(true);
      expect(
        await page.evaluate(
          () => (window as G).__altarView.board.filter((b: G) => !b.fixed).length,
        ),
        'a pan places nothing',
      ).toBe(0);

      // Pan back so the far socket shows, then tap it (live layout) to place the gem.
      let S = await layout(page);
      let c = center(S, far.x, far.y);
      const inView = (p: { x: number; y: number }) =>
        p.x > v.padL + S.pitch / 2 &&
        p.x < v.colL - S.pitch / 2 &&
        p.y > v.visT + S.pitch / 2 &&
        p.y < v.visB - S.pitch / 2;
      if (!inView(c)) {
        await drag(
          cdp,
          ob.x + mid.x * k,
          ob.y + mid.y * k,
          ob.x + (mid.x + (mid.x - c.x)) * k,
          ob.y + (mid.y + (mid.y - c.y)) * k,
        );
        await waitFrames(page, 4);
        S = await layout(page);
        c = center(S, far.x, far.y);
      }
      expect(inView(c), `socket ${far.x},${far.y} on screen`).toBe(true);
      await tap(c.x, c.y);
      await waitFrames(page, 4);
      expect(await gemAt(far), `${slot.gem} placed on ${far.x},${far.y}`).not.toBeNull();
      expect(S.pitch * k).toBeGreaterThanOrEqual(TOUCH_MIN);

      // Strike while zoomed: the whole board shows, then the strike runs.
      await page.locator('[data-action="strike"]').tap();
      const sure = page.locator('.lr-confirm .lr-gold-button');
      await waitFrames(page, 4);
      if (await sure.isVisible()) await sure.tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
      expect((await layout(page)).pitch * k).toBeCloseTo(L.pitch * k, 3);

      expect(problems).toEqual([]);
    });

    // mobile-6-integrate: zoomed, no Gives/Needs card (nor the chip it shrinks to when its
    // gauge is off the view) covers a socket's tap circle, and the zoom teaches itself in the
    // how-to slot without contradicting the "Holding" pill.
    test(`zoomed cards never cover a socket; the zoom's hint lines (${vp.name})`, async ({
      page,
    }) => {
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() => {
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        );
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
        });
        g.flow.continueGame();
      });
      await expect(page.locator('.tc-overlay')).toHaveAttribute('data-phone', '');
      // The overlay's box changes with each altar's framing (phones crop to fill): measure it
      // at each tap.
      const tap = async (x: number, y: number) => {
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const k = ob.width / 1920;
        await page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
      };
      const hint = () => page.locator('.lr-altar-hint').textContent();
      const problems: string[] = [];
      /** Every card (and every word in it) against the open sockets' tap circles, now. */
      const covered = (id: MachineId, at: string) =>
        page.evaluate(
          ({ at, blocked }) => {
            const S = (window as unknown as { __altarLayout: AltarLayout }).__altarLayout;
            const ov = document.querySelector<HTMLElement>('.tc-overlay')!.getBoundingClientRect();
            const k = ov.width / 1920;
            const r = 0.4 * S.pitch;
            const out: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>('.lr-altar-need')) {
              if (el.hidden || getComputedStyle(el).display === 'none') continue;
              const boxes = [el, ...el.querySelectorAll<HTMLElement>('*')]
                .map((e) => e.getBoundingClientRect())
                .filter((q) => q.width > 0.5 && q.height > 0.5)
                .map((q) => ({
                  x0: (q.left - ov.left) / k,
                  x1: (q.right - ov.left) / k,
                  y0: (q.top - ov.top) / k,
                  y1: (q.bottom - ov.top) / k,
                }));
              for (let y = 0; y < S.rows; y++)
                for (let x = 0; x < S.cols; x++) {
                  if (blocked.some((c) => c.x === x && c.y === y)) continue;
                  const cx = S.left + S.margin + S.pitch * (x + 0.5);
                  const cy = S.top + S.margin + S.pitch * (y + 0.5);
                  const on = boxes.some((b) => {
                    const dx = cx - Math.max(b.x0, Math.min(cx, b.x1));
                    const dy = cy - Math.max(b.y0, Math.min(cy, b.y1));
                    return dx * dx + dy * dy < r * r;
                  });
                  if (on)
                    out.push(
                      `${at}: "${el.textContent.replace(/\s+/g, ' ')}"${el.dataset.off ? ` (chip ${el.dataset.off})` : ''} on socket ${x},${y}`,
                    );
                }
            }
            return out;
          },
          { at: `${id} ${at}`, blocked: puzzleFor(id).blocked },
        );
      const dense: MachineId[] = [];
      for (const id of MACHINE_IDS) {
        await open(page, id);
        if (await page.locator('.lr-altar[data-zoomable]').count()) dense.push(id);
      }
      expect(dense).toContain('the-last-rune');
      let first = true;
      for (const id of dense) {
        await open(page, id);
        const L = await layout(page);
        if (first)
          expect(await hint(), 'the first dense board teaches the zoom').toContain(
            'Tap the board to zoom in',
          );
        // Zoom in at nine points over the board, and check the cards at each view.
        for (const fy of [0, 0.5, 1])
          for (const fx of [0, 0.5, 1]) {
            const c = center(L, fx * (L.cols - 1), fy * (L.rows - 1));
            await tap(c.x, c.y);
            await waitFrames(page, 4);
            if (first) {
              expect(await hint(), 'zoomed, the hint says a drag pans').toContain(
                'Drag to look around',
              );
              first = false;
            }
            problems.push(...(await covered(id, `zoomed at ${fx},${fy}`)));
            await page.locator('[data-action="zoom"]').tap();
            await waitFrames(page, 4);
          }
      }

      // The Last Rune: the hint line and the held gem agree.
      const id: MachineId = 'the-last-rune';
      await open(page, id);
      const L = await layout(page);
      await tap(L.tray[0]!.x, L.tray[0]!.y);
      await waitFrames(page, 4);
      await expect(page.locator('.lr-altar-holding')).toBeVisible();
      expect(await hint(), 'at the whole board a tap zooms; it places nothing').not.toContain(
        'tap a socket',
      );
      const c = center(L, (L.cols - 1) / 2, (L.rows - 1) / 2);
      await tap(c.x, c.y);
      await waitFrames(page, 4);
      expect(await hint(), 'a gem in hand beats the zoom line').not.toContain(
        'Drag to look around',
      );
      // Put the gem back, then pan: "Drag to look around" retires.
      await tap(L.tray[0]!.x, L.tray[0]!.y);
      await waitFrames(page, 4);
      const cdp = await page.context().newCDPSession(page);
      const v = L.phone!;
      const mid = { x: (v.padL + v.colL) / 2, y: (v.visT + v.visB) / 2 };
      const ob = (await page.locator('.tc-overlay').boundingBox())!;
      const k = ob.width / 1920;
      await drag(
        cdp,
        ob.x + mid.x * k,
        ob.y + mid.y * k,
        ob.x + mid.x * k - 80,
        ob.y + mid.y * k - 50,
      );
      await waitFrames(page, 4);
      problems.push(...(await covered(id, 'panned')));
      expect(await hint()).not.toContain('Drag to look around');
      expect(problems).toEqual([]);
    });
  });
}
