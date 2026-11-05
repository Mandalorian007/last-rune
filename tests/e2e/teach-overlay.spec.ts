/**
 * teach-overlay (user, real iPhone in Brave, 2026-11-05): with the browser's address bar and tab
 * strip on screen the game gets about 852×270 CSS px, and the arrival card squeezed under the
 * tray was tiny and scrolled. On phones the card is now a panel over the column (it may cover
 * the tray, never the board's sockets or Strike), shows its words in full, folds to a pill after
 * a few idle seconds or a tap on the board, opens again from the pill, and only "Got it"
 * retires it.
 *
 *   SHOTS=teach-overlay pnpm exec playwright test tests/e2e/teach-overlay.spec.ts
 *     also saves Lift Shaft, Capacitor Bay, Intake Desk and The Last Rune expanded, folded and
 *     opened again, on the short phone, the iPhone and the SE
 *     (docs/design/screens/local/teach-overlay/<phone>/).
 */
import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from './altar-audit';
import { DEV_URL, settled, waitFrames } from './helpers';
import { SHORT_PHONE } from './phones';

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

const DIR = process.env.SHOTS ?? '';
const ORDER = playOrder();
const TIP = '.lr-altar-tip';
const PILL = '.lr-card-pill';
const OVER = `${TIP}[data-over]:not([hidden])`;

test.setTimeout(240_000);

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

/**
 * Open `id` as a player meets it in play order, its board empty and its card up. Lift Shaft is
 * met before Roof Array (as the user met it): no Capacitor yet in hand, so its card shows there.
 */
