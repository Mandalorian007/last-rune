import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from './helpers';

// mobile-5-moments (D-040 addendum 3): the altar's moments show one thing at a time, on four
// phones (browser bars showing, the iPhone's notch insets emulated):
//  1. The how-to line keeps its own slot: visible, and not under FUSE's bubble while he talks
//     (intake-desk, a fresh save).
//  2. A fail shows the socket's tag and the verdict card; FUSE's bubble waits until it is gone.
//  3. The solve card stands ≥12 CSS px inside the play area; Continue is ≥44 px tall and spans
//     the card; FUSE's line is fully on screen and off the card.
//  4. FUSE's figure is fully inside the viewport (his treads are not cut by the bottom edge).
//  5. An altar's arrival card (its new pieces), every page of it, stands ≥8 CSS px clear of
//     Strike and off FUSE: intake-desk fresh, relay-tower and capacitor-bay at first meeting.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

/** The solve card's clearance from the play area's edges, CSS px. */
const CARD_IN = 12;
/** Least tap height of Continue, CSS px. */
const TAP_MIN = 44;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
type Box = { l: number; t: number; r: number; b: number };

test.setTimeout(240_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

/** A shown element's box (client px), or null when it is hidden, empty or invisible. */
async function shownBox(page: Page, sel: string): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el || el.hidden) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 1 || r.height < 1)
      return null;
    if (Number(cs.opacity) < 0.05) return null;
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, sel);
}

const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const grow = (a: Box, d: number): Box => ({ l: a.l - d, t: a.t - d, r: a.r + d, b: a.b + d });
/** The arrival card's clearance from Strike, CSS px. */
const STRIKE_CLEAR = 8;

/** Every page of the arrival card now up: clear of Strike and FUSE. Pages turn every 4 s. */
async function arrivalProblems(page: Page, label: string): Promise<string[]> {
  const out: string[] = [];
  const first = await shownBox(page, '.lr-altar-tip[data-source="intro"]');
  if (!first) return [`${label}: no arrival card`];
  const marker = await page.evaluate(
    () => document.querySelector('.lr-altar-tip .lr-info-page')?.textContent ?? '',
  );
  const pages = Number(/of (\d+)/.exec(marker)?.[1] ?? 1);
  for (let i = 0; i < pages; i++) {
    if (i > 0) await page.waitForTimeout(4000);
    const tip = await shownBox(page, '.lr-altar-tip[data-source="intro"]');
    const strike = await shownBox(page, '[data-action="strike"]');
    if (!tip) {
      out.push(`${label}: arrival card gone at page ${i + 1} of ${pages}`);
      break;
    }
    if (strike && hit(grow(tip, STRIKE_CLEAR), strike))
      out.push(`${label} page ${i + 1}: arrival card within ${STRIKE_CLEAR}px of Strike`);
    if (hit(tip, await fuseBox(page))) out.push(`${label} page ${i + 1}: arrival card over FUSE`);
  }
  return out;
}

/** The play area: the app box (inside the emulated notch insets), client px. */
async function playArea(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const r = document.getElementById('app')!.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: Math.min(r.bottom, window.innerHeight) };
  });
}

/** FUSE's figure (not his sprite's empty margin), client px. */
async function fuseBox(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const f = (window as G).__altarView.fuse;
    const ov = document.querySelector<HTMLElement>('.tc-overlay')!.getBoundingClientRect();
    const k = ov.width / 1920;
    return {
      l: ov.left + (f.x - 0.7 * f.scale) * k,
      r: ov.left + (f.x + 0.7 * f.scale) * k,
      t: ov.top + (f.y - 2.3 * f.scale) * k,
      b: ov.top + (f.y + 0.12 * f.scale) * k,
    };
  });
}

async function seed(page: Page, solved: string[], puzzles: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ solved, puzzles }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = puzzles;
      });
      if (g.flow.state !== 'hall') g.flow.continueGame();
    },
    { solved, puzzles },
  );
}

