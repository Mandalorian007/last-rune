/// <reference types="@webgpu/types" />
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { DISCORD_INVITE_URL, KOFI_URL, LINK_COPY_TEXT } from '../../games/last-rune/content/ending';
import { DEV_URL, trackProblems } from './helpers';

// Copy link beside every outbound link (title Ko-fi; end card Join and Ko-fi), for when a
// browser blocks the new tab. Covers the product: each Copy link copies its own URL, with Last
// Rune's wording, placement and arrow-key order. How copying and opening work (refused or
// missing clipboard, execCommand fallback, a blocked pad open, itch's iframe, nothing opening on
// its own) is the engine's host, tested once in packages/engine/e2e/host.spec.ts (D-041).
//
// LINK_COPY_SHOTS=<dir> also saves first-time-player screenshots of each state.

const SHOTS = process.env.LINK_COPY_SHOTS ?? '';

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void; flush(): void };
}

type Setup = { popup?: 'blocked' };

/**
 * Stubs before the game loads: a controllable standard gamepad (`__pad`) and window.open
 * recording calls (and returning null when `popup: 'blocked'`, for the opt-in screenshots).
 */
async function prepare(context: BrowserContext, page: Page, setup: Setup): Promise<void> {
  // Granted so the test can read the clipboard back.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(DEV_URL).origin,
  });
  await page.addInitScript((s: Setup) => {
    const w = window as unknown as Record<string, unknown>;
    const pad = {
      id: 'test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    w.__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    const opened: string[] = [];
    w.__opened = opened;
    const realOpen = window.open.bind(window);
    window.open = ((url?: string | URL, ...rest: unknown[]) => {
      opened.push(String(url));
      if (s.popup === 'blocked') return null;
      return realOpen(url, ...(rest as [string?, string?]));
    }) as typeof window.open;
  }, setup);
}

/**
 * Presses and releases a pad button, each held until the game has polled it on a few fixed
 * ticks. Input polls the pad once per tick, so a press held for a fixed wall-clock time is
 * missed when the page draws no frame in that window (the first title frames, a loaded
 * machine). That was the "gamepad A on Ko-fi with the new tab blocked" flake.
 */
async function padPress(page: Page, button: number): Promise<void> {
  const set = (on: boolean) =>
    page.evaluate(
      ([b, v]) => {
        const pad = (
          window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }
        ).__pad;
        pad.buttons[b as number] = { pressed: v as boolean, value: v ? 1 : 0 };
      },
      [button, on] as const,
    );
  const ticks = (n: number) =>
    page.evaluate(
      (n) =>
        new Promise<void>((done) => {
          const time = (window as unknown as { __game: { loop: { time: { tick: number } } } })
            .__game.loop.time;
          const until = time.tick + n;
          const wait = () => (time.tick >= until ? done() : requestAnimationFrame(wait));
          wait();
        }),
      n,
    );
  await set(true);
  await ticks(3);
  await set(false);
  await ticks(3);
}

async function gotoTitle(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
}

/** Seeds a finished save and skips the ending replay to its end card. */
async function gotoEndCard(page: Page, textScale = 100): Promise<void> {
  await gotoTitle(page);
  await page.evaluate(async (scale) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    const typesUrl = '/games/last-rune/rules/types.ts';
    const { MACHINE_IDS } = (await import(/* @vite-ignore */ typesUrl)) as {
      MACHINE_IDS: string[];
    };
    g.save.update((d) => {
      d.flags.hallIntro = true;
      d.flags.titleKnock = true;
      d.progress.solved = [...MACHINE_IDS];
      d.settings.textScale = scale;
    });
    g.flow.continueGame();
    g.flow.openPuzzle('the-last-rune');
    g.flow.completePuzzle('the-last-rune');
    g.flow.finishSolve();
  }, textScale);
  await expect(page.locator('.lr-end-skip')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.lr-end-card a.lr-end-join')).toBeVisible({ timeout: 10_000 });
  // Let the card finish fading in.
  await page.waitForTimeout(1500);
}

