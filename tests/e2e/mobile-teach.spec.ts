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
async function openFresh(page: Page, id: string, share = 0.5) {
  const at = MACHINE_IDS.indexOf(id as (typeof MACHINE_IDS)[number]);
  const placed = puzzleFor(id as (typeof MACHINE_IDS)[number]).design.intended;
  const half = placed.slice(0, Math.floor(placed.length * share));
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

/** Turn the arrival card's pages with a finger until it closes. */
async function dismissCard(page: Page) {
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
    if ((await next.count()) === 0) return;
    const b = await next.first().boundingBox({ timeout: 2000 });
    if (!b) return;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await waitFrames(page, 4);
  }
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

    test(`a used-up gem is a quiet "all placed" silhouette (${vp.name})`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const id of ['capacitor-bay', 'the-last-rune', 'storm-cell-2'] as const) {
        await openFresh(page, id, 1);
        await waitFrames(page, 4);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/teach-allplaced-${vp.name}-${id}.png` });
        const g = await page.evaluate(() => {
          const view = (window as G).__altarView;
          const counts = [...document.querySelectorAll<HTMLElement>('.lr-altar-count')];
          const slots = [...document.querySelectorAll<HTMLElement>('.lr-altar-slot')];
          return counts.map((c, i) => {
            const r = c.getBoundingClientRect();
            const cs = getComputedStyle(c);
            const sl = slots[i];
            const ss = sl ? getComputedStyle(sl) : null;
            const after = sl ? getComputedStyle(sl, '::after').content : 'none';
            return {
              empty: c.hasAttribute('data-empty'),
              text: (c.querySelector('.lr-n')?.textContent ?? '').trim(),
              box: { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height },
              line: Number.parseFloat(cs.fontSize) * 1.6,
              border: cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none',
              plate:
                cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent',
              cursor: cs.cursor,
              slotSeen: !!ss && ss.display !== 'none' && ss.visibility !== 'hidden',
              tick: after !== 'none' && after !== 'normal' && after !== '""',
              gem: { size: view.tray[i]?.size ?? 0, state: view.tray[i]?.state ?? '' },
            };
          });
        });
        const hit = (a: { l: number; r: number; t: number; b: number }, b: typeof a) =>
          a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
        g.forEach((c, i) => {
          if (!c.empty) return;
          const tag = `${id} slot ${i + 1}`;
          if (c.text !== 'all placed') problems.push(`${tag}: reads "${c.text}"`);
          if (c.box.h > c.line) problems.push(`${tag}: "all placed" takes two lines`);
          if (c.border || c.plate) problems.push(`${tag}: "all placed" wears a button's outline`);
          if (c.cursor === 'pointer') problems.push(`${tag}: pointer cursor`);
          if (c.slotSeen && c.tick) problems.push(`${tag}: a ✓ circle`);
          if (!(c.gem.size > 0) || c.gem.state !== 'dim')
            problems.push(`${tag}: no dimmed silhouette (${c.gem.state} ${c.gem.size})`);
          g.forEach((o, j) => {
            if (j !== i && hit(c.box, o.box)) problems.push(`${tag}: overlaps count ${j + 1}`);
          });
        });
        if (!g.some((c) => c.empty)) problems.push(`${id}: nothing used up (test set-up)`);
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      expect(problems).toEqual([]);
    });

    test(`one panel while teaching (${vp.name})`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      for (const id of MACHINE_IDS) {
        await openFresh(page, id, 0);
        for (let pg = 0; pg < 6; pg++) {
          await waitFrames(page, 4);
          const g = await page.evaluate(() => {
            const seen = (el: Element | null) => {
              if (!el || (el as HTMLElement).hidden || el.closest('[hidden]')) return null;
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05)
                return null;
              if (r.width <= 0 || r.height <= 0) return null;
              return { l: r.left, r: r.right, t: r.top, b: r.bottom, text: el.textContent ?? '' };
            };
            const tip = document.querySelector('.lr-altar-tip');
            return {
              card: seen(tip),
              next: seen(document.querySelector('.lr-altar-tip .lr-info-next')),
              hint: seen(document.querySelector('.lr-altar-hint')),
              fuse: seen(document.querySelector('.tc-caption')),
              label: document.querySelector('.lr-altar-tip .lr-info-next')?.textContent ?? '',
              page: document.querySelector('.lr-altar-tip .lr-info-page')?.textContent ?? '',
              how:
                document.querySelector<HTMLElement>('.lr-altar-tip .lr-info-row')?.dataset.how ??
                '',
              rule: document.querySelector('.lr-altar-tip .lr-info-rule')?.textContent ?? '',
              leader: document.querySelectorAll('.lr-teach-leader .lr-leader-line').length,
              lit: [...document.querySelectorAll<HTMLElement>('.lr-altar-slot[data-teach]')].filter(
                (s) => getComputedStyle(s).display !== 'none',
              ).length,
            };
          });
          if (!g.next || !g.card) break;
          const tag = `${id} "${g.page}"`;
          if (SHOTS && pg === 0)
            await page.screenshot({ path: `${SHOTS}/teach-card-${vp.name}-${id}.png` });
          if (g.hint)
            problems.push(`${tag}: the how-to line "${g.hint.text}" shows beside the card`);
          if (g.fuse) problems.push(`${tag}: FUSE's bubble shows beside the card`);
          const n = g.next;
          const c = g.card;
          if (n.l < c.l - 0.5 || n.r > c.r + 0.5 || n.t < c.t - 0.5 || n.b > c.b + 0.5)
            problems.push(`${tag}: "${g.label}" pokes out of the card`);
          // The card points at what it teaches: a line to a fixed gem, a lit tray tile for
          // a gem the player places; and says which it is.
          if (g.how === 'fixed') {
            if (!g.leader) problems.push(`${tag}: no line from the card to the fixed gem`);
            if (!g.rule.startsWith('Fixed.'))
              problems.push(`${tag}: a fixed gem's page says "${g.rule}"`);
          } else if (g.how === 'tray' || g.how === 'turns') {
            if (g.how === 'tray' && !g.lit) problems.push(`${tag}: its tray tile is not lit`);
            if (g.leader) problems.push(`${tag}: a line points at the board for a tray gem`);
          }
          // The first lesson: "Bend is fixed; Channels are yours to place".
          if (id === 'intake-desk' && g.how === 'tray' && !g.rule.startsWith('Yours to place'))
            problems.push(`${tag}: a tray gem's page says "${g.rule}"`);
          // A finger, not the mouse (a click would switch the hints to mouse wording).
          await page.touchscreen.tap((n.l + n.r) / 2, (n.t + n.b) / 2);
        }
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      expect(problems).toEqual([]);
    });
    test(`a fixed gem says so, and stays still (${vp.name})`, async ({ page }) => {
      await boot(page, vp.inset);
      const problems: string[] = [];
      let checked = 0;
      for (const id of MACHINE_IDS) {
        const pz = puzzleFor(id);
        if (pz.fixed.length === 0) continue;
        await openFresh(page, id, 0);
        await dismissCard(page);
        for (const f of pz.fixed.slice(0, 2)) {
          const tapCell = async () => {
            const L = await page.evaluate(
              () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
            );
            const ob = (await page.locator('.tc-overlay').boundingBox())!;
            const k = ob.width / 1920;
            const x = L.left + L.margin + L.pitch * (f.cell.x + 0.5);
            const y = L.top + L.margin + L.pitch * (f.cell.y + 0.5);
            await page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
            await waitFrames(page, 6);
          };
          // A dense board zooms in on the first tap; the second reaches the gem.
          const zoomable = await page.locator('.lr-altar[data-zoomable]').count();
          await tapCell();
          if (zoomable) {
            await page.waitForTimeout(400);
            await tapCell();
          }
          const g = await page.evaluate(({ x, y }) => {
            const v = (window as G).__altarView;
            const b = v.board.find(
              (q: { cell: { x: number; y: number } }) => q.cell.x === x && q.cell.y === y,
            );
            const tip = document.querySelector<HTMLElement>('.lr-altar-tip');
            return {
              tip: tip && !tip.hidden ? (tip.textContent ?? '') : '',
              eg: tip?.querySelector('.lr-info-eg')?.textContent ?? '',
              settle: b?.settle ?? -1,
              lift: b?.g?.lift ?? 0,
              held: v.held?.kind ?? null,
            };
          }, f.cell);
          const tag = `${id} ${f.gem} at ${f.cell.x},${f.cell.y}`;
          checked++;
          if (SHOTS && checked <= 3)
            await page.screenshot({ path: `${SHOTS}/teach-fixed-${vp.name}-${id}.png` });
          if (!g.tip.includes('Fixed: part of the machine'))
            problems.push(`${tag}: the card says "${g.tip}"`);
          if (g.settle > 0.01) problems.push(`${tag}: the gem bounces (settle ${g.settle})`);
          if (g.lift > 0.01) problems.push(`${tag}: the gem lifts (${g.lift})`);
          if (g.held) problems.push(`${tag}: the tap picked up ${g.held}`);
          await page.waitForTimeout(2700);
        }
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await waitFrames(page, 4);
      }
      expect(checked).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  });
}
