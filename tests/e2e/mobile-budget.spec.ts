import { expect, type Page, test } from '@playwright/test';
import { LINES, wordCount } from '../../games/last-rune/content/lines';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
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
// mobile-3-board (D-040):
//  5. Socket pitch per board size (PITCH_MIN): the board is framed, not shrunk to fit chrome.
//  6. Gives/Needs cards stand ≥8 px clear of the board and of each other; the Capacitor
//     read-out, the verdict, the hint and FUSE's bubble sit over neither the board nor a card;
//     the hint is one line.
// mobile-4-board (D-040 gate review 1), on four phones:
//  7. Every gauge (orb, cabinet) and Gives/Needs card stands ≥4 px inside the play area (the
//     safe-area insets and the side bars).
//  8. A held gem and its ↻ badge stay on screen and off the altar title; the gem chip never
//     covers the tray or its counts; the hint is never cut and never runs under Strike.
//  9. Blocked cells are not sockets on phones: no mark is drawn on them (socket-looks.test.ts
//     covers the rule; this checks the live marks).

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

/**
 * Square and tall boards are bound by the phone's height: their width share tops out near usable
 * height ÷ usable width (340 ÷ 750 = 45% on the iPhone with its notch insets) less the room the
 * storm and machines take. A board that already takes ≥75% of the height is exempt from the
 * width rule (PM, mobile-2).
 */
const HEIGHT_BOUND = 0.75;

