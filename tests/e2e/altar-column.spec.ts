import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { trayRemaining } from '../../games/last-rune/rules';
import { type Cell, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from './altar-audit';
import { DEV_URL, settled, waitFrames } from './helpers';
import { SHORT_PHONE } from './phones';

// port-altar-3: the altar's right column lives on the chrome's layout regions, so on every
// altar and phone nothing in it touches anything else. At first meeting (the arrival card up),
// at open, while FUSE speaks, with a gem in hand and at the verdict: no two of the cards, FUSE's
// line, the title, the tray gems and their counts, the Gives/Needs labels, the sockets, Strike
// and the rail buttons overlap, and every card's text is at least 14 CSS px. Every gem, teach
// and how-to card fits its lane with no scrolling, and the verdict shows in full: its "Try:" line
// sits inside the lane, not clipped and not scrolled to (D-027). card-fit: every card in the
// column (the how-to line, the dot legend and the Capacitor read-outs too) keeps its text in
// full and stays inside the lane and the column, also mid-play where cards stack (the legend
// lit by half a design, a gem's card with the Turn line under it).
// teach-overlay: the arrival card (and a pinned rule card) is a panel over the column on phones.
// It may lie over the tray, the title and the lane, never over a socket, a Gives/Needs label or
// a button, and it stays on screen; it is held open here (no idle fold) while it is measured.
// The short phone (852×270, a browser's bars on screen) joins the four.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
  SHORT_PHONE,
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}
interface Part {
  what: string;
  group: string;
  box: Box;
}

test.setTimeout(400_000);

/** Set COLUMN_SHOTS to a folder (docs/design/screens/local/…) to save what the checks saw. */
const SHOTS = process.env.COLUMN_SHOTS ?? '';

const BAY_FIRST_TRY = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

const LINE =
  "That one's a Splitter. Charge goes in one side and comes out the two beside it, half each.";
const MEASURED =
  '.lr-altar-need, .lr-altar-lane, .lr-altar-head, .tc-caption, .tc-region > [data-action]';

async function boot(page: Page, inset: number) {
  // The card stays open while it is measured (teach-overlay folds it after a few idle seconds).
  await page.addInitScript(() => Object.assign(window, { __lrCardIdle: 1e9 }));
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

/** Everything in and around the column that is on screen now, client px. */
async function parts(page: Page, blocked: Cell[]): Promise<{ parts: Part[]; small: string[] }> {
  return page.evaluate((blocked) => {
    const L = (window as unknown as { __altarLayout: AltarLayout }).__altarLayout;
    const ov = document
      .querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!
      .getBoundingClientRect();
    const k = ov.width / 1920;
    const X = (x: number) => ov.left + x * k;
    const Y = (y: number) => ov.top + y * k;
    const shown = (el: Element) => {
      if (el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        cs.display !== 'none' &&
        cs.visibility !== 'hidden' &&
        Number(cs.opacity) >= 0.05
      );
    };
    const out: { what: string; group: string; box: Box }[] = [];
    const add = (what: string, group: string, el: Element) => {
      if (!shown(el)) return;
      const r = el.getBoundingClientRect();
      out.push({ what, group, box: { l: r.left, t: r.top, r: r.right, b: r.bottom } });
    };
    for (const el of document.querySelectorAll('.lr-altar-lane > *'))
      if (el.textContent?.trim())
        add(el.className, el.hasAttribute('data-over') ? 'over' : 'card', el);
    for (const el of document.querySelectorAll('.tc-caption')) add('FUSE', 'card', el);
    for (const el of document.querySelectorAll('.lr-altar-title h2')) add('title', 'title', el);
    for (const el of document.querySelectorAll('.lr-altar-holding')) add('holding', 'title', el);
    for (const el of document.querySelectorAll('.lr-altar-need')) add('label', 'label', el);
    for (const el of document.querySelectorAll('.tc-region > [data-action], .lr-altar-turnbtn'))
      add(el.getAttribute('data-action') ?? 'turn', 'button', el);
    // Each tray gem and its count badge are one thing; gems never touch each other.
    L.tray.forEach((t, i) => {
      const s = t.size * 0.42;
      out.push({
        what: `tray ${t.gem}`,
        group: `tray${i}`,
        box: { l: X(t.x - s), r: X(t.x + s), t: Y(t.y - s), b: Y(t.y + s) },
      });
    });
    document.querySelectorAll('.lr-altar-count').forEach((el, i) => {
      add('count', `tray${i}`, el);
    });
    // The sockets (their rings), but for solid stone.
    for (let y = 0; y < L.rows; y++)
      for (let x = 0; x < L.cols; x++) {
        if (blocked.some((c) => c.x === x && c.y === y)) continue;
        const cx = L.left + L.margin + L.pitch * (x + 0.5);
        const cy = L.top + L.margin + L.pitch * (y + 0.5);
        const r = L.pitch * 0.36;
        out.push({
          what: `socket ${x},${y}`,
          group: 'socket',
          box: { l: X(cx - r), r: X(cx + r), t: Y(cy - r), b: Y(cy + r) },
        });
      }
    // Text in the cards: at least 14 CSS px, in the game's serif.
    const small: string[] = [];
    const cards = document.querySelectorAll<HTMLElement>(
      '.lr-altar-lane > :is(.lr-altar-tip, .lr-altar-verdict) *, .lr-altar-lane > :is(.lr-altar-tip, .lr-altar-verdict), .tc-caption-text',
    );
    for (const el of cards) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!own || !shown(el) || el.closest('.lr-info-foot')) continue;
      const cs = getComputedStyle(el);
      const px = Number.parseFloat(cs.fontSize);
      if (px < 13.75) small.push(`${px.toFixed(1)}px "${el.textContent?.trim().slice(0, 24)}"`);
      if (/sans-serif|system-ui|Arial|Helvetica/i.test(cs.fontFamily.split(',')[0] ?? ''))
        small.push(`sans "${el.textContent?.trim().slice(0, 24)}"`);
    }
    return { parts: out, small };
  }, blocked);
}

