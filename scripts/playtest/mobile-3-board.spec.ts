import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// mobile-3-board: every altar (half the intended gems placed) at the phone viewports, plus the
// desktop and iPad baselines that must not change, plus a few states (verdict after a strike,
// the solve card over a really solved board).
//   MB_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-3-board
// Writes docs/design/screens/local/mobile-3-board/<tag>/<viewport>/*.png, a contact sheet per
// viewport (<tag>-<viewport>.png) and the socket pitch per altar (<tag>-<viewport>.json).
// MB_ONLY=iphone,se (viewport names, optional). MB_OUT=<dir> writes somewhere else.

const TAG = process.env.MB_TAG ?? 'after';
const OUT = resolve(process.env.MB_OUT ?? 'docs/design/screens/local/mobile-3-board');
const VIEWPORTS = [
  { name: 'iphone', width: 844, height: 340, inset: 47, phone: true },
  { name: 'se', width: 667, height: 320, inset: 0, phone: true },
  { name: 'promax', width: 932, height: 380, inset: 59, phone: true },
  { name: 'android', width: 915, height: 360, inset: 0, phone: true },
  { name: 'desktop', width: 1920, height: 1080, inset: 0, phone: false },
  { name: 'ipad', width: 1180, height: 820, inset: 0, phone: false },
] as const;
const ONLY = process.env.MB_ONLY?.split(',');

test.setTimeout(900_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

for (const vp of VIEWPORTS) {
  if (ONLY && !ONLY.includes(vp.name)) continue;
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
      deviceScaleFactor: vp.phone ? 2 : 1,
    });
    test(`mobile-3-board ${TAG} ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, TAG, vp.name);
      mkdirSync(dir, { recursive: true });
      const shots: string[] = [];
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' });
        shots.push(name);
      };
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      if (vp.phone)
        await page.evaluate(() =>
          document.dispatchEvent(
            new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
          ),
        );
      await page.waitForTimeout(1000);
      const all = MACHINE_IDS.filter((m) => m !== 'the-last-rune');
      const pitches: Record<string, number> = {};
      const open = async (id: string, placed: unknown[], solved = all.filter((m) => m !== id)) => {
        await page.evaluate(
          ({ solved, id, placed }) => {
            const g = (window as G).__game;
            g.save.update((d: G) => {
              d.flags.hallIntro = true;
              d.settings.captionSpeed = 'instant';
              d.settings.reduceFlashes = 'on';
              d.progress.solved = solved;
              d.puzzles = { [id]: { placements: placed, attempts: 0 } };
              d.journal.found = [1, 2, 3, 4];
            });
            if (g.flow.state !== 'hall') g.flow.continueGame();
          },
          { solved, id, placed },
        );
        await page.waitForTimeout(500);
        await page.evaluate((id) => (window as G).__game.flow.openPuzzle(id), id);
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.waitForTimeout(1500);
        await page.evaluate(() => (window as G).__game.fuse.hush());
      };
      const close = async () => {
        await page.evaluate(() => (window as G).__game.flow.closePuzzle());
        await page.waitForTimeout(300);
      };
      let i = 0;
      for (const id of MACHINE_IDS) {
        i++;
        const placed = puzzleFor(id).design.intended;
        await open(id, placed.slice(0, Math.floor(placed.length / 2)));
        const pitch = await page.evaluate(() => {
          const L = (window as G).__altarLayout;
          const r = document.querySelector('.tc-overlay')!.getBoundingClientRect();
          return L ? (L.pitch * r.width) / 1920 : 0;
        });
        pitches[id] = Math.round(pitch * 10) / 10;
        await shot(`${String(i).padStart(2, '0')}-${id}`);
        await close();
      }

      // A strike with a wrong board (half placed): the verdict and its tags.
      for (const [id, part] of [
        ['relay-tower', 0.5],
        ['roof-array', 0.5],
        ['boiler-room', 0],
      ] as const) {
        const placed = puzzleFor(id).design.intended;
        await open(id, placed.slice(0, Math.floor(placed.length * part)));
        await page.locator('.lr-altar-actions [data-action="strike"]').click();
        await page.waitForTimeout(300);
        const sure = page.locator('.lr-confirm .lr-gold-button, .lr-confirm button').first();
        if (await sure.isVisible()) await sure.click();
        await page.waitForTimeout(7000);
        await shot(`20-${id}-verdict`);
        await close();
      }

      // Solve card over a board really solved: the intended gems, then complete.
      await open('furnace', puzzleFor('furnace').design.intended, ['intake-desk']);
      await page.evaluate(() => (window as G).__game.flow.completePuzzle('furnace'));
      await page.waitForTimeout(4000);
      await shot('30-solve');
      await page.evaluate(() => (window as G).__game.flow.finishSolve());
      await page.waitForTimeout(500);

      writeFileSync(join(OUT, `${TAG}-${vp.name}.json`), `${JSON.stringify(pitches, null, 2)}\n`);

      const w = vp.phone ? vp.width : Math.round(vp.width / 2);
      const hgt = vp.phone ? vp.height : Math.round(vp.height / 2);
      const cells = shots
        .map((n) => {
          const b64 = readFileSync(join(dir, `${n}.png`)).toString('base64');
          return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}${pitches[n.slice(3)] ? ` · pitch ${pitches[n.slice(3)]} px` : ''}</figcaption></figure>`;
        })
        .join('');
      await page.setViewportSize({ width: w * 3 + 80, height: 800 });
      await page.setContent(
        `<style>body{margin:0;padding:10px;background:#333;font:14px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(3,${w}px);gap:10px 20px}figure{margin:0}img{display:block;width:${w}px;height:${hgt}px;outline:1px solid #666}figcaption{padding:2px 0}</style><h1 style="grid-column:1/-1;margin:0;font-size:18px">${TAG} · ${vp.name} ${vp.width}×${vp.height}${vp.inset ? ` · ${vp.inset}px insets` : ''}</h1>${cells}`,
      );
      await page.screenshot({ path: join(OUT, `${TAG}-${vp.name}.png`), fullPage: true });
    });
  });
}
