import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
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

async function openFresh(page: Page, id: string) {
  const at = MACHINE_IDS.indexOf(id as (typeof MACHINE_IDS)[number]);
  await page.evaluate(
    ({ solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = {};
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
    },
    { solved: MACHINE_IDS.slice(0, at) as unknown as string[] },
  );
  await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
}

/** The gem names on the shown gem card (empty when it is hidden). */
async function cardGems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tip = document.querySelector<HTMLElement>('.lr-altar-tip');
    if (!tip || tip.hidden || Number(getComputedStyle(tip).opacity) < 0.05) return [];
    return [...tip.querySelectorAll('.lr-info-row:not([data-how="ring"]) > b')].map(
      (b) => b.textContent ?? '',
    );
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
        for (const slot of L.tray) {
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
  });
}
