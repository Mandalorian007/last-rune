import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { type AltarLayout, TRAY_GLYPH_HALF } from '../../games/last-rune/scenes/altar/layout';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// glyph-truth (D-027):
//  - a tray count badge never covers any side of its gem's glyph (gate 6: the corner badge hid
//    the Split's input end and the Gate's lower input), held or not, on every phone;
//  - a straight gem never turns when Strike is pressed: the turns the board rests at before
//    Strike are the turns at the verdict (gate 6: on Capacitor Bay and friends, a gem only the
//    Capacitor's release reaches turned at Strike).

const ORDER = playOrder();

test.setTimeout(300_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function open(page: Page, id: MachineId, placements: unknown[] = []) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForFunction(() => !!(window as G).__altarLayout);
  await waitFrames(page, 10);
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}
const meets = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** Every count badge's rect against every tray gem's glyph box (CSS px), as drawn now. */
async function badgeClashes(page: Page, label: string): Promise<string[]> {
  const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const k = ob.width / 1920;
  const seen = await page.evaluate(() => {
    const v = (window as G).__altarView;
    return {
      // The tray's gems, and the gem in hand resting (a size up) in its slot.
      gems: [...v.tray, ...(v.held ? [v.held] : [])].map((t: G) => ({
        kind: t.kind,
        x: t.x,
        y: t.y,
        size: t.size,
      })),
      trayN: v.tray.length,
      badges: [...document.querySelectorAll<HTMLElement>('.lr-altar-count')].map((b) => {
        const r = b.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
      }),
    };
  });
  const out: string[] = [];
  const shown = seen.badges.filter((b: { w: number }) => b.w > 0);
  if (shown.length !== seen.trayN)
    out.push(`${label}: ${shown.length} badges for ${seen.trayN} tray gems`);
  seen.gems.forEach((g: { kind: string; x: number; y: number; size: number }) => {
    const cx = ob.x + g.x * k;
    const cy = ob.y + g.y * k;
    const h = TRAY_GLYPH_HALF * g.size * k;
    const glyph = { l: cx - h, t: cy - h, r: cx + h, b: cy + h };
    shown.forEach((b: Box, j: number) => {
      if (meets(b, glyph)) out.push(`${label}: badge ${j} covers the ${g.kind}'s glyph`);
    });
  });
  return out;
}

const PHONES = [
  { name: 'se', width: 667, height: 320 },
  { name: 'iphone', width: 844, height: 340 },
  { name: 'promax', width: 932, height: 380 },
  { name: 'android', width: 915, height: 360 },
] as const;

for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({
      viewport: { width: ph.width, height: ph.height },
      isMobile: true,
      hasTouch: true,
    });
    test(`${ph.name}: tray count badges sit off every glyph, held or not`, async ({ page }) => {
      const problems: string[] = [];
      for (const id of ['control-booth', 'storm-cell-2'] as const) {
        await open(page, id);
        problems.push(...(await badgeClashes(page, `${id} idle`)));
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
        const k = ob.width / 1920;
        // Hold each gem in turn: the held gem is drawn bigger than its slot.
        for (const s of L.tray) {
          await page.touchscreen.tap(ob.x + s.x * k, ob.y + s.y * k);
          await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, s.gem);
          await waitFrames(page, 20);
          problems.push(...(await badgeClashes(page, `${id} holding ${s.gem}`)));
        }
      }
      expect(problems).toEqual([]);
    });
  });
}

/** Each board gem's resting turn (mod 4) by cell. */
function turns(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const b of (window as G).__altarView.board)
      out[`${b.cell.x},${b.cell.y} ${b.g.kind}`] = ((Math.round(b.rotTarget) % 4) + 4) % 4;
    return out;
  });
}

const STILL: MachineId[] = ['capacitor-bay', 'roof-array', 'lift-shaft', 'the-last-rune'];

test('no gem turns when Strike is pressed: turns before Strike are the turns at the verdict', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const problems: string[] = [];
  for (const id of STILL) {
    await open(page, id, puzzleFor(id).design.intended);
    const before = await turns(page);
    await page.evaluate(() => (window as G).__game.fuse.hush());
    await page.locator('[data-action="strike"]').click();
    await waitFrames(page, 4);
    const sure = page.locator('.lr-confirm .lr-gold-button');
    if (await sure.isVisible()) await sure.click();
    await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 60_000 });
    await waitFrames(page, 4);
    const after = await turns(page);
    for (const [cell, rot] of Object.entries(after))
      if (before[cell] !== rot) problems.push(`${id} ${cell}: turn ${before[cell]} → ${rot}`);
  }
  expect(problems).toEqual([]);
});
