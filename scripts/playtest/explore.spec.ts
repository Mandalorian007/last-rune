import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { getMachine } from '../../games/last-rune/rules/progression';
import type { MachineId } from '../../games/last-rune/rules/types';
import {
  PREVIEW_URL,
  pressKey,
  readSave,
  trackProblems,
  waitFrames,
} from '../../tests/e2e/helpers';

// Off-script beats a first-time player hits: knocking on a locked door, Esc in the hall, the
// mouse, striking an empty altar and a half-built one. Captures screenshots for the report.

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-explore');
let n = 0;

async function snap(page: Page, name: string) {
  await waitFrames(page, 8);
  await page.screenshot({ path: join(OUT, `${String(++n).padStart(2, '0')}-${name}.png`) });
}

async function focus(page: Page, id: MachineId) {
  const name = getMachine(id).name;
  for (let i = 0; i < 40; i++) {
    const plate = page.locator('.lr-nameplate');
    if ((await plate.isVisible()) && (await plate.locator('span').textContent()) === name) return;
    await pressKey(page, 'ArrowRight');
  }
  throw new Error(`never focused ${name}`);
}

test('first-time player wanders off script', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const problems = trackProblems(page);
  await page.goto(PREVIEW_URL);
  await expect(page.locator('[data-action="play"]')).toBeVisible();
  await waitFrames(page, 10);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible();
  await snap(page, 'hall-first-entry');

  // Knock on a locked door.
  await focus(page, 'furnace');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  await waitFrames(page, 60);
  await snap(page, 'hall-locked-door');

  // Esc in the hall opens settings; Esc closes it.
  await pressKey(page, 'Escape');
  await snap(page, 'hall-esc-settings');
  await pressKey(page, 'Escape');
  await snap(page, 'hall-esc-closed');

  // Mouse: hover the front of the hall (where the entrance alcove sits).
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height * 0.86);
  await waitFrames(page, 40);
  await snap(page, 'hall-mouse-hover-front');

  // Open the intake desk by keyboard and strike an empty altar.
  await focus(page, 'intake-desk');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible();
  await snap(page, 'intake-first-look');
  await pressKey(page, 'KeyF');
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 30_000 });
  await snap(page, 'intake-empty-strike');

  // One channel at the cursor (next to the storm), then strike: still not enough.
  await pressKey(page, 'Digit1');
  await snap(page, 'intake-gem-in-hand');
  await pressKey(page, 'Enter');
  await pressKey(page, 'KeyF');
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 30_000 });
  await snap(page, 'intake-partial-strike');

  // Mouse over the tray band for the rule tooltip.
  await page.mouse.move(vp.width * 0.42, vp.height - 70);
  await snap(page, 'intake-tray-hover');

  // Wait out the first-altar nudge (9 s idle on an empty board is not this board, but the
  // teach socket keeps pulsing): record what a stuck player sees after ~10 s.
  await page.keyboard.press('KeyZ');
  await page.keyboard.press('Delete');
  await waitFrames(page, 700);
  await snap(page, 'intake-idle-nudge');

  // Leave with Esc: placements persist, attempts are counted.
  await pressKey(page, 'Escape');
  await pressKey(page, 'Escape');
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  expect((await readSave(page))?.puzzles['intake-desk']?.attempts).toBe(2);
  await snap(page, 'hall-after-leaving');
  test.info().annotations.push({ type: 'problems', description: JSON.stringify(problems) });
  expect(problems).toEqual([]);
});