/**
 * Cards that do not fit (card-fit): any card in the lane (the gem or teach card, the verdict,
 * the how-to line or the dot legend, a Capacitor read-out) or FUSE's docked line whose text runs
 * past its edge, scrolled or not, or that pokes out of the lane or the cards region (the lane
 * cuts off what pokes out). The verdict's Try line shows in full.
 */
async function unfit(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const laneEl = document.querySelector<HTMLElement>('.lr-altar-lane');
    const lane = laneEl?.getBoundingClientRect();
    const region = laneEl?.closest('.tc-region')?.getBoundingClientRect();
    const shown = (el: HTMLElement) => {
      if (el.closest('[hidden]') || el.offsetHeight === 0) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) >= 0.05;
    };
    const cards = [
      ...document.querySelectorAll<HTMLElement>('.lr-altar-lane > *'),
      ...document.querySelectorAll<HTMLElement>('.tc-region > .tc-caption[data-docked]'),
    ];
    for (const el of cards) {
      if (!shown(el) || !el.textContent?.trim()) continue;
      const what = el.className.split(' ')[0];
      const text = el.textContent.trim().slice(0, 40);
      // Words inside the card run past their own box (a label under a button, a nowrap row).
      for (const inner of el.querySelectorAll<HTMLElement>('*')) {
        const own = [...inner.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        if (!own || !shown(inner) || getComputedStyle(inner).display === 'inline') continue;
        if (inner.scrollWidth > inner.clientWidth + 1)
          out.push(`${what} words past their box "${inner.textContent?.trim().slice(0, 30)}"`);
      }
      const box = el.getBoundingClientRect();
      // FUSE's line does not scroll (its tail hangs below it): its text stays inside its card.
      const words = el.querySelector<HTMLElement>('.tc-caption-text');
      if (words) {
        const r = words.getBoundingClientRect();
        if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
          out.push(`${what} text past its card "${text}"`);
      } else if (el.scrollHeight > el.clientHeight + 1 || el.scrollTop > 0)
        out.push(`${what} clips (${el.scrollHeight} > ${el.clientHeight}) "${text}"`);
      if (!words && el.scrollWidth > el.clientWidth + 1)
        out.push(`${what} too wide (${el.scrollWidth} > ${el.clientWidth}) "${text}"`);
      const inLane = el.parentElement === laneEl;
      if (el.hasAttribute('data-over')) {
        if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight)
          out.push(`${what} panel off screen "${text}"`);
        continue;
      }
      for (const [name, r] of [
        ['lane', inLane ? lane : undefined],
        ['column', region],
      ] as const)
        if (
          r &&
          (box.top < r.top - 0.5 ||
            box.bottom > r.bottom + 0.5 ||
            box.left < r.left - 0.5 ||
            box.right > r.right + 0.5)
        )
          out.push(`${what} outside the ${name} "${text}"`);
      const tryLine = el.querySelector<HTMLElement>('.lr-verdict-hint');
      if (tryLine) {
        const r = tryLine.getBoundingClientRect();
        if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.height === 0)
          out.push(`Try line not fully shown "${tryLine.textContent?.slice(0, 40)}"`);
      }
    }
    return out;
  });
}

