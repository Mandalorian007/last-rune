import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { type Cell, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, settled, waitFrames } from './helpers';

// port-altar-3: the altar's right column lives on the chrome's layout regions, so on every
// altar and phone nothing in it touches anything else. At first meeting (the arrival card up),
// at open, while FUSE speaks, with a gem in hand and at the verdict: no two of the cards, FUSE's
// line, the title, the tray gems and their counts, the Gives/Needs labels, the sockets, Strike
// and the rail buttons overlap, and every card's text is at least 14 CSS px.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
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

const LINE =
  "That one's a Splitter. Charge goes in one side and comes out the two beside it, half each.";
const MEASURED =
  '.lr-altar-need, .lr-altar-lane, .lr-altar-head, .tc-caption, .tc-region > [data-action]';

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
      if (el.textContent?.trim()) add(el.className, 'card', el);
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

function overlaps(list: Part[]): string[] {
  const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const out: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.group === b.group && a.group !== 'card') continue;
      if (hit(a.box, b.box)) out.push(`${a.what} × ${b.what}`);
    }
  return out;
}

async function check(page: Page, id: MachineId, label: string, problems: string[]) {
  await settled(page, MEASURED);
  const m = await parts(page, puzzleFor(id).blocked);
  for (const o of overlaps(m.parts)) problems.push(`${label}: ${o}`);
  for (const s of m.small) problems.push(`${label}: card text ${s}`);
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
      deviceScaleFactor: 1,
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
  });
}
