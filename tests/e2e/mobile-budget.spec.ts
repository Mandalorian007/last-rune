import { expect, type Page, test } from '@playwright/test';
import { LINES, wordCount } from '../../games/last-rune/content/lines';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from './helpers';

// mobile-2: the phone layout's hard budgets, on every altar, at the two tightest real phone
// viewports (browser bars showing; the iPhone's notch insets emulated):
//  1. Board first: the board with its storm, machines and gauges takes ≥55% of the usable
//     height and ≥45% of the usable width (or ≥75% of the height, see HEIGHT_BOUND).
//  2. Chrome (HUD, action buttons, title) covers ≤20% of the usable area.
//  3. Transient cards (hint, gem chip, verdict, FUSE's bubble) are each ≤⅓ of the screen wide
//     and ≤3 lines, and none of them, nor any chrome, sits over the board.
//  4. The page never scrolls, and no text is cut off (no ellipsis, line clamp or clipped
//     overflow on anything in the overlay, D-027).

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
] as const;

/**
 * Square and tall boards are bound by the phone's height: their width share tops out near usable
 * height ÷ usable width (340 ÷ 750 = 45% on the iPhone with its notch insets) less the room the
 * storm and machines take. A board that already takes ≥75% of the height is exempt from the
 * width rule (PM, mobile-2).
 */
const HEIGHT_BOUND = 0.75;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
type Box = { l: number; t: number; r: number; b: number };

const LONGEST = [...LINES].sort((a, b) => wordCount(b.text) - wordCount(a.text))[0]!.text;

test.setTimeout(300_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

/** Board, chrome and card measurements, client px. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const L = (window as unknown as { __altarLayout: AltarLayout }).__altarLayout;
    const ov = document.querySelector<HTMLElement>('.tc-overlay')!.getBoundingClientRect();
    const app = document.getElementById('app')!.getBoundingClientRect();
    const k = ov.width / 1920;
    const X = (x: number) => ov.left + x * k;
    const Y = (y: number) => ov.top + y * k;
    const box = (r: DOMRect | Box): Box =>
      'l' in r ? r : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    const shown = (el: Element) => {
      if (el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const slab: Box = { l: X(L.left), t: Y(L.top), r: X(L.right), b: Y(L.frontBottom) };
    const board = { ...slab };
    const grow = (b: Box) => {
      board.l = Math.min(board.l, b.l);
      board.t = Math.min(board.t, b.t);
      board.r = Math.max(board.r, b.r);
      board.b = Math.max(board.b, b.b);
    };
    for (const p of [L.storm, ...L.machines]) {
      grow({
        l: X(p.x - p.size / 2),
        r: X(p.x + p.size / 2),
        t: Y(p.y - p.size / 2),
        b: Y(p.y + p.size / 2),
      });
    }
    for (const el of document.querySelectorAll('.lr-altar-need'))
      if (shown(el)) grow(box(el.getBoundingClientRect()));
    const area = (b: Box) => Math.max(0, b.r - b.l) * Math.max(0, b.b - b.t);
    const chrome: { name: string; box: Box }[] = [];
    for (const sel of [
      '.lr-hud > button',
      '.lr-altar-actions button',
      '.lr-altar-title h2',
      '.lr-altar-turnbtn',
    ]) {
      for (const el of document.querySelectorAll(sel)) {
        if (shown(el)) chrome.push({ name: sel, box: box(el.getBoundingClientRect()) });
      }
    }
    /** Lines of text in an element: distinct line boxes of its text nodes. */
    const lines = (el: Element) => {
      const tops: number[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent?.trim() || !shown(n.parentElement!)) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) {
          if (r.width < 1) continue;
          if (!tops.some((t) => Math.abs(t - r.top) < r.height * 0.5)) tops.push(r.top);
        }
      }
      return tops.length;
    };
    const cards: { name: string; box: Box; lines: number; text: string }[] = [];
    for (const [sel, name] of [
      ['.lr-altar-hint', 'hint'],
      ['.lr-altar-tip', 'chip'],
      ['.lr-altar-verdict', 'verdict'],
      ['.tc-caption', 'caption'],
    ] as const) {
      for (const el of document.querySelectorAll(sel)) {
        if (!shown(el) || !el.textContent?.trim()) continue;
        cards.push({
          name,
          box: box(el.getBoundingClientRect()),
          lines: lines(el),
          text: el.textContent.trim().slice(0, 40),
        });
      }
    }
    // Cut-off text: an ellipsis or line clamp in force, or text wider than a clipping box.
    const clipped: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.tc-overlay *')) {
      // Screen-reader-only text is clipped to a pixel on purpose.
      if (!el.textContent?.trim() || !shown(el) || el.closest('.tc-sr-only')) continue;
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      const name = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}"`;
      if (own && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)
        clipped.push(`${name} ellipsis`);
      else if (
        cs.webkitLineClamp !== 'none' &&
        cs.webkitLineClamp !== '' &&
        el.scrollHeight > el.clientHeight + 1
      )
        clipped.push(`${name} line-clamped`);
      else if (
        own &&
        clips &&
        cs.overflowY === 'hidden' &&
        cs.overflowX === 'hidden' &&
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      )
        clipped.push(`${name} clipped`);
    }
    const usable = box(app);
    return {
      slab,
      board,
      usable,
      hShare: (board.b - board.t) / (usable.b - usable.t),
      wShare: (board.r - board.l) / (usable.r - usable.l),
      chromeShare: chrome.reduce((s, c) => s + area(c.box), 0) / area(usable),
      chrome,
      cards,
      clipped,
      screenW: innerWidth,
      scrolls:
        document.documentElement.scrollHeight > innerHeight + 1 ||
        document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}