async function meet(page: Page, id: MachineId, idle?: number, card = true) {
  const before = ORDER.slice(0, ORDER.indexOf(id)).filter(
    (m) => !(id === 'lift-shaft' && m === 'roof-array'),
  );
  await page.evaluate(
    ({ solved, id, idle }) => {
      const w = window as G;
      w.__lrCardIdle = idle;
      const g = w.__game;
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.flags.dotTold = solved.length > 0;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = {};
        d.codex.taught = {};
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { solved: before as string[], id, idle },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  if (card) await expect(page.locator(OVER)).toBeVisible({ timeout: 10_000 });
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** The open panel against the board, Strike and the gauges' notes; and its words in full. */
async function panelProblems(page: Page, id: MachineId): Promise<string[]> {
  await settled(page, `${TIP}, .lr-altar-need`);
  return page.evaluate(
    ({ blocked }) => {
      const out: string[] = [];
      const tip = document.querySelector<HTMLElement>('.lr-altar-tip[data-over]');
      if (!tip || tip.hidden) return ['no open panel'];
      const r = tip.getBoundingClientRect();
      const box: Box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const L = (window as unknown as { __altarLayout: AltarLayout }).__altarLayout;
      const ov = document
        .querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!
        .getBoundingClientRect();
      const k = ov.width / 1920;
      for (let y = 0; y < L.rows; y++)
        for (let x = 0; x < L.cols; x++) {
          if (blocked.some((c) => c.x === x && c.y === y)) continue;
          const cx = ov.left + (L.left + L.margin + L.pitch * (x + 0.5)) * k;
          const cy = ov.top + (L.top + L.margin + L.pitch * (y + 0.5)) * k;
          const s = L.pitch * 0.36 * k;
          if (hit(box, { l: cx - s, r: cx + s, t: cy - s, b: cy + s }))
            out.push(`covers socket ${x},${y}`);
        }
      const others: [string, Element | null][] = [
        ['Strike', document.querySelector('[data-action="strike"]')],
        ['Menu', document.querySelector('.tc-region[data-region="right"] > *')],
        ...[...document.querySelectorAll('.lr-altar-need')].map(
          (el) => ['a gauge note', el] as [string, Element],
        ),
      ];
      for (const [what, el] of others) {
        if (!el || el.closest('[hidden]')) continue;
        const q = el.getBoundingClientRect();
        if (q.width === 0) continue;
        if (hit(box, { l: q.left, t: q.top, r: q.right, b: q.bottom })) out.push(`covers ${what}`);
      }
      if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)
        out.push('off screen');
      if (tip.scrollHeight > tip.clientHeight + 1)
        out.push(`scrolls (${tip.scrollHeight} > ${tip.clientHeight})`);
      for (const el of tip.querySelectorAll<HTMLElement>('*')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        if (!own || el.closest('.lr-info-foot')) continue;
        const px = Number.parseFloat(getComputedStyle(el).fontSize);
        if (px < 13.75) out.push(`${px}px text "${el.textContent?.trim().slice(0, 20)}"`);
      }
      return out;
    },
    { blocked: puzzleFor(id).blocked },
  );
}

async function snap(page: Page, phone: string, name: string) {
  if (!DIR) return;
  await waitFrames(page, 6);
  const dir = `docs/design/screens/local/${DIR}/${phone}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

/** An empty socket's centre, client px (a tap there lands on the board, not a gem). */
async function emptySocket(page: Page, id: MachineId) {
  const pz = puzzleFor(id);
  return page.evaluate(
    ({ taken }) => {
      const L = (window as unknown as { __altarLayout: AltarLayout }).__altarLayout;
      const ov = document
        .querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!
        .getBoundingClientRect();
      const k = ov.width / 1920;
      for (let y = 0; y < L.rows; y++)
        for (let x = 0; x < L.cols; x++) {
          if (taken.some((c) => c.x === x && c.y === y)) continue;
          return {
            x: ov.left + (L.left + L.margin + L.pitch * (x + 0.5)) * k,
            y: ov.top + (L.top + L.margin + L.pitch * (y + 0.5)) * k,
          };
        }
      return null;
    },
    { taken: [...pz.blocked, ...pz.fixed.map((f) => f.cell)] },
  );
}

const SHOT_PHONES = [
  SHORT_PHONE,
  { name: 'iphone', width: 844, height: 340, inset: 47, dpr: 1 },
  { name: 'se', width: 667, height: 320, inset: 0, dpr: 1 },
] as const;

for (const vp of SHOT_PHONES) {
  test.describe(`teach overlay ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: vp.dpr,
    });

    test(`open, idle, fold, tap, open, Got it at ${vp.width}×${vp.height}`, async ({ page }) => {
      await boot(page, vp.inset);
      const id: MachineId = 'lift-shaft';
      // The real clock: about 4 s untouched folds it.
      await meet(page, id);
      expect(await panelProblems(page, id)).toEqual([]);
      await expect(page.locator(PILL)).toBeHidden();
      await snap(page, vp.name, `${id}-1-open`);

      // A touch on the card's words keeps it open past the idle time.
      await page.waitForTimeout(2500);
      const words = (await page.locator(`${OVER} .lr-info-row`).first().boundingBox())!;
      await page.touchscreen.tap(words.x + 8, words.y + words.height / 2);
      await page.waitForTimeout(2500);
      await expect(page.locator(OVER)).toBeVisible();

      // Untouched, it folds to the pill: the gem's picture and name, a 44 px target.
      await expect(page.locator(PILL)).toBeVisible({ timeout: 8_000 });
      await expect(page.locator(OVER)).toHaveCount(0);
      const pill = (await page.locator(PILL).boundingBox())!;
      expect(pill.height).toBeGreaterThanOrEqual(44);
      expect(pill.width).toBeGreaterThanOrEqual(44);
      await expect(page.locator(PILL)).toContainText('Capacitor');
      await expect(page.locator(`${PILL} canvas, ${PILL} .lr-pill-gem`).first()).toBeVisible();
      await snap(page, vp.name, `${id}-2-folded`);

      // From here the idle clock is held, so a loaded machine's slow frames cannot fold it.
      await page.evaluate(() => Object.assign(window, { __lrCardIdle: 1e9 }));
      // The pill opens it again, on the same page.
      await page.locator(PILL).tap();
      await expect(page.locator(OVER)).toBeVisible();
      await expect(page.locator(PILL)).toBeHidden();
      await expect(page.locator(OVER)).toContainText('Capacitor');
      expect(await panelProblems(page, id)).toEqual([]);
      await snap(page, vp.name, `${id}-3-again`);

      // A tap on the board folds it at once.
      const at = (await emptySocket(page, id))!;
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.locator(PILL)).toBeVisible({ timeout: 2_000 });
      await expect(page.locator(OVER)).toHaveCount(0);

      // Opened again, "Got it" (after any Next) retires it: no pill, no card.
      await page.locator(PILL).tap();
      for (let i = 0; i < 6; i++) {
        const next = page.locator(`${OVER} .lr-info-next`);
        if ((await next.count()) === 0) break;
        await next.first().tap({ timeout: 5_000 });
        await waitFrames(page, 3);
      }
      await expect(page.locator(OVER)).toHaveCount(0);
      await expect(page.locator(PILL)).toBeHidden();
      await waitFrames(page, 10);
      await expect(page.locator(PILL)).toBeHidden();
      await expect(page.locator(`${TIP}[data-source="intro"]:not([hidden])`)).toHaveCount(0);
    });

    test(`a tray gem picked with the card folded keeps the pill at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      await boot(page, vp.inset);
      const id: MachineId = 'capacitor-bay';
      await meet(page, id, 1e9);
      // Board tap folds it, then the tray is in view: a gem picked keeps the lesson as a pill.
      const at = (await emptySocket(page, id))!;
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.locator(PILL)).toBeVisible();
      const L = await page.evaluate(
        () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
      );
      const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
      const k = ob.width / 1920;
      const s0 = L.tray[0]!;
      await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
      await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, s0.gem);
      await expect(page.locator(PILL)).toBeVisible();
      // Placing a gem does not retire it either.
      const spot = (await emptySocket(page, id))!;
      await page.touchscreen.tap(spot.x, spot.y);
      await waitFrames(page, 6);
      await expect(page.locator(PILL)).toBeVisible();
    });

    if (DIR)
      test(`shots at ${vp.width}×${vp.height}`, async ({ page }) => {
        await boot(page, vp.inset);
        for (const id of [
          'intake-desk',
          'capacitor-bay',
          'lift-shaft',
          'the-last-rune',
        ] as MachineId[]) {
          // The Last Rune teaches nothing new in play order: its board as met, no card.
          const card = id !== 'the-last-rune';
          await meet(page, id, 1e9, card);
          if (card) expect(await panelProblems(page, id)).toEqual([]);
          await snap(page, vp.name, `${id}-1-open`);
          if (!card) {
            await expect(page.locator(PILL)).toBeHidden();
            continue;
          }
          const at = (await emptySocket(page, id))!;
          await page.touchscreen.tap(at.x, at.y);
          await expect(page.locator(PILL)).toBeVisible();
          await snap(page, vp.name, `${id}-2-folded`);
          await page.locator(PILL).tap();
          await expect(page.locator(OVER)).toBeVisible();
          await snap(page, vp.name, `${id}-3-again`);
        }
      });
  });
}
