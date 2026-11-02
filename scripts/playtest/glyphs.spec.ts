import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Placement, Rot } from '../../games/last-rune/rules';
import { type GemKind, MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { cellCenter, computeLayout, DESIGN_W } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// first-altar: every gem glyph on a real altar, checked against rules.md by eye. Places gems
// with the DEV hint lock (gold ring = locked), screenshots, and writes crop boxes per gem.
//   PLAYTEST_OUT=/tmp/pt-glyphs pnpm exec playwright test -c scripts/playtest/playwright.config.ts glyphs
// Crops: crops-<width>.json lists { file, gem, rot, x, y, w, h } in page pixels.

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-glyphs');
const VIEWPORTS = (process.env.PT_VIEWPORTS ?? '1280x720,1920x1080').split(',').map((v) => {
  const [width, height] = v.split('x').map(Number) as [number, number];
  return { width, height };
});

/** Which gems to show on which altar (tray counts permitting). */
const SHEETS: { machine: MachineId; gems: { gem: GemKind; rot: Rot }[] }[] = [
  {
    machine: 'control-booth',
    gems: [
      { gem: 'bend', rot: 0 },
      { gem: 'bend', rot: 1 },
      { gem: 'bend', rot: 2 },
      { gem: 'bend', rot: 3 },
      { gem: 'gate', rot: 0 },
      { gem: 'amplify', rot: 0 },
      { gem: 'split', rot: 0 },
      { gem: 'channel', rot: 0 },
    ],
  },
  {
    machine: 'lift-shaft',
    gems: [
      { gem: 'gate', rot: 1 },
      { gem: 'capacitor', rot: 0 },
      { gem: 'split', rot: 0 },
      { gem: 'bend', rot: 1 },
    ],
  },
  {
    machine: 'the-last-rune',
    gems: [
      { gem: 'split', rot: 1 },
      { gem: 'split', rot: 2 },
      { gem: 'split', rot: 3 },
    ],
  },
];

/** Free cells, spaced out (every other column), away from storm/machine sockets. */
function freeCells(machine: MachineId, n: number) {
  const p = puzzleFor(machine);
  const used = (x: number, y: number) =>
    p.blocked.some((c) => c.x === x && c.y === y) ||
    p.fixed.some((f) => f.cell.x === x && f.cell.y === y);
  const L = computeLayout(p);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < L.rows && out.length < n; y++)
    for (let x = (y % 2) as number; x < L.cols && out.length < n; x += 2)
      if (!used(x, y)) out.push({ x, y });
  return out;
}

test.setTimeout(120_000);

for (const vp of VIEWPORTS) {
  test(`glyphs ${vp.width}`, async ({ page }) => {
    const crops: { file: string; gem: string; rot: number; x: number; y: number; w: number }[] = [];
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize(vp);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEV_URL);
    await page.waitForFunction(
      () =>
        (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
        'title',
      null,
      { timeout: 30_000 },
    );
    await page.evaluate(
      (ids) => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        const g = (window as any).__game;
        g.save.update((d: any) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.progress.solved = ids.filter((id: string) => id !== 'the-last-rune');
        });
        g.flow.continueGame();
      },
      [...MACHINE_IDS],
    );
    await page.waitForTimeout(600);
    for (const sheet of SHEETS) {
      const p = puzzleFor(sheet.machine);
      const L = computeLayout(p);
      const cells = freeCells(sheet.machine, sheet.gems.length);
      await page.evaluate((id) => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        (window as any).__game.flow.openPuzzle(id);
      }, sheet.machine);
      await expect(page.locator('.lr-altar')).toBeVisible();
      await page.waitForTimeout(400);
      const placements: Placement[] = sheet.gems.map((g, i) => ({ ...g, cell: cells[i]! }));
      const ok = await page.evaluate((ps) => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        const a = (window as any).__altar;
        a.hints.highlight(null);
        return ps.map((pl) => a.hints.lock(pl));
      }, placements);
      expect(ok.every(Boolean), `${sheet.machine}: ${JSON.stringify(ok)}`).toBe(true);
      await page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        (window as any).__game.fuse.hush();
      });
      await page.mouse.move(2, vp.height - 2);
      await page.waitForTimeout(900);
      await waitFrames(page, 6);
      const file = `${sheet.machine}-${vp.width}.png`;
      await page.screenshot({ path: join(OUT, file) });
      const s = vp.width / DESIGN_W;
      for (const pl of placements) {
        const o = { x: 0, y: 0 };
        cellCenter(L, pl.cell, o);
        const w = Math.round(L.pitch * s);
        crops.push({
          file,
          gem: pl.gem,
          rot: pl.rot,
          x: Math.round(o.x * s - w / 2),
          y: Math.round(o.y * s - w / 2),
          w,
        });
      }
      await page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: dev handle
        (window as any).__game.flow.closePuzzle();
      });
      await page.waitForTimeout(300);
    }
    writeFileSync(join(OUT, `crops-${vp.width}.json`), JSON.stringify(crops, null, 2));
  });
}