/**
 * polish-11 (D-040 add. 12, A): the words on a card, line by line. teach-8's "Again" cards ran
 * a nowrap line off the SE's card ("sends nothin") and clipped the Amplify card's last line at
 * its foot; the card-level checks above missed both because they only met each card's first
 * page, in hall order. Every element in a lane card with words of its own must not scroll (its
 * scroll size within its client box), and every line box of every text node must sit inside
 * the card's visible box (inside its border).
 */
async function cardText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const shown = (el: Element) => {
      if (el.closest('[hidden]')) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) >= 0.05;
    };
    for (const card of document.querySelectorAll<HTMLElement>('.lr-altar-lane > *')) {
      if (!shown(card) || card.offsetHeight === 0 || !card.textContent?.trim()) continue;
      const what = card.className.split(' ')[0];
      const r = card.getBoundingClientRect();
      const cs = getComputedStyle(card);
      const box = {
        l: r.left + Number.parseFloat(cs.borderLeftWidth),
        r: r.right - Number.parseFloat(cs.borderRightWidth),
        t: r.top + Number.parseFloat(cs.borderTopWidth),
        b: r.bottom - Number.parseFloat(cs.borderBottomWidth),
      };
      if (card.scrollHeight > card.clientHeight + 1)
        out.push(`${what} scrolls (${card.scrollHeight} > ${card.clientHeight})`);
      if (card.scrollWidth > card.clientWidth + 1)
        out.push(`${what} scrolls sideways (${card.scrollWidth} > ${card.clientWidth})`);
      for (const el of [card, ...card.querySelectorAll<HTMLElement>('*')]) {
        if (!shown(el)) continue;
        const texts = [...el.childNodes].filter(
          (n): n is Text => n.nodeType === 3 && !!n.textContent?.trim(),
        );
        if (texts.length === 0) continue;
        const words = (el.textContent ?? '').trim().slice(0, 32);
        // Only a box that clips can cut its words; text that spills from one that doesn't (a
        // number chip's glyphs, a button's 44 px hit area) is held by the rect check below.
        const st = getComputedStyle(el);
        if (st.display !== 'inline' && (st.overflowX !== 'visible' || st.overflowY !== 'visible')) {
          if (el.scrollWidth > el.clientWidth + 1)
            out.push(`${what} words wider than their box "${words}"`);
          if (el.scrollHeight > el.clientHeight + 1)
            out.push(`${what} words taller than their box "${words}"`);
        }
        for (const t of texts) {
          const range = document.createRange();
          range.selectNodeContents(t);
          // A text rect is the font's whole em box, about 2 px taller than its 1.25 line: the
          // last line's box may overhang the card's unpadded bottom by that much with every
          // glyph inside (cut words show as a scroll above). Sideways there is no slack.
          const slack = 2;
          for (const q of range.getClientRects()) {
            if (q.width === 0 && q.height === 0) continue;
            if (
              q.left < box.l - 0.5 ||
              q.right > box.r + 0.5 ||
              q.top < box.t - slack ||
              q.bottom > box.b + slack
            ) {
              out.push(`${what} text leaves the card "${t.textContent?.trim().slice(0, 32)}"`);
              break;
            }
          }
        }
      }
    }
    return out;
  });
}

