import { LINES, wordCount } from '../../games/last-rune/content/lines';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { expect, type Page, test } from './fixtures';
import { DEV_URL, settled, waitFrames } from './helpers';

// mobile-2: the phone layout's hard budgets, on every altar, at the two tightest real phone
// viewports (browser bars showing; the iPhone's notch insets emulated):
//  1. Board first: the board with its storm, machines and gauges takes ≥55% of the usable
//     height and ≥45% of the usable width (or ≥75% of the height, see HEIGHT_BOUND).
//  2. Chrome (HUD, action buttons, title) covers ≤20% of the usable area.
//  3. Transient cards (hint, gem chip, verdict, FUSE's bubble) are each ≤⅓ of the screen wide
//     and ≤3 lines, and none of them, nor any chrome, sits over the board. (port-altar-3: cards in
//     the chrome's card lane are bounded by their region, capped and scrolled; their width and
//     lines are not budgeted here, and altar-column.spec checks they touch nothing.)
//  4. The page never scrolls, and no text is cut off (no ellipsis, line clamp or clipped
//     overflow on anything in the overlay, D-027).
// mobile-3-board (D-040):
//  5. Socket pitch per board size (PITCH_MIN): the board is framed, not shrunk to fit chrome.
//  6. Gives/Needs cards sit over no socket (port-altar-3: the board fills its region, so a card
//     may stand on the slab's rim) and clear of each other; the Capacitor
//     read-out, the verdict, the hint and FUSE's bubble sit over neither the board nor a card;
//     the hint is one line.
// mobile-4-board (D-040 gate review 1), on four phones:
//  7. Every gauge (orb, cabinet) and Gives/Needs card stands ≥4 px inside the play area (the
//     safe-area insets and the side bars).
//  8. A held gem and its ↻ badge stay on screen and off the altar title; the gem chip never
//     covers the tray or its counts; the hint is never cut and never runs under Strike.
//  9. Blocked cells are not sockets on phones: no mark is drawn on them (socket-looks.test.ts
//     covers the rule; this checks the live marks).
// mobile-5-board (D-040 gate review 2), on four phones:
// 10. The board fills the height: board, gauges and cards take ≥ HSHARE_MIN of the app's
//     height (85% where the phone allows it), and the pitch floors are raised (PITCH_MIN).
// 11. Every socket stands on the hugged slab (socket-looks.test.ts checks the shape against
//     each layout; here, the live layout's sockets fall inside the slab's rect).
// 12. Text floors: Gives/Needs numbers ≥15 px, every other board label, gem count and the
//     hint ≥13 px (rendered size, CSS px). The hint may wrap to two lines at 13 px; in a
//     lane under 150 px a gem chip may take five lines and the verdict six.
// 13. One rotate control: no ↻ chip on a phone; the rail's Turn lights up for a placed turner.
// 14. Strike stands ≥12 px in from the app's right edge.
// 15. The valid-socket rings show while a gem is held and clear once it is placed.

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
  // mobile-5-board: raised to what the fill-width altar reaches (log: mobile-5-board.md).
  iphone: [57, 37, 28.5],
  se: [43, 32.5, 25],
  promax: [66, 43, 32.5],
  android: [62, 40, 30.5],
};
/**
 * Least board height share (board + gauges + cards over the app height), per phone. 85% is
 * the goal; 6×4 boards with west/east gauges are width-bound (two 66 px gutters and the tray
 * column), so the floor is what they reach (mobile-5-board log).
 */
