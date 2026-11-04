import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// mobile-7-strike (D-040 addendum 5), on four phones (browser bars showing, the iPhone's notch
// insets emulated):
//  1. Strike says what a tap does, on one line: "Strike (2 left)" before a two-strike run,
//     "Try again" after a fail. It is ≥56 CSS px tall and ≥12 CSS px inside the play area.
//  2. Before Strike each gauge shows a lamp (on or off, no number) that agrees with the path;
//     Strike glows ("ready") when every lamp is lit.
//  3. After a two-strike fail the gauge card stays compact ("Needs 8 · got 16", no per-strike
//     chips); the verdict tells each strike in words ("Got 0, then 16; needs 8 in one strike.").
//  4. An empty-socket fail: title "No charge reached the machine", cause "The charge hit …".
//  5. The solve card covers no gauge and no socket; FUSE's line keeps ≥12 px off it.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

const ORDER = playOrder();
/** Capacitor Bay's first try (capacitor.spec): strike 1 keeps 8, strike 2 lets out 16 into 8. */
const ROW = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

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

async function open(page: Page, id: MachineId, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      // Leave the altar first: leaving saves its placements.
      if (g.flow.state === 'puzzle') g.flow.closePuzzle();
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      if (g.flow.state === 'title') g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
  // Close the arrival card, page by page.
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.lr-altar-tip .lr-info-next');
    if (!(await next.isVisible())) break;
    await next.tap();
    await waitFrames(page, 4);
  }
  await page.evaluate(() => (window as G).__game.fuse.hush());
}

async function strike(page: Page) {
  await page.locator('[data-action="strike"]').tap();
  await waitFrames(page, 4);
  const sure = page.locator('.lr-confirm .lr-gold-button');
  if (await sure.isVisible()) await sure.tap();
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 20_000 });
  await waitFrames(page, 4);
}

/** Strike's box, its word, and whether the word sits on one line. */
async function strikeRead(page: Page) {
  return page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('[data-action="strike"]')!;
    const w = b.querySelector<HTMLElement>('.lr-strike-word');
    const r = b.getBoundingClientRect();
    const app = document.getElementById('app')!.getBoundingClientRect();
    const lines = w ? w.getClientRects().length : 0;
    return {
      word: w?.textContent ?? '',
      lines,
      h: r.height,
      right: Math.min(app.right, window.innerWidth) - r.right,
      bottom: Math.min(app.bottom, window.innerHeight) - r.bottom,
      ready: b.hasAttribute('data-ready'),
    };
  });
}

function strikeProblems(at: string, s: Awaited<ReturnType<typeof strikeRead>>, want: string) {
  const out: string[] = [];
  if (s.word !== want) out.push(`${at}: Strike says "${s.word}", not "${want}"`);
  if (s.lines !== 1) out.push(`${at}: Strike's label runs to ${s.lines} lines`);
  if (s.h < 56 - 0.5) out.push(`${at}: Strike ${s.h.toFixed(1)}px tall`);
  if (s.right < 12 - 0.5) out.push(`${at}: Strike ${s.right.toFixed(1)}px from the right edge`);
  if (s.bottom < 0) out.push(`${at}: Strike off the bottom edge`);
  return out;
}

