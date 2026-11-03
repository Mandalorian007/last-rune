import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { trayRemaining } from '../../games/last-rune/rules/validate';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from './helpers';

// mobile-7-teach (D-040 addendum 5): every word and look matches what is on screen.
//  1. Blocker: with a gem in hand, the gem card names that gem or no gem at all. Every altar at
//     first meeting (its arrival card up), every tray gem, right after the pick and after the
//     card has had time to step aside.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(300_000);

/** Set TEACH_SHOTS to a folder (docs/design/screens/local/…) to save what the checks saw. */
const SHOTS = process.env.TEACH_SHOTS ?? '';

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

async function boot(page: Page, inset: number) {
  await insets(page, inset);
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

/** Open `id` at first meeting (its arrival card up) with half its intended gems placed. */
async function openFresh(page: Page, id: string) {
  const at = MACHINE_IDS.indexOf(id as (typeof MACHINE_IDS)[number]);
  const placed = puzzleFor(id as (typeof MACHINE_IDS)[number]).design.intended;
  const half = placed.slice(0, Math.floor(placed.length / 2));
  await page.evaluate(
    ({ solved, id, half }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { placements: half, attempts: 0 } };
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
    },
    { solved: MACHINE_IDS.slice(0, at) as unknown as string[], id, half },
  );
  await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
}

/**
 * The gem names on the cards shown in the column: the gem card and any Capacitor read-out
 * (se/16 was a plan read-out headed "Capacitor" beside "Holding Channel").
 */
async function cardGems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const shown = (el: HTMLElement) => {
      if (el.hidden || el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        cs.display !== 'none' &&
        cs.visibility !== 'hidden' &&
        Number(cs.opacity) >= 0.05 &&
        r.width > 0 &&
        r.height > 0
      );
    };
    const out: string[] = [];
    const tip = document.querySelector<HTMLElement>('.lr-altar-tip');
    if (tip && shown(tip))
      for (const b of tip.querySelectorAll('.lr-info-row:not([data-how="ring"]) > b'))
        out.push(b.textContent ?? '');
    for (const c of document.querySelectorAll<HTMLElement>('.lr-altar-lane .lr-altar-cap'))
      if (shown(c)) out.push(c.querySelector('.lr-cap-head')?.textContent ?? 'Capacitor');
    return out;
  });
}

for (const vp of PHONES) {
  test.describe(`teach ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });

    test(`the gem card always names the gem in hand (${vp.name})`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const id of MACHINE_IDS) {
        await openFresh(page, id);
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const k = ob.width / 1920;
        const pz = puzzleFor(id);
        const half = pz.design.intended.slice(0, Math.floor(pz.design.intended.length / 2));
        for (const slot of L.tray) {
          if (trayRemaining(pz, half, slot.gem) <= 0) continue;
          const tap = () => page.touchscreen.tap(ob.x + slot.x * k, ob.y + slot.y * k);
          await tap();
          await waitFrames(page, 6);
          const held = await page.evaluate(() => (window as G).__altarView.held?.kind ?? null);
          if (held !== slot.gem) {
            problems.push(`${id}: tapping ${slot.gem} holds ${held}`);
            continue;
          }
          const name = (
            (await page.locator('.lr-altar-holding b').textContent()) ?? ''
          ).toLowerCase();
          for (const when of ['picked', 'later']) {
            if (when === 'later') await page.waitForTimeout(2800);
            for (const g of await cardGems(page))
              if (g.toLowerCase() !== name)
                problems.push(`${id} ${when}: holding ${name}, the card says ${g}`);
          }
          await tap();
          await waitFrames(page, 4);
        }
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      expect(problems).toEqual([]);
    });

    test(`the puzzle name stays in view while holding (${vp.name})`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const id of ['capacitor-bay', 'the-last-rune', 'intake-desk'] as const) {
        await openFresh(page, id);
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const k = ob.width / 1920;
        const pz = puzzleFor(id);
        const half = pz.design.intended.slice(0, Math.floor(pz.design.intended.length / 2));
        for (const slot of L.tray) {
          if (trayRemaining(pz, half, slot.gem) <= 0) continue;
          const tap = () => page.touchscreen.tap(ob.x + slot.x * k, ob.y + slot.y * k);
          await tap();
          await waitFrames(page, 4);
          const g = await page.evaluate(() => {
            const box = (s: string) => {
              const el = document.querySelector<HTMLElement>(s)!;
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return {
                l: r.left,
                r: r.right,
                t: r.top,
                b: r.bottom,
                seen: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0,
                cut: el.scrollWidth > el.clientWidth + 1,
                text: el.textContent ?? '',
              };
            };
            const app = document.querySelector('.tc-overlay')!.getBoundingClientRect();
            const others = [
              ...document.querySelectorAll<HTMLElement>(
                '.lr-altar-slot, .lr-altar-count, .lr-altar-actions button, .tc-hud-menu, .lr-altar-tip:not([hidden])',
              ),
            ]
              .filter((e) => e.getBoundingClientRect().width > 0)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return { c: e.className, l: r.left, r: r.right, t: r.top, b: r.bottom };
              });
            return {
              h2: box('.lr-altar-title h2'),
              pill: box('.lr-altar-holding'),
              app: { l: app.left, r: app.right },
              others,
            };
          });
          const tag = `${id} ${slot.gem}`;
          if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/teach-hold-${vp.name}-${id}-${slot.gem}.png` });
          if (!g.h2.seen) problems.push(`${tag}: the title is hidden while holding`);
          if (g.h2.cut) problems.push(`${tag}: the title is cut ("${g.h2.text}")`);
          if (!g.pill.seen) problems.push(`${tag}: no Holding pill`);
          const hit = (a: typeof g.pill, b: { l: number; r: number; t: number; b: number }) =>
            a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
          if (hit(g.h2, g.pill)) problems.push(`${tag}: the pill covers the title`);
          for (const e of [g.h2, g.pill])
            if (e.l < g.app.l - 0.5 || e.r > g.app.r + 0.5)
              problems.push(`${tag}: "${e.text}" runs off screen`);
          for (const o of g.others)
            for (const e of [g.h2, g.pill])
              if (hit(e, o)) problems.push(`${tag}: "${e.text}" overlaps ${o.c}`);
          await tap();
          await waitFrames(page, 4);
        }
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      expect(problems).toEqual([]);
    });
  });
}
