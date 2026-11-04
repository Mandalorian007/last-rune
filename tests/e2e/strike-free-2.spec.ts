/**
 * strike-free-2 (D-043): the arrival card and the Capacitor's plan read-out never collide on a
 * phone. Gate 6: Capacitor Bay opened at first meeting with gems already on the board drew the
 * plan over the card, leaving only "New here · 1 of 2" and no body. The card wins while it shows;
 * the plan waits. Every multi-strike altar, fresh and pre-filled, on all four phones.
 *
 * SHOTS=<dir> saves what the checks saw to docs/design/screens/local/<dir>/<phone>/ (git-ignored).
 */
import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { DEV_URL, settled, waitFrames } from './helpers';

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

const DIR = process.env.SHOTS ?? '';
const ORDER = playOrder();
const ALTARS = ['capacitor-bay', 'roof-array', 'lift-shaft', 'the-last-rune'] as const;

/** Capacitor Bay's first try (capacitor.spec): the charge reaches the Capacitor, so its plan shows. */
const BAY_FIRST_TRY = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

const PHONES = [
  { name: 'se', width: 667, height: 320 },
  { name: 'iphone', width: 844, height: 340 },
  { name: 'promax', width: 932, height: 380 },
  { name: 'android', width: 915, height: 360 },
] as const;

test.setTimeout(300_000);

async function snap(page: Page, folder: string, name: string) {
  if (!DIR) return;
  await settled(page, '#app *');
  await waitFrames(page, 6);
  const dir = `docs/design/screens/local/${DIR}/${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

/** Open `id` at first meeting: everything before it solved, `placements` on its board. */
async function open(page: Page, id: MachineId, placements: readonly unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 10);
}

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
  w: number;
  h: number;
}

/** The arrival card's body and every shown Capacitor read-out, as laid out now. */
function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const tip = document.querySelector<HTMLElement>('.lr-altar-tip');
    const up = !!tip && !tip.hidden && tip.dataset.source === 'intro';
    const body = up ? tip.querySelector('.lr-info-row') : null;
    const card = up && tip ? rect(tip) : null;
    // The body must show whole inside the card (not clipped to the "New here" footer).
    const bodyRect = body ? rect(body) : null;
    const caps = [...document.querySelectorAll<HTMLElement>('.lr-altar-cap')]
      .filter((el) => el.offsetHeight > 0)
      .map((el) => ({ plan: el.hasAttribute('data-plan'), ...rect(el) }));
    return { up, card, body: bodyRect, text: tip?.textContent ?? '', caps };
  });
}

const meets = (a: Rect, b: Rect) =>
  a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({
      viewport: { width: ph.width, height: ph.height },
      isMobile: true,
      hasTouch: true,
    });
    test(`${ph.name}: the arrival card shows whole, clear of the Capacitor plan`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      // A finger, as on a real phone.
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );
      const problems: string[] = [];
      for (const id of ALTARS) {
        const intended = puzzleFor(id).design.intended;
        const boards: Record<string, readonly unknown[]> = {
          fresh: [],
          // Everything but the last gem: the altar is unsolved, the Capacitor (if lit) plans.
          prefilled: intended.slice(0, Math.max(1, intended.length - 1)),
        };
        if (id === 'capacitor-bay') boards.firsttry = BAY_FIRST_TRY;
        for (const [label, placements] of Object.entries(boards)) {
          await open(page, id, placements);
          const m = await measure(page);
          const tag = `${id} ${label}`;
          await snap(page, ph.name, `${id}-${label}`);
          // Not every altar brings a new piece; one with no arrival card has nothing to collide.
          // Capacitor Bay always has one (it brings the Capacitor).
          if (!m.up) {
            if (id === 'capacitor-bay') problems.push(`${tag}: no arrival card`);
            continue;
          }
          if (!m.card || !m.body) {
            problems.push(`${tag}: no arrival card body (${m.text.slice(0, 40)})`);
            continue;
          }
          if (m.body.h < 12) problems.push(`${tag}: card body squeezed to ${m.body.h}px`);
          if (m.body.t < m.card.t - 0.5 || m.body.b > m.card.b + 0.5 + 1)
            problems.push(`${tag}: card body runs out of the card`);
          for (const c of m.caps)
            if (meets(c, m.card))
              problems.push(`${tag}: ${c.plan ? 'plan' : 'live'} read-out meets the card`);
          if (label === 'firsttry') {
            // The plan only waits: with the card read and closed, it is back.
            for (let i = 0; i < 4; i++) {
              const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
              if ((await next.count()) === 0) break;
              await next.tap();
              await waitFrames(page, 4);
            }
            await page.evaluate(() => (window as G).__game.fuse.hush());
            await waitFrames(page, 6);
            const after = await measure(page);
            await snap(page, ph.name, `${id}-${label}-closed`);
            if (after.up) problems.push(`${tag}: arrival card did not close`);
            if (!after.caps.some((c) => c.plan)) problems.push(`${tag}: plan gone after the card`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });
}