for (const vp of PHONES) {
  test.describe(`phone strike ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });

    test(`Strike, lamps, verdict and solve card read at a glance (${vp.name})`, async ({
      page,
    }) => {
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
      const problems: string[] = [];

      // 1–2. Capacitor Bay, half a route: Strike says two strikes; lamps agree with the path.
      await open(page, 'capacitor-bay', ROW.slice(0, 3));
      await expect(page.locator('.tc-overlay:not([data-units="css"])')).toHaveAttribute(
        'data-phone',
        '',
      );
      problems.push(...strikeProblems('bay, before', await strikeRead(page), 'Strike (2 left)'));
      const lamps = async () =>
        page.evaluate(() => ({
          on: [...document.querySelectorAll('.lr-altar-need .lr-need-lamp')].map((l) =>
            l.hasAttribute('data-on'),
          ),
          linked: [...(window as G).__altarView.machineLinked] as boolean[],
          digits: [...document.querySelectorAll('.lr-altar-need .lr-need-lamp')].some((l) =>
            /\d/.test(l.textContent ?? ''),
          ),
        }));
      const half = await lamps();
      if (half.on.length !== half.linked.length || half.on.length === 0)
        problems.push(`bay, half: ${half.on.length} lamps for ${half.linked.length} gauges`);
      if (JSON.stringify(half.on) !== JSON.stringify(half.linked))
        problems.push(`bay, half: lamps ${half.on} but path ${half.linked}`);
      if (half.on.some(Boolean)) problems.push('bay, half: a lamp lit with no path to it');
      if (half.digits) problems.push('bay, half: a lamp shows a number');
      if ((await strikeRead(page)).ready) problems.push('bay, half: Strike glows, not ready');

      // The intended solution: every lamp lit, Strike glows.
      await open(page, 'capacitor-bay', puzzleFor('capacitor-bay').design.intended);
      const all = await lamps();
      if (!all.on.length || !all.on.every(Boolean))
        problems.push(`bay, solved: lamps ${all.on} (path ${all.linked})`);
      if (!(await strikeRead(page)).ready) problems.push('bay, solved: Strike not glowing');

      // The first try reaches the second gauge only: its lamp alone is lit, no glow.
      await open(page, 'capacitor-bay', ROW);
      const part = await lamps();
      if (JSON.stringify(part.on) !== JSON.stringify(part.linked) || !part.on.some(Boolean))
        problems.push(`bay, first try: lamps ${part.on} (path ${part.linked})`);
      if (part.on.every(Boolean) === false && (await strikeRead(page)).ready)
        problems.push('bay, first try: Strike glows with a gauge unreached');

      // 3. The two-strike fail: compact card, each strike in words, "Try again".
      await strike(page);
      const v = await page.evaluate(() => ({
        verdict: document.querySelector('.lr-altar-verdict')?.textContent ?? '',
        cards: [...document.querySelectorAll<HTMLElement>('.lr-altar-need')]
          .filter((el) => el.offsetParent)
          // biome-ignore lint/performance/useDomNodeTextContent: the card as laid out, line by line
          .map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
        chips: document.querySelectorAll('.lr-altar-need .lr-need-strikes').length,
        lamps: document.querySelectorAll('.lr-altar-need .lr-need-lamp').length,
      }));
      if (!/Got 0, then 16; needs 8 in one strike\./.test(v.verdict))
        problems.push(`bay fail: verdict "${v.verdict}"`);
      if (/\b\d: \d/.test(v.cards.join('|')) || v.chips)
        problems.push(`bay fail: strike chips on the card "${v.cards.join('|')}"`);
      // One line: "Needs 8 · got 16" (the dot is drawn before "got").
      if (!v.cards.some((c) => /^Needs 8 · ?got 16$/.test(c.replace(/ got/, ' · got'))))
        problems.push(`bay fail: card reads "${v.cards.join('|')}", not "Needs 8 · got 16"`);
      if (v.lamps) problems.push('bay fail: lamps still showing after Strike');
      problems.push(...strikeProblems('bay, after', await strikeRead(page), 'Try again'));

      // 4. An empty socket: the plain headline.
      await open(page, 'relay-tower', []);
      problems.push(...strikeProblems('relay, before', await strikeRead(page), 'Strike'));
      await strike(page);
      // altar-truth: every verdict is a title plus a body. Here the title is the cause and the
      // body is the fix, as a full sentence.
      const { head, body } = await page.evaluate(() => ({
        head: document.querySelector('.lr-altar-verdict')?.firstChild?.textContent ?? '',
        body: document.querySelector('.lr-altar-verdict .lr-verdict-hint')?.textContent ?? '',
      }));
      if (!/^The charge /.test(head) || /charge lost/.test(head))
        problems.push(`relay fail: title "${head}"`);
      if (!/^Try: .*\.$/.test(body)) problems.push(`relay fail: body "${body}"`);

      // 5. The solve card: off every gauge and socket; FUSE's line clear of it.
      for (const id of ['furnace', 'capacitor-bay', 'the-last-rune'] as MachineId[]) {
        await page.evaluate(
          ({ id, placements, solved }) => {
            const g = (window as G).__game;
            if (g.flow.state === 'puzzle') g.flow.closePuzzle();
            g.save.update((d: G) => {
              d.progress.solved = solved;
              d.puzzles = { [id]: { attempts: 0, placements } };
            });
            g.flow.openPuzzle(id);
            g.flow.completePuzzle(id);
          },
          {
            id,
            placements: puzzleFor(id).design.intended,
            solved: ORDER.slice(0, ORDER.indexOf(id)),
          },
        );
        await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 15_000 });
        await page.evaluate(() => {
          const g = (window as G).__game;
          g.fuse.hush();
          void g.fuse.say('Stack two and the second one just feels important.', { hold: 0 });
        });
        await waitFrames(page, 8);
        const r = await page.evaluate(() => {
          const v = (window as G).__altarView;
          const ov = document
            .querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!
            .getBoundingClientRect();
          const k = ov.width / 1920;
          const L = v.layout;
          const box = (x: number, y: number, h: number) => ({
            l: ov.left + (x - h) * k,
            r: ov.left + (x + h) * k,
            t: ov.top + (y - h) * k,
            b: ov.top + (y + h) * k,
          });
          const things: { name: string; b: Box }[] = [];
          for (const [i, m] of (v.machines as G[]).entries())
            things.push({ name: `gauge ${i}`, b: box(m.x, m.y, L.pitch * 0.45) });
          for (const s of v.board as G[])
            things.push({ name: 'gem', b: box(s.x, s.y, L.pitch * 0.4) });
          const c = document.querySelector('.lr-solve-card')!.getBoundingClientRect();
          const cap = document.querySelector<HTMLElement>(
            '.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]',
          );
          const cr = cap?.getBoundingClientRect();
          const shown = !!cap && !cap.hidden && getComputedStyle(cap).visibility !== 'hidden';
          return {
            card: { l: c.left, r: c.right, t: c.top, b: c.bottom },
            things,
            cap:
              shown && cr && cr.height > 0
                ? { l: cr.left, r: cr.right, t: cr.top, b: cr.bottom }
                : null,
          };
        });
        const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        for (const t of r.things)
          if (hit(r.card, t.b)) problems.push(`${id} solve: card covers ${t.name}`);
        if (r.cap && r.cap.l < r.card.r && r.cap.r > r.card.l && r.cap.t < r.card.b + 12)
          problems.push(
            `${id} solve: FUSE's line ${(r.cap.t - r.card.b).toFixed(1)}px under the card`,
          );
        await page.locator('.lr-solve-continue').tap();
        await waitFrames(page, 10);
      }
      expect(problems).toEqual([]);
    });
  });
}
