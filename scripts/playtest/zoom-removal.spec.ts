import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import { type AltarLayout, cellCenter } from '../../games/last-rune/scenes/altar/layout';
import { DEV_URL, readSave, waitFrames } from '../../tests/e2e/helpers';

// zoom-removal (D-041 addendum 1): the dense altars at the whole-board view on the four phones,
// as a first-time player meets them: at rest, a gem in hand, the gem tapped onto its socket,
// and half the intended board placed. Also records the socket pitch (CSS px) per phone.
//   pnpm exec playwright test -c scripts/playtest/playwright.config.ts zoom-removal
// Writes docs/design/screens/local/zoom-removal/<phone>/*.png and pitch.json.

const OUT = resolve(process.env.ZR_OUT ?? 'docs/design/screens/local/zoom-removal');
const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;
const ALTARS: MachineId[] = ['the-last-rune', 'capacitor-bay', 'lift-shaft'];

test.setTimeout(600_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.head.append(s);
    });
  }, px);
}

async function open(page: Page, id: MachineId, placements: unknown[]) {
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
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
    { id, placements, solved: MACHINE_IDS.slice(0, MACHINE_IDS.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 6);
}

async function pageIntro(page: Page) {
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.lr-altar-tip .lr-info-next');
    if (!(await next.isVisible())) break;
    await next.tap();
    await waitFrames(page, 4);
  }
  await page.evaluate(() => (window as G).__game.fuse.hush());
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    test(`zoom-removal ${vp.name}`, async ({ page }) => {
      const dir = join(OUT, vp.name);
      mkdirSync(dir, { recursive: true });
      const shot = async (name: string) => {
        await waitFrames(page, 6);
        await page.screenshot({ path: join(dir, `${name}.png`) });
      };
      await insets(page, vp.inset);
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );
      const pitch: Record<string, number> = {};
      for (const [i, id] of ALTARS.entries()) {
        const n = `${i + 1}`;
        await open(page, id, []);
        await page.waitForTimeout(800);
        await shot(`${n}a-${id}-arrival`);
        await pageIntro(page);
        await shot(`${n}b-${id}-rest`);
        const L = await page.evaluate(
          () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
        );
        const ob = (await page.locator('.tc-overlay').boundingBox())!;
        const k = ob.width / 1920;
        pitch[id] = Math.round(L.pitch * k * 10) / 10;
        const tap = async (x: number, y: number) => {
          await page.touchscreen.tap(ob.x + x * k, ob.y + y * k);
          await waitFrames(page, 6);
        };
        // A gem in hand, then a tap on its intended socket at the whole-board view.
        const g = puzzleFor(id).design.intended[0]!;
        const slot = L.tray.find((s) => s.gem === g.gem)!;
        await tap(slot.x, slot.y);
        await shot(`${n}c-${id}-holding`);
        const c = { x: 0, y: 0 };
        cellCenter(L, g.cell, c);
        await tap(c.x, c.y);
        await page.waitForTimeout(300);
        await shot(`${n}d-${id}-placed`);
        await expect
          .poll(async () => (await readSave(page))?.puzzles[id]?.placements ?? [], {
            message: `${vp.name} ${id}: a tap at the whole board sets the gem on its socket`,
          })
          .toContainEqual(expect.objectContaining({ gem: g.gem, cell: g.cell }));
        // Half the intended board, as a player mid-solve sees it.
        const half = puzzleFor(id).design.intended;
        await open(page, id, half.slice(0, Math.ceil(half.length / 2)));
        await pageIntro(page);
        await shot(`${n}e-${id}-half`);
      }
      writeFileSync(join(dir, 'pitch.json'), JSON.stringify(pitch, null, 2));
    });
  });
}