function overlaps(list: Part[]): string[] {
  const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const out: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.group === b.group && a.group !== 'card') continue;
      // The card panel lies over the tray, the title and the lane, never sockets, labels, buttons.
      const [o, u] = a.group === 'over' ? [a, b] : [b, a];
      if (o.group === 'over' && !['socket', 'label', 'button'].includes(u.group)) continue;
      if (hit(a.box, b.box)) out.push(`${a.what} × ${b.what}`);
    }
  return out;
}

async function check(page: Page, id: MachineId, label: string, problems: string[]) {
  await settled(page, MEASURED);
  const m = await parts(page, puzzleFor(id).blocked);
  for (const o of overlaps(m.parts)) problems.push(`${label}: ${o}`);
  for (const s of m.small) problems.push(`${label}: card text ${s}`);
  for (const s of await unfit(page)) problems.push(`${label}: ${s}`);
  for (const s of await cardText(page)) problems.push(`${label}: ${s}`);
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/${page.viewportSize()?.width}-${label.replace(/\W+/g, '-')}.png`,
    });
}

for (const vp of PHONES) {
  test.describe(`column ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 'dpr' in vp ? vp.dpr : 1,
    });
    test(`nothing in the altar column overlaps at ${vp.width}×${vp.height}`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const [at, id] of MACHINE_IDS.entries()) {
        // First meeting: the arrival card is up.
        await page.evaluate(
          ({ solved, id }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.settings.captionSpeed = 'instant';
              d.progress.solved = solved;
              d.puzzles = {};
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
            g.fuse.hush();
          },
          { solved: MACHINE_IDS.slice(0, at) as unknown as string[], id },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await check(page, id, `${id} teach`, problems);

        // The card turned away: the altar at rest.
        for (let i = 0; i < 6; i++) {
          const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
          if ((await next.count()) === 0) break;
          await next.first().tap();
          await waitFrames(page, 3);
        }
        await check(page, id, `${id} open`, problems);

        // FUSE speaks.
        await page.evaluate((t) => void (window as G).__game.fuse.say(t, { hold: 0 }), LINE);
        await check(page, id, `${id} FUSE`, problems);
        await page.evaluate(() => (window as G).__game.fuse.hush());

        // A gem in hand: its card, "Holding", the legal rings.
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
        const k = ob.width / 1920;
        const s0 = L.tray[0]!;
        await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
        await check(page, id, `${id} holding ${s0.gem}`, problems);
        await page.touchscreen.tap(ob.x + s0.x * k, ob.y + s0.y * k);
        await waitFrames(page, 3);

        // The verdict: Strike on the bare board.
        await page.locator('[data-action="strike"]').tap();
        await waitFrames(page, 4);
        const sure = page.locator('.lr-confirm .lr-gold-button');
        if (await sure.isVisible()) await sure.tap();
        await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 15_000 });
        await check(page, id, `${id} verdict`, problems);
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
      }
      expect(problems).toEqual([]);
    });

    test(`every page of every arrival card fits, in play order, at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      // polish-11 (D-040 add. 12, A): each altar met as a player meets it (everything before it
      // in play order solved, nothing taught out of order), so its "taught before, first in the
      // hand" pages (Roof Array's Capacitor, Press Unit 4's Amplify) come up. Every page of the
      // card is checked, not only the first.
      await boot(page, vp.inset);
      const problems: string[] = [];
      const order = playOrder();
      let pages = 0;
      for (const [at, id] of order.entries()) {
        await page.evaluate(
          ({ solved, id }) => {
            const g = (window as G).__game;
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
            g.fuse.hush();
          },
          { solved: order.slice(0, at) as unknown as string[], id },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        // Under load the card can come up a few frames after the altar.
        await page
          .locator('.lr-altar-tip:not([hidden]) .lr-info-next')
          .first()
          .waitFor({ timeout: 3_000 })
          .catch(() => {});
        for (let i = 0; i < 8; i++) {
          await page.evaluate(() => (window as G).__game.fuse.hush());
          const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
          if ((await next.count()) === 0) break;
          const name = await page.evaluate(
            () =>
              document.querySelector('.lr-altar-tip :is(.lr-info-row, .lr-info-page) > b')
                ?.textContent ?? '?',
          );
          await check(page, id, `${id} card ${i + 1} (${name.trim()})`, problems);
          pages++;
          await next.first().tap();
          await waitFrames(page, 3);
        }
      }
      expect(pages, 'arrival card pages checked').toBeGreaterThan(15);
      expect(problems).toEqual([]);
    });

    test(`no card clips mid-play, cards stacked, at ${vp.width}×${vp.height}`, async ({ page }) => {
      // card-fit: half of each altar's design placed, so a gauge's dot lights and (the dot not
      // told yet) its legend comes up; then the arrival card over it, the altar at rest, and
      // each tray gem in hand with its card. No card in the column clips its text.
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const [at, id] of MACHINE_IDS.entries()) {
        const pz = puzzleFor(id);
        const half = pz.design.intended.slice(0, Math.floor(pz.design.intended.length / 2));
        await page.evaluate(
          ({ solved, id, half }) => {
            const g = (window as G).__game;
            if (g.flow.state === 'puzzle') g.flow.closePuzzle();
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.flags.dotTold = false;
              d.settings.captionSpeed = 'instant';
              d.progress.solved = solved;
              d.puzzles = { [id]: { placements: half, attempts: 0 } };
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
            g.flow.openPuzzle(id);
            g.fuse.hush();
          },
          { solved: MACHINE_IDS.slice(0, at) as unknown as string[], id, half },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await waitFrames(page, 6);
        await check(page, id, `${id} mid teach`, problems);
        for (let i = 0; i < 8; i++) {
          await page.evaluate(() => (window as G).__game.fuse.hush());
          const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
          if ((await next.count()) === 0) break;
          await next.first().tap();
          await waitFrames(page, 3);
        }
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await check(page, id, `${id} mid open`, problems);
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
        const k = ob.width / 1920;
        for (const s of L.tray) {
          if (trayRemaining(pz, half as never, s.gem) <= 0) continue;
          await page.touchscreen.tap(ob.x + s.x * k, ob.y + s.y * k);
          await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, s.gem);
          await page.evaluate(() => (window as G).__game.fuse.hush());
          await check(page, id, `${id} mid holding ${s.gem}`, problems);
          await page.touchscreen.tap(ob.x + s.x * k, ob.y + s.y * k);
          await page.waitForFunction(() => !(window as G).__altarView?.held);
        }
      }
      expect(problems).toEqual([]);
    });

    test(`a long verdict shows its Try line in full at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      // Capacitor Bay's first try (as in the gate shots): two strikes, the breaker trips, and the
      // verdict has its strike line, its cause and a two-line Try. The read-out steps aside.
      await boot(page, vp.inset);
      await page.evaluate(
        ({ solved, placements }) => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.flags.hallIntro = true;
            d.settings.captionSpeed = 'instant';
            d.progress.solved = solved;
            d.puzzles = { 'capacitor-bay': { placements, attempts: 0 } };
          });
          if (g.flow.state !== 'hall') g.flow.continueGame();
          g.flow.openPuzzle('capacitor-bay');
          g.fuse.hush();
        },
        {
          solved: MACHINE_IDS.slice(0, MACHINE_IDS.indexOf('capacitor-bay')) as unknown as string[],
          placements: BAY_FIRST_TRY,
        },
      );
      await expect(page.locator('.lr-altar')).toBeVisible();
      for (let i = 0; i < 6; i++) {
        const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
        if ((await next.count()) === 0) break;
        await next.first().tap();
        await waitFrames(page, 3);
      }
      await page.locator('[data-action="strike"]').tap();
      await expect(page.locator('.lr-altar-verdict')).toContainText('Strike 2: 16.', {
        timeout: 30_000,
      });
      await page.evaluate(() => (window as G).__game.fuse.hush());
      await expect(page.locator('.lr-altar-verdict .lr-verdict-hint')).toContainText('Try:');
      const problems: string[] = [];
      await check(page, 'capacitor-bay', 'capacitor-bay two strikes', problems);
      await expect(page.locator('.lr-altar-lane > .lr-altar-cap')).toBeHidden();
      expect(problems).toEqual([]);
    });
  });
}