for (const vp of PHONES) {
  test.describe(`phone moments ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });

    test(`hint, fail, solve and FUSE, one at a time (${vp.name})`, async ({ page }) => {
      await insets(page, vp.inset);
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
      await seed(page, []);
      await expect(page.locator('.tc-overlay')).toHaveAttribute('data-phone', '');
      const problems: string[] = [];
      const area = await playArea(page);

      // 1. The how-to line, while FUSE talks: its own slot.
      await page.evaluate(() => (window as G).__game.flow.openPuzzle('intake-desk'));
      await expect(page.locator('.lr-altar')).toBeVisible();
      await waitFrames(page, 6);
      problems.push(...(await arrivalProblems(page, 'intake-desk')));
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        void g.fuse.say('A visitor. There is a form for that.', { hold: 0 });
      });
      await waitFrames(page, 8);
      const hint = await shownBox(page, '.lr-altar-hint');
      const cap = await shownBox(page, '.tc-caption');
      if (!hint) problems.push('intake-desk: no how-to line while FUSE talks');
      if (hint && cap && hit(hint, cap)) problems.push('intake-desk: FUSE covers the how-to line');
      // Holding a gem: the line says the next tap.
      const L = await page.evaluate(
        () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
      );
      const ob = (await page.locator('.tc-overlay').boundingBox())!;
      const k = ob.width / 1920;
      await page.touchscreen.tap(ob.x + L.tray[0]!.x * k, ob.y + L.tray[0]!.y * k);
      await waitFrames(page, 6);
      const held = (await page.locator('.lr-altar-hint').textContent()) ?? '';
      if (!/socket/.test(held) || /gem, then/.test(held))
        problems.push(`intake-desk held: how-to line says "${held}"`);
      if (!(await shownBox(page, '.lr-altar-hint')))
        problems.push('intake-desk held: no how-to line');
      const fz = await fuseBox(page);
      if (fz.l < area.l || fz.r > area.r || fz.t < area.t || fz.b > area.b - 1)
        problems.push(
          `intake-desk: FUSE off screen ${JSON.stringify(fz)} in ${JSON.stringify(area)}`,
        );
      await page.evaluate(() => (window as G).__game.flow.closePuzzle());
      await waitFrames(page, 4);

      // 5. Capacitor Bay at first meeting (everything before it restored).
      await seed(
        page,
        MACHINE_IDS.filter(
          (m) =>
            ![
              'capacitor-bay',
              'lift-shaft',
              'roof-array',
              'control-booth',
              'the-last-rune',
            ].includes(m),
        ),
      );
      await page.evaluate(() => (window as G).__game.flow.openPuzzle('capacitor-bay'));
      await expect(page.locator('.lr-altar')).toBeVisible();
      await waitFrames(page, 6);
      problems.push(...(await arrivalProblems(page, 'capacitor-bay')));
      await page.evaluate(() => (window as G).__game.flow.closePuzzle());
      await waitFrames(page, 4);

      // 2. A fail: the verdict card, and FUSE's bubble only once it is gone. (Relay Tower right
      // after the Intake Desk: its arrival card first.)
      await seed(page, ['intake-desk']);
      await page.evaluate(() => (window as G).__game.flow.openPuzzle('relay-tower'));
      await expect(page.locator('.lr-altar')).toBeVisible();
      await waitFrames(page, 6);
      problems.push(...(await arrivalProblems(page, 'relay-tower')));
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await page.locator('[data-action="strike"]').tap();
      await waitFrames(page, 4);
      const sure = page.locator('.lr-confirm .lr-gold-button');
      if (await sure.isVisible()) await sure.tap();
      await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 15_000 });
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(150);
        const v = await shownBox(page, '.lr-altar-verdict');
        const c = await shownBox(page, '.tc-caption');
        if (v && c) {
          problems.push('relay-tower fail: FUSE talks over the verdict card');
          break;
        }
      }
      // "Try: …" stands on a line of its own, not run on after a " · ".
      const runOn = await page.evaluate(() =>
        [...document.querySelectorAll('.lr-altar-verdict :is(.lr-verdict-story, .lr-verdict-hint)')]
          .filter((el) => (el.textContent ?? '').trim())
          .some((el) => {
            const before = getComputedStyle(el, '::before').content;
            return (
              getComputedStyle(el).display !== 'block' || (before !== 'none' && before !== 'normal')
            );
          }),
      );
      if (runOn) problems.push('relay-tower fail: the verdict runs on into its next step');
      const fz2 = await fuseBox(page);
      if (fz2.l < area.l || fz2.r > area.r || fz2.t < area.t || fz2.b > area.b - 1)
        problems.push(`relay-tower: FUSE off screen ${JSON.stringify(fz2)}`);
      await page.evaluate(() => (window as G).__game.flow.closePuzzle());
      await waitFrames(page, 4);

      // 3. The solve card (a first solve that grants a gem: the card shows it).
      await seed(page, ['intake-desk'], {
        furnace: { placements: puzzleFor('furnace').design.intended, attempts: 0 },
      });
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.flow.openPuzzle('furnace');
        g.flow.completePuzzle('furnace');
      });
      const cont = page.locator('.lr-solve-continue');
      await expect(cont).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        void g.fuse.say('Stack two and the second one just feels important.', { hold: 0 });
      });
      await waitFrames(page, 8);
      const card = await shownBox(page, '.lr-solve-card');
      const cb = await shownBox(page, '.lr-solve-continue');
      if (!card) problems.push('solve: no card');
      else {
        if (
          card.l < area.l + CARD_IN ||
          card.r > area.r - CARD_IN ||
          card.t < area.t + CARD_IN - 6 ||
          card.b > area.b - CARD_IN
        )
          problems.push(
            `solve: card ${JSON.stringify(card)} not ${CARD_IN}px inside ${JSON.stringify(area)}`,
          );
        if (!cb) problems.push('solve: no Continue');
        else {
          if (cb.b - cb.t < TAP_MIN - 0.5)
            problems.push(`solve: Continue ${(cb.b - cb.t).toFixed(1)}px tall`);
          if (cb.l > card.l + 16 || cb.r < card.r - 16)
            problems.push('solve: Continue not card-wide');
          if (cb.t < card.t || cb.b > card.b) problems.push('solve: Continue outside the card');
        }
        const gem = await shownBox(page, '.lr-solve-grant');
        if (!gem) problems.push('solve: the new gem is not on the card');
        const scap = await shownBox(page, '.tc-caption');
        if (scap) {
          if (hit(scap, card)) problems.push('solve: FUSE covers the card');
          if (scap.l < area.l || scap.r > area.r || scap.t < area.t || scap.b > area.b)
            problems.push(`solve: FUSE's line off screen ${JSON.stringify(scap)}`);
        }
      }
      const fz3 = await fuseBox(page);
      if (fz3.l < area.l || fz3.r > area.r || fz3.t < area.t || fz3.b > area.b - 1)
        problems.push(`solve: FUSE off screen ${JSON.stringify(fz3)}`);
      expect(problems).toEqual([]);
    });
  });
}