async function setTextScale(page: Page, scale: number): Promise<void> {
  await page.evaluate((s) => {
    const g = (window as unknown as { __game: GameHandle }).__game;
    g.save.update((d) => {
      d.flags.titleKnock = true;
      d.settings.textScale = s;
    });
    g.save.flush();
  }, scale);
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

function popupsOf(page: Page): string[] {
  const popups: string[] = [];
  page.on('popup', (p) => popups.push(p.url()));
  return popups;
}

test.describe('Copy link', () => {
  test('title: Copy link puts the Ko-fi URL on the clipboard', async ({ context, page }) => {
    test.setTimeout(60_000);
    const problems = trackProblems(page);
    await prepare(context, page, {});
    await gotoTitle(page);

    const copy = page.locator('[data-action="title-coffee-copy"]');
    await expect(copy).toBeVisible();
    await expect(copy).toHaveText(LINK_COPY_TEXT.copy);
    await expect(copy).toHaveAccessibleName("Copy link to ThunderSoap's Ko-fi");
    // Quieter than the link it sits beside, and clear of the menu.
    const [cb, kb, mb] = await Promise.all([
      copy.boundingBox(),
      page.locator('a.lr-title-coffee').boundingBox(),
      page.locator('.lr-title-menu').boundingBox(),
    ]);
    expect(cb!.height).toBeLessThanOrEqual(kb!.height);
    expect(cb!.y).toBeGreaterThan(mb!.y + mb!.height);

    await copy.click();
    await expect(copy).toHaveText(LINK_COPY_TEXT.copied);
    expect(await clipboardText(page)).toBe(KOFI_URL);
    await expect(page.locator('.lr-title-links [aria-live="polite"]')).toHaveText(
      LINK_COPY_TEXT.copiedAnnounce,
    );
    await expect(page.locator('[data-action="title-coffee-fallback"]')).toBeHidden();
    await expect(copy).toHaveText(LINK_COPY_TEXT.copy, { timeout: 5000 });

    // Arrow keys reach both: the Copy button last, then the link.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowUp');
    await expect(copy).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('a.lr-title-coffee')).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('end card: each Copy link copies its own URL; nothing opens on its own', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const problems = trackProblems(page);
    const popups = popupsOf(page);
    await prepare(context, page, {});
    await page.goto(DEV_URL);
    await page.evaluate(() => navigator.clipboard.writeText('untouched'));
    await gotoEndCard(page);
    expect(await clipboardText(page)).toBe('untouched');

    const joinCopy = page.locator('[data-action="ending-join-copy"]');
    const coffeeCopy = page.locator('[data-action="ending-coffee-copy"]');
    await expect(joinCopy).toHaveAccessibleName('Copy link to the ThunderClap Gaming invite');
    await expect(coffeeCopy).toHaveAccessibleName("Copy link to ThunderSoap's Ko-fi");
    // Join stays centred: the Copy button hangs off its right side.
    const jb = (await page.locator('a.lr-end-join').boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(Math.abs(jb.x + jb.width / 2 - vw / 2)).toBeLessThan(4);
    const jcb = (await joinCopy.boundingBox())!;
    expect(jcb.x).toBeGreaterThan(jb.x + jb.width);
    expect(jcb.height).toBeLessThan(jb.height);

    await joinCopy.click();
    await expect(joinCopy).toHaveText(LINK_COPY_TEXT.copied);
    expect(await clipboardText(page)).toBe(DISCORD_INVITE_URL);
    await coffeeCopy.click();
    await expect(coffeeCopy).toHaveText(LINK_COPY_TEXT.copied);
    expect(await clipboardText(page)).toBe(KOFI_URL);

    // Arrow keys walk the card: Back, then Join, its Copy, Ko-fi, its Copy.
    await page.locator('.lr-end-back').focus();
    for (const sel of [
      'a.lr-end-join',
      '[data-action="ending-join-copy"]',
      'a.lr-end-coffee',
      '[data-action="ending-coffee-copy"]',
      '.lr-end-back',
    ]) {
      await page.keyboard.press('ArrowDown');
      await expect(page.locator(sel)).toBeFocused();
    }

    await page.waitForTimeout(500);
    expect(popups).toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
    ).toEqual([]);
    expect(page.url()).toBe(DEV_URL);
    expect(problems).toEqual([]);
  });
});

// First-time-player screenshots of every state (only with LINK_COPY_SHOTS set).
for (const [w, hgt, scale] of [
  [1920, 1080, 100],
  [1280, 720, 150],
] as const) {
  test(`screens at ${w} with ${scale}% text`, async ({ context, page }) => {
    test.skip(!SHOTS, 'set LINK_COPY_SHOTS to save screenshots');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: hgt });
    const tag = `${w}-${scale}`;
    await prepare(context, page, { popup: 'blocked' });
    await gotoTitle(page);
    await setTextScale(page, scale);
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-title`);
    await page.locator('[data-action="title-coffee-copy"]').click();
    await page.waitForTimeout(200);
    await shot(page, `${tag}-title-copied`);
    await page.locator('a.lr-title-coffee').focus();
    await padPress(page, 0);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-title-fallback`);

    await gotoEndCard(page, scale);
    await shot(page, `${tag}-end`);
    await page.locator('[data-action="ending-join-copy"]').click();
    await page.waitForTimeout(200);
    await shot(page, `${tag}-end-copied`);
    await page.locator('a.lr-end-join').focus();
    await padPress(page, 0);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-end-fallback`);
  });
}