const HSHARE_MIN: Record<(typeof PHONES)[number]['name'], number> = {
  iphone: 0.78,
  se: 0.58,
  promax: 0.8,
  android: 0.85,
};
/** Rendered text floors, CSS px (mobile-5-board). */
const TEXT_MIN = { number: 15, label: 13 };
/** Strike's clearance from the app's right edge, CSS px. */
const STRIKE_IN = 12;
const pitchClass = (cols: number) => (cols <= 6 ? 0 : cols <= 8 ? 1 : 2);
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
    const ov = document
      .querySelector<HTMLElement>('.tc-layer[data-layer="hud"]')!
      .getBoundingClientRect();
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
    // dense-board-2: carved edge rows/columns trimmed from a dense phone fit are not slab.
    const sp = L.span ?? { x0: 0, y0: 0, x1: L.cols - 1, y1: L.rows - 1 };
    const slab: Box = {
      l: X(L.left + sp.x0 * L.pitch),
      t: Y(L.top + sp.y0 * L.pitch),
      r: X(L.right - (L.cols - 1 - sp.x1) * L.pitch),
      b: Y(L.frontBottom - (L.rows - 1 - sp.y1) * L.pitch),
    };
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
      // Phones: the rail buttons in the chrome's regions (altar-chrome.ts).
      '.tc-region > [data-action]',
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
    const cards: { name: string; box: Box; lines: number; text: string; lane: boolean }[] = [];
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
          lane: !!el.closest('.tc-layer[data-layer="layout"]'),
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
    // Rendered text sizes: the computed size is CSS px (one overlay, no transform; ws/one-overlay).
    const textMin: { sel: string; px: number; text: string }[] = [];
    for (const [sel, kind] of [
      ['.lr-altar-need .lr-need-row b', 'number'],
      ['.lr-altar-need *', 'label'],
      ['.lr-altar-need', 'label'],
      ['.lr-altar-count', 'label'],
      ['.lr-altar-count *', 'label'],
      ['.lr-altar-hint', 'label'],
      ['.lr-altar-hint *', 'label'],
    ] as const) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        if (!own || !shown(el)) continue;
        const px = Number.parseFloat(getComputedStyle(el).fontSize);
        textMin.push({ sel: kind, px, text: el.textContent?.trim().slice(0, 24) ?? '' });
      }
    }
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
      textMin,
      turnActive: !!document.querySelector('.lr-altar-turnbtn[data-active]:not(:disabled)'),
      sockets: (() => {
        const out: (Box & { x: number; y: number })[] = [];
        for (let y = 0; y < L.rows; y++)
          for (let x = 0; x < L.cols; x++) {
            const cx = L.left + L.margin + L.pitch * (x + 0.5);
            const cy = L.top + L.margin + L.pitch * (y + 0.5);
            const r = L.pitch * 0.36;
            out.push({ x, y, l: X(cx - r), r: X(cx + r), t: Y(cy - r), b: Y(cy + r) });
          }
        return out;
      })(),
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
    if (c.lane) {
      if (hit(c.box, m.slab)) out.push(`${label}: ${c.name} over the board "${c.text}"`);
      continue;
    }
    if (w > m.screenW / 3 + 1) out.push(`${label}: ${c.name} ${w.toFixed(0)}px wide "${c.text}"`);
    // The board takes the width from the column (mobile-5-board): in a lane under 150 px a gem
    // chip may take five lines and the verdict six (each has the lane's height to itself).
    const maxLines = w >= 150 || c.name === 'hint' ? 3 : c.name === 'verdict' ? 6 : 5;
    if (c.lines > maxLines) out.push(`${label}: ${c.name} ${c.lines} lines "${c.text}"`);
    if (hit(c.box, m.slab)) out.push(`${label}: ${c.name} over the board "${c.text}"`);
    if (m.labels.some((b) => hit(c.box, b)))
      out.push(`${label}: ${c.name} over a Gives/Needs card "${c.text}"`);
    if (c.name === 'hint' && c.lines > 2) out.push(`${label}: hint ${c.lines} lines "${c.text}"`);
  }
  // Blocked cells are solid slab on phones (no socket is drawn there), so a card may sit on one.
  const blocked = puzzleFor(label.split(' ')[0] as Parameters<typeof puzzleFor>[0]).blocked;
  const open = m.sockets.filter((s) => !blocked.some((c) => c.x === s.x && c.y === s.y));
  m.labels.forEach((b, i) => {
    if (open.some((s) => hit(b, s))) out.push(`${label}: Gives/Needs card ${i} over a socket`);
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
  // mobile-5-board: one rotate control on phones, the rail's Turn; no ↻ chip on the gem.
  if (m.badge) out.push(`${label}: ↻ chip shown on a phone`);
  if (m.strike && m.usable.r - m.strike.r < STRIKE_IN - 0.5)
    out.push(`${label}: Strike ${(m.usable.r - m.strike.r).toFixed(1)}px from the edge`);
  for (const t of m.textMin) {
    const min = TEXT_MIN[t.sel as keyof typeof TEXT_MIN];
    // (0.25 px: the text scale is rounded through calc().)
    if (t.px < min - 0.25) out.push(`${label}: ${t.sel} text ${t.px.toFixed(1)}px "${t.text}"`);
  }
  // (A carved cell is no socket on a phone, and may lie in a trimmed edge: dense-board-2.)
  for (const s of open)
    if (s.l < m.slab.l || s.r > m.slab.r || s.t < m.slab.t || s.b > m.slab.b)
      out.push(`${label}: a socket hangs off the slab`);
  if (m.tip && m.tray.some((t) => hit(m.tip!, t))) out.push(`${label}: gem chip over the tray`);
  if (m.hint) {
    if (m.hint.cut) out.push(`${label}: hint cut off "${m.hint.text}"`);
    if (m.strike && hit(m.hint.box, m.strike)) out.push(`${label}: hint under Strike`);
  }
  return out;
}

/** What `measure` reads: labels, cards, caption, lane, rails and HUD. */
const MEASURED =
  '.lr-altar-need, .lr-altar-tip:not([hidden]), .lr-altar-verdict:not([hidden]), .tc-caption:not([hidden]), .lr-altar-lane, .lr-altar-count, .tc-region > [data-action], .tc-region > .lr-altar-turnbtn, .lr-hud button';

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
        await settled(page, MEASURED);
        const m = await measure(page);
        const wMin = m.hShare >= HEIGHT_BOUND ? 0 : 0.45;
        if (m.hShare < HSHARE_MIN[vp.name] - 0.005)
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
        await settled(page, MEASURED);
        const mc = await measure(page);
        problems.push(...cardProblems(mc, `${id} caption`));
        note(mc);
        await page.evaluate(() => (window as G).__game.fuse.hush());

        // The gem chip: a gem picked up from the tray.
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
        const k = ob.width / 1920;
        // Every gem in the tray: its chip.
        for (const s0 of L.tray) {
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
          await settled(page, MEASURED);
          const mt = await measure(page);
          problems.push(...cardProblems(mt, `${id} chip ${s0.gem}`));
          note(mt);
          await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
          await waitFrames(page, 4);
        }

        // A turnable gem set down: Turn lit on the rail, the rings gone, the hint.
        const turner = L.tray.find((t) => ['bend', 'gate', 'split'].includes(t.gem));
        if (turner) {
          const pz = puzzleFor(id);
          const taken = (x: number, y: number) =>
            [...pz.blocked, ...pz.fixed.map((f) => f.cell)].some((c) => c.x === x && c.y === y);
          // The legal ring (mobile-6-board): one steady look on every socket the gem may go in.
          const hum = (x: M) => x.marks.filter((k) => k.state === 'legal').length;
          // Nothing in hand to start (Esc drops a gem the chip taps left held).
          if (await page.evaluate(() => !!(window as G).__altarView.held)) {
            await page.keyboard.press('Escape');
            await waitFrames(page, 3);
          }
          const before = hum(await measure(page));
          let heldHum = 0;
          let firstHum = -1;
          let placed = false;
          for (let y = 0; y < L.rows && !placed; y++)
            for (let x = 0; x < L.cols && !placed; x++) {
              if (taken(x, y)) continue;
              await page.touchscreen.tap(ob.x + turner.x * k, ob.y + turner.y * k);
              await settled(page, MEASURED);
              const nowHum = hum(await measure(page));
              if (firstHum < 0) firstHum = nowHum;
              heldHum = Math.max(heldHum, nowHum);
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
          await settled(page, MEASURED);
          const mp = await measure(page);
          problems.push(...cardProblems(mp, `${id} placed ${turner.gem}`));
          if (!mp.turnActive) problems.push(`${id}: Turn not lit for the placed ${turner.gem}`);
          // The rings: shown while held, gone once the gem is down (a mark or two for the
          // tapped gem and the wire's next socket may stay).
          if (heldHum <= before) problems.push(`${id}: no valid-socket rings while held`);
          // On the bare board every open socket is legal, and each wears the ring.
          let open = 0;
          for (let y = 0; y < L.rows; y++)
            for (let x = 0; x < L.cols; x++) if (!taken(x, y)) open++;
          if (firstHum !== open) problems.push(`${id}: ${firstHum} rings for ${open} open sockets`);
          if (hum(mp) > before + 2)
            problems.push(`${id}: ${hum(mp) - before} rings left after placing`);
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
        await settled(page, MEASURED);
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