/** Least socket pitch, CSS px, by board class (6×4, 8×6, 10×8), per phone (mobile-3-board). */
const PITCH_MIN: Record<(typeof PHONES)[number]['name'], [number, number, number]> = {
  iphone: [44, 38, 30],
  se: [39.6, 34.2, 27],
  promax: [44, 38, 30],
  android: [44, 38, 30],
};
const pitchClass = (cols: number) => (cols <= 6 ? 0 : cols <= 8 ? 1 : 2);
/** A Gives/Needs card's clearance from the board, CSS px. */
const LABEL_CLEAR = 8;
/** Gauges and cards stand this far inside the play area, CSS px (mobile-4-board). */
const EDGE_IN = 4;

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
    const labels: Box[] = [];
    const labelText: string[] = [];
    for (const el of document.querySelectorAll('.lr-altar-need'))
      if (shown(el)) {
        labels.push(box(el.getBoundingClientRect()));
        labelText.push(el.textContent?.trim() ?? '');
      }
    for (const b of labels) grow(b);
    const caps: Box[] = [];
    for (const el of document.querySelectorAll('.lr-altar-cap'))
      if (shown(el)) caps.push(box(el.getBoundingClientRect()));
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
    // The play area: the canvas between the side bars, inside the safe-area insets.
    const band = L.phone!;
    const play: Box = {
      l: Math.max(usable.l, X(band.padL)),
      r: Math.min(usable.r, X(1920 - band.padL)),
      t: Math.max(usable.t, ov.top),
      b: Math.min(usable.b, ov.bottom),
    };
    // Gauges as drawn: the storm's orb (with its halo), a machine's cabinet.
    const gauges: Box[] = [];
    {
      const s = L.storm;
      const r = 0.29 * s.size;
      const cy = s.y - 0.048 * s.size;
      gauges.push({ l: X(s.x - r), r: X(s.x + r), t: Y(cy - r), b: Y(cy + r) });
    }
    for (const m of L.machines)
      gauges.push({
        l: X(m.x - 0.46 * m.size),
        r: X(m.x + 0.46 * m.size),
        t: Y(m.y - 0.46 * m.size),
        b: Y(m.y + 0.35 * m.size),
      });
    const one = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      return el && shown(el) ? box(el.getBoundingClientRect()) : null;
    };
    // The gem in hand as drawn (lifted 16 px and 7% bigger; gems.ts).
    const view = (window as unknown as { __altarView: { held: G } }).__altarView;
    const hd = view?.held;
    let held: Box | null = null;
    if (hd) {
      const size = (hd.size ?? L.gemSize * 1.05) * 1.07;
      const cy = hd.y - 16 * (hd.snapped ? 0.6 : 1);
      held = {
        l: X(hd.x - size / 2),
        r: X(hd.x + size / 2),
        t: Y(cy - size / 2),
        b: Y(cy + size / 2),
      };
    }
    const tray: Box[] = L.tray.map((t) => ({
      l: X(t.x - t.size / 2),
      r: X(t.x + t.size / 2),
      t: Y(t.y - t.size / 2),
      b: Y(t.y + t.size / 2),
    }));
    for (const el of document.querySelectorAll('.lr-altar-count'))
      if (shown(el)) tray.push(box(el.getBoundingClientRect()));
    const hintEl = document.querySelector<HTMLElement>('.lr-altar-hint');
    const hint =
      hintEl && shown(hintEl) && hintEl.textContent?.trim()
        ? {
            box: box(hintEl.getBoundingClientRect()),
            cut: hintEl.scrollWidth > hintEl.clientWidth + 1,
            text: hintEl.textContent.trim(),
          }
        : null;
    // Marks drawn on blocked cells (phones draw none: the slab is solid there).
    const marks = (view as unknown as { marks: { col: number; row: number; state: string }[] })
      .marks;
    return {
      play,
      labelText,
      gauges,
      held,
      title: one('.lr-altar-title h2'),
      badge: one('.lr-altar-turnmark'),
      tip: one('.lr-altar-tip'),
      tray,
      hint,
      strike: one('[data-action="strike"]'),
      marks: marks.map((k) => ({ x: k.col, y: k.row, state: k.state })),
      slab,
      board,
      usable,
      labels,
      caps,
      pitch: L.pitch * k,
      cols: L.cols,
      dims: `${L.cols}×${L.rows}`,
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
    if (m.labels.some((b) => hit(c.box, b)))
      out.push(`${label}: ${c.name} over a Gives/Needs card "${c.text}"`);
    if (c.name === 'hint' && c.lines > 1) out.push(`${label}: hint ${c.lines} lines "${c.text}"`);
  }
  const grown = (b: Box, d: number): Box => ({ l: b.l - d, t: b.t - d, r: b.r + d, b: b.b + d });
  m.labels.forEach((b, i) => {
    if (hit(b, grown(m.slab, LABEL_CLEAR - 1)))
      out.push(`${label}: Gives/Needs card ${i} within ${LABEL_CLEAR}px of the board`);
    if (m.labels.some((o, j) => j > i && hit(b, o)))
      out.push(`${label}: Gives/Needs cards ${i} overlap`);
    if (m.chrome.some((c) => hit(b, c.box)))
      out.push(`${label}: Gives/Needs card ${i} under chrome`);
  });
  for (const c of m.caps) {
    if (hit(c, m.slab)) out.push(`${label}: Capacitor read-out over the board`);
    if (m.labels.some((b) => hit(c, b))) out.push(`${label}: Capacitor read-out over a card`);
  }
  for (const c of m.chrome) if (hit(c.box, m.slab)) out.push(`${label}: ${c.name} over the board`);
  if (m.scrolls) out.push(`${label}: page scrolls`);
  for (const c of m.clipped) out.push(`${label}: text cut off: ${c}`);
  // mobile-4-board.
  const inside = (b: Box, d: number) =>
    b.l >= m.play.l + d - 0.5 &&
    b.r <= m.play.r - d + 0.5 &&
    b.t >= m.play.t + d - 0.5 &&
    b.b <= m.play.b - d + 0.5;
  m.gauges.forEach((g, i) => {
    if (!inside(g, EDGE_IN))
      out.push(
        `${label}: gauge ${i} within ${EDGE_IN}px of the edge (${[g.l - m.play.l, g.t - m.play.t, m.play.r - g.r, m.play.b - g.b].map((v) => v.toFixed(1)).join(' ')})`,
      );
  });
  m.labels.forEach((b, i) => {
    if (!inside(b, EDGE_IN))
      out.push(
        `${label}: Gives/Needs card "${m.labelText[i]}" within ${EDGE_IN}px of the edge (${[b.l - m.play.l, b.t - m.play.t, m.play.r - b.r, m.play.b - b.b].map((v) => v.toFixed(1)).join(' ')})`,
      );
  });
  const onScreen = (b: Box) =>
    b.l >= m.usable.l && b.r <= m.usable.r && b.t >= m.usable.t && b.b <= m.usable.b;
  if (m.held && m.title && hit(m.held, m.title)) out.push(`${label}: held gem over the title`);
  if (m.held && !onScreen(m.held)) out.push(`${label}: held gem off screen`);
  if (m.badge && m.title && hit(m.badge, m.title)) out.push(`${label}: ↻ badge over the title`);
  if (m.badge && !onScreen(m.badge)) out.push(`${label}: ↻ badge off screen`);
  if (m.tip && m.tray.some((t) => hit(m.tip!, t))) out.push(`${label}: gem chip over the tray`);
  if (m.hint) {
    if (m.hint.cut) out.push(`${label}: hint cut off "${m.hint.text}"`);
    if (m.strike && hit(m.hint.box, m.strike)) out.push(`${label}: hint under Strike`);
  }
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
        const pMin = PITCH_MIN[vp.name][pitchClass(m.cols)];
        if (m.pitch < pMin - 0.05)
          problems.push(`${id}: ${m.dims} pitch ${m.pitch.toFixed(1)}px < ${pMin}px`);
        problems.push(...cardProblems(m, `${id} open`));
        const blocked = puzzleFor(id).blocked;
        for (const k of m.marks)
          if (blocked.some((b) => b.x === k.x && b.y === k.y))
            problems.push(`${id}: ${k.state} mark on blocked cell ${k.x},${k.y}`);
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

        // A turnable gem set down: the ↻ badge on it, and the hint with (or without) its ↻.
        const turner = L.tray.find((t) => ['bend', 'gate', 'split'].includes(t.gem));
        if (turner) {
          const pz = puzzleFor(id);
          const taken = (x: number, y: number) =>
            [...pz.blocked, ...pz.fixed.map((f) => f.cell)].some((c) => c.x === x && c.y === y);
          let placed = false;
          for (let y = 0; y < L.rows && !placed; y++)
            for (let x = 0; x < L.cols && !placed; x++) {
              if (taken(x, y)) continue;
              await page.touchscreen.tap(ob.x + turner.x * k, ob.y + turner.y * k);
              await waitFrames(page, 3);
              const cx = L.left + L.margin + L.pitch * (x + 0.5);
              const cy = L.top + L.margin + L.pitch * (y + 0.5);
              await page.touchscreen.tap(ob.x + cx * k, ob.y + cy * k);
              await waitFrames(page, 4);
              placed = await page.evaluate(() => !(window as G).__altarView.held);
              if (!placed) {
                await page.touchscreen.tap(ob.x + turner.x * k, ob.y + turner.y * k);
                await waitFrames(page, 3);
              }
            }
          await waitFrames(page, 6);
          const mp = await measure(page);
          problems.push(...cardProblems(mp, `${id} placed ${turner.gem}`));
          if (!mp.badge) problems.push(`${id}: no ↻ badge on the placed ${turner.gem}`);
          await page.locator('[data-action="clear"]').tap();
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

        const sideW = Math.max(
          0,
          ...m.labels.map((b, i) => (m.labelText[i]!.startsWith('Gives') ? b.r - b.l : 0)),
        );
        table.push(
          `${id.padEnd(14)} ${m.dims.padEnd(5)} pitch ${m.pitch.toFixed(1)}px · Gives card ${sideW.toFixed(0)}px · board ${(m.hShare * 100).toFixed(0)}%H ${(m.wShare * 100).toFixed(0)}%W · chrome ${(m.chromeShare * 100).toFixed(1)}% · widest card ${(widest * 100).toFixed(0)}% of screen`,
        );
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      console.log(`\n${vp.name} ${vp.width}×${vp.height}\n${table.join('\n')}`);
      expect(problems).toEqual([]);
    });
  });
}
