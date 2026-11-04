/**
 * menu-flow (D-043): the menus end to end, as a first-time player meets them, on the SE, an
 * Android phone, an iPad and a 1280×720 desktop. Title → Settings, hall → ☰ / Codex / Journal,
 * altar → ☰ / Codex / Settings / Journal, solve card, end card. Off unless SHOTS=<dir>; images
 * go to docs/design/screens/local/<dir>/<device>/ (git-ignored).
 *
 *   SHOTS=menu-flow pnpm exec playwright test -c scripts/playtest/playwright.config.ts menu-flow
 */
import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, settled, waitFrames } from '../../tests/e2e/helpers';

const DIR = process.env.SHOTS ?? '';

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

const DEVICES = [
  { name: 'se', width: 667, height: 320, touch: true },
  { name: 'android', width: 915, height: 360, touch: true },
  { name: 'ipad', width: 1180, height: 820, touch: true },
  { name: 'desktop', width: 1280, height: 720, touch: false },
] as const;

test.skip(!DIR, 'SHOTS=<dir> to take screenshots');
test.setTimeout(300_000);

async function snap(page: Page, folder: string, name: string) {
  await settled(page, '#app *');
  await waitFrames(page, 6);
  const dir = `docs/design/screens/local/${DIR}/${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

/** What has focus, in words. */
function focused(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return 'body';
    if (a.tagName === 'CANVAS') return 'canvas';
    return `${a.tagName.toLowerCase()}.${[...a.classList].join('.')} "${(a.textContent ?? '').trim().slice(0, 20)}"`;
  });
}

async function click(page: Page, sel: string, touch: boolean) {
  const loc = page.locator(sel).first();
  if (touch) await loc.tap();
  else await loc.click();
}

for (const d of DEVICES) {
  test(`menu flow on ${d.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: d.width, height: d.height },
      hasTouch: d.touch,
      isMobile: d.touch && d.name !== 'ipad',
    });
    const page = await context.newPage();
    const log: string[] = [];
    const note = async (what: string) => log.push(`${what} → focus: ${await focused(page)}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEV_URL);
    await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
      timeout: 30_000,
    });
    if (d.touch) {
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );
    }
    // A returning player with a few machines done and an unread page.
    await page.evaluate(() => {
      const g = (window as G).__game;
      g.save.update((s: G) => {
        s.flags.hallIntro = true;
        s.settings.captionSpeed = 'instant';
        s.progress.solved = ['intake-desk', 'furnace'];
        s.journal.found = [1, 2];
        s.journal.read = [1];
        s.stats.startedAt = 1;
      });
      g.flow.start();
    });
    await waitFrames(page, 10);
    await snap(page, d.name, '01-title');
    await click(page, '[data-action="settings"]', d.touch);
    await snap(page, d.name, '02-title-settings');
    await page.keyboard.press('Escape');
    await note('title: Settings, Esc');
    await page.locator('[data-action="continue"]').first().click();
    await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
    await waitFrames(page, 10);
    await snap(page, d.name, '03-hall');
    const phone = await page.evaluate(() => (window as G).__game.device.phone);
    if (phone) {
      await click(page, '.lr-hud-menu', d.touch);
      await snap(page, d.name, '04-hall-menu');
      await page.keyboard.press('Escape');
      await note('hall: ☰ open, Esc');
      log.push(`hall ☰ still open after Esc: ${await page.locator('.lr-hud[data-open]').count()}`);
      await page.evaluate(() => (window as G).__game.hud.menu(false));
    }
    await page.evaluate(() => (window as G).__game.codex.open());
    await snap(page, d.name, '05-hall-codex');
    await page.keyboard.press('Escape');
    await note('hall: Codex, Esc');
    await page.keyboard.press('Escape');
    await waitFrames(page, 4);
    log.push(`hall Esc opens: ${await page.locator('.tc-panel-title').allTextContents()}`);
    await snap(page, d.name, '06-hall-esc');
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as G).__game.flow.openJournal());
    await waitFrames(page, 10);
    await snap(page, d.name, '07-hall-journal');
    await page.keyboard.press('Escape');
    await waitFrames(page, 4);
    log.push(`journal Esc → ${await page.evaluate(() => (window as G).__game.flow.state)}`);
    await page.evaluate(() => (window as G).__game.flow.openPuzzle('furnace'));
    await expect(page.locator('.lr-altar')).toBeVisible();
    await waitFrames(page, 15);
    await snap(page, d.name, '08-altar');
    if (phone) {
      await click(page, '.lr-hud-menu', d.touch);
      await snap(page, d.name, '09-altar-menu');
      log.push(
        `altar ☰ rows: ${await page.locator('.lr-hud > button:not([hidden]):not(.lr-hud-menu)').allTextContents()}`,
      );
      await page.evaluate(() => (window as G).__game.hud.menu(false));
    } else {
      log.push(
        `altar HUD buttons: ${await page.locator('.lr-hud > button:not([hidden]):not(.lr-hud-menu)').allTextContents()}`,
      );
    }
    // Journal over the altar, and back to the same board.
    if (phone) await click(page, '.lr-hud-menu', d.touch);
    const altarJournal = page.locator('.lr-hud [data-action="journal"]');
    if (await altarJournal.isVisible()) {
      await click(page, '.lr-hud [data-action="journal"]', d.touch);
      await waitFrames(page, 10);
      await snap(page, d.name, '09b-altar-journal');
      await page.keyboard.press('Escape');
      await waitFrames(page, 10);
      log.push(`altar journal Esc → ${await page.evaluate(() => (window as G).__game.flow.state)}`);
      await snap(page, d.name, '09c-altar-after-journal');
    } else {
      log.push('altar: no Journal');
      if (phone) await page.evaluate(() => (window as G).__game.hud.menu(false));
    }
    await page.evaluate(() => (window as G).__game.openSettings());
    await snap(page, d.name, '10-altar-settings');
    await page.keyboard.press('Escape');
    await note('altar: Settings, Esc');
    await page.keyboard.press('Escape');
    await waitFrames(page, 4);
    log.push(`altar Esc → ${await page.evaluate(() => (window as G).__game.flow.state)}`);
    // Solve card and the end card (a replay, so Skip is there).
    await page.evaluate(
      (all) => {
        const g = (window as G).__game;
        g.save.update((s: G) => {
          s.progress.solved = all.filter((m: string) => m !== 'the-last-rune');
          s.puzzles = {};
        });
        if (g.flow.state !== 'hall') g.flow.continueGame();
        g.flow.openPuzzle('furnace');
        g.flow.completePuzzle('furnace');
      },
      MACHINE_IDS as unknown as string[],
    );
    await waitFrames(page, 60);
    await snap(page, d.name, '11-solve');
    await page.evaluate(
      (all) => {
        const g = (window as G).__game;
        g.flow.finishSolve();
        g.save.update((s: G) => {
          s.progress.solved = all;
        });
        g.flow.openPuzzle('the-last-rune');
        g.flow.completePuzzle('the-last-rune');
        g.flow.finishSolve();
      },
      MACHINE_IDS as unknown as string[],
    );
    await page.locator('.lr-end-skip').click();
    await expect(page.locator('.lr-end-card')).toHaveAttribute('data-in', '', { timeout: 30_000 });
    await snap(page, d.name, '12-end-card');
    await page.keyboard.press('Escape');
    await waitFrames(page, 6);
    log.push(`end card Esc → ${await page.evaluate(() => (window as G).__game.flow.state)}`);
    console.log(`[${d.name}]\n  ${log.join('\n  ')}`);
    await context.close();
  });
}
