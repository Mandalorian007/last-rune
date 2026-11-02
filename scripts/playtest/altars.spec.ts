import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { auditAltar, playOrder } from '../../tests/e2e/altar-audit';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// onboarding-2: every altar as a player first meets it (solved = the altars before it in hall
// order), at each viewport and text size. Screenshots plus a label-overlap audit per altar.
//   PLAYTEST_OUT=/tmp/pt-altars pnpm exec playwright test -c scripts/playtest/playwright.config.ts altars
// PT_VIEWPORTS=1280x720,1920x1080, PT_SCALES=100,150, PT_ONLY=furnace,capacitor-bay (optional).

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-altars');
const VIEWPORTS = (process.env.PT_VIEWPORTS ?? '1280x720,1920x1080').split(',').map((v) => {
  const [width, height] = v.split('x').map(Number) as [number, number];
  return { width, height };
});
const SCALES = (process.env.PT_SCALES ?? '100,150').split(',').map(Number);
const ONLY = process.env.PT_ONLY?.split(',');
const ORDER = playOrder();

test.setTimeout(300_000);

for (const vp of VIEWPORTS) {
  for (const scale of SCALES) {
    test(`altars ${vp.width} text ${scale}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize(vp);
      await page.goto(DEV_URL);
      await page.waitForFunction(
        () =>
          (window as unknown as { __game?: { flow: { state: string } } }).__game?.flow.state ===
          'title',
        null,
        { timeout: 30_000 },
      );
      const report: Record<string, string[]> = {};
      for (let i = 0; i < ORDER.length; i++) {
        const id = ORDER[i]!;
        if (ONLY && !ONLY.includes(id)) continue;
        await page.evaluate(
          ({ id, solved, scale }) => {
            // biome-ignore lint/suspicious/noExplicitAny: dev handle
            const g = (window as any).__game;
            g.save.update(
              (d: {
                flags: Record<string, boolean>;
                settings: Record<string, unknown>;
                progress: { solved: string[] };
                puzzles: Record<string, unknown>;
              }) => {
                d.flags.hallIntro = true;
                d.settings.captionSpeed = 'instant';
                d.settings.textScale = scale;
                d.progress.solved = solved;
                d.puzzles = {};
              },
            );
            if (g.flow.state === 'title') g.flow.continueGame();
            g.flow.openPuzzle(id);
          },
          { id, solved: ORDER.slice(0, i), scale },
        );
        await expect(page.locator('.lr-altar')).toBeVisible();
        await page.mouse.move(2, 2);
        await page.waitForTimeout(1200);
        await waitFrames(page, 6);
        const name = `${String(i + 1).padStart(2, '0')}-${id}-${vp.width}-${scale}`;
        await page.screenshot({ path: join(OUT, `${name}.png`) });
        report[id] = await auditAltar(page, id);
        await page.evaluate(() => {
          // biome-ignore lint/suspicious/noExplicitAny: dev handle
          (window as any).__game.flow.closePuzzle();
        });
        await page.waitForTimeout(300);
      }
      writeFileSync(join(OUT, `audit-${vp.width}-${scale}.json`), JSON.stringify(report, null, 2));
    });
  }
}