type M = Awaited<ReturnType<typeof measure>>;
const hit = (a: Box, b: Box) =>
  Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;

/** Card and chrome problems in one measurement. */
function cardProblems(m: M, label: string): string[] {
  const out: string[] = [];
  for (const c of m.cards) {
    const w = c.box.r - c.box.l;
    if (w > m.screenW / 3 + 1) out.push(`${label}: ${c.name} ${w.toFixed(0)}px wide "${c.text}"`);
    if (c.lines > 3) out.push(`${label}: ${c.name} ${c.lines} lines "${c.text}"`);
    if (hit(c.box, m.slab)) out.push(`${label}: ${c.name} over the board "${c.text}"`);
  }
  for (const c of m.chrome) if (hit(c.box, m.slab)) out.push(`${label}: ${c.name} over the board`);
  if (m.scrolls) out.push(`${label}: page scrolls`);
  for (const c of m.clipped) out.push(`${label}: text cut off: ${c}`);
  return out;
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    test(`phone budgets on every altar at ${vp.width}×${vp.height}${vp.inset ? ` with ${vp.inset}px insets` : ''}`, async ({
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
      const problems: string[] = [];
      const table: string[] = [];
      for (const id of MACHINE_IDS) {
        await page.evaluate(
          ({ id, ids }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              // Every altar but this one solved: this one opens, unsolved.
              d.progress.solved = ids.filter((m) => m !== id);
              d.puzzles = {};
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
            g.fuse.hush();
          },
          { id, ids: [...MACHINE_IDS] as string[] },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await waitFrames(page, 8);
        const m = await measure(page);
        const wMin = m.hShare >= HEIGHT_BOUND ? 0 : 0.45;
        if (m.hShare < 0.55)
          problems.push(`${id}: board ${(m.hShare * 100).toFixed(0)}% of height`);
        if (m.wShare < wMin) problems.push(`${id}: board ${(m.wShare * 100).toFixed(0)}% of width`);
        if (m.chromeShare > 0.2)
          problems.push(`${id}: chrome ${(m.chromeShare * 100).toFixed(0)}%`);
        problems.push(...cardProblems(m, `${id} open`));
        let widest = 0;
        const note = (x: M) => {
          for (const c of x.cards) widest = Math.max(widest, (c.box.r - c.box.l) / x.screenW);
        };
        note(m);

        // FUSE's longest line, as a bubble.
        await page.evaluate((t) => {
          void (window as G).__game.fuse.say(t, { hold: 0 });
        }, LONGEST);
        await waitFrames(page, 6);
        const mc = await measure(page);
        problems.push(...cardProblems(mc, `${id} caption`));
        note(mc);
        await page.evaluate(() => (window as G).__game.fuse.hush());

        // The gem chip: a gem picked up from the tray.
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const k = ob.width / 1920;
        // Every gem in the tray: its chip.
        for (const s0 of L.tray) {
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
          await waitFrames(page, 6);
          const mt = await measure(page);
          problems.push(...cardProblems(mt, `${id} chip ${s0.gem}`));
          note(mt);
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
          await waitFrames(page, 4);
        }

        // The verdict: Strike on the bare board.
        await page.locator('[data-action="strike"]').tap();
        await waitFrames(page, 4);
        const sure = page.locator('.lr-confirm .lr-gold-button');
        if (await sure.isVisible()) await sure.tap();
        await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 15_000 });
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await waitFrames(page, 6);
        const mv = await measure(page);
        problems.push(...cardProblems(mv, `${id} verdict`));
        note(mv);

        table.push(
          `${id.padEnd(14)} board ${(m.hShare * 100).toFixed(0)}%H ${(m.wShare * 100).toFixed(0)}%W · chrome ${(m.chromeShare * 100).toFixed(1)}% · widest card ${(widest * 100).toFixed(0)}% of screen`,
        );
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      console.log(`\n${vp.name} ${vp.width}×${vp.height}\n${table.join('\n')}`);
      expect(problems).toEqual([]);
    });
  });
}
