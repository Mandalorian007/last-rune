/// <reference types="@webgpu/types" />
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { DISCORD_INVITE_URL, KOFI_URL, LINK_COPY_TEXT } from '../../games/last-rune/content/ending';
import {
  DEV_URL,
  ITCH_GAME_ORIGIN,
  ITCH_SIM_URL,
  itchGameFrame,
  trackProblems,
  waitForBoot,
} from './helpers';

// Copy link beside every outbound link (title Ko-fi; end card Join and Ko-fi), for when a
// browser blocks the new tab. Covers: the clipboard gets the right URL; a refused or missing
// clipboard shows a selected read-only field instead; a pad press whose window.open is
// blocked shows the same field; and nothing opens or copies without the player acting.
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

type Setup = { clipboard?: 'ok' | 'reject' | 'missing'; exec?: 'fail'; popup?: 'blocked' };

/**
 * Stubs before the game loads: a controllable standard gamepad (`__pad`), window.open
 * recording calls (and returning null when `popup: 'blocked'`), and the clipboard mode.
 */
async function prepare(context: BrowserContext, page: Page, setup: Setup): Promise<void> {
  // Granted in every mode so the test can read the clipboard back; the stubs below refuse writes.
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
    if (s.clipboard === 'reject') {
      navigator.clipboard.writeText = () =>
        Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
    } else if (s.clipboard === 'missing') {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    }
    if (s.exec === 'fail') document.execCommand = () => false;
  }, setup);
}

/** Presses and releases a pad button across a few frames. */
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
  await set(true);
  await page.waitForTimeout(150);
  await set(false);
  await page.waitForTimeout(150);
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

/** The fallback field is shown, says `message`, holds `url`, and has it all selected. */
async function expectFallback(fallback: Locator, message: string, url: string): Promise<void> {
  await expect(fallback).toBeVisible();
  await expect(fallback.locator('label')).toHaveText(message);
  const field = fallback.locator('input');
  await expect(field).toHaveValue(url);
  await expect(field).toHaveAttribute('readonly', '');
  await expect(field).toBeFocused();
  const sel = await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
  expect(sel).toEqual([0, url.length]);
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
  test('title: Copy link puts the Ko-fi URL on the clipboard, and nothing opens on its own', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
    const problems = trackProblems(page);
    const popups = popupsOf(page);
    await prepare(context, page, {});
    await gotoTitle(page);
    await page.waitForTimeout(1000);
    // Nothing on the clipboard, nothing opened, before the player does anything.
    expect(
      await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
    ).toEqual([]);
    expect(popups).toEqual([]);
    await page.evaluate(() => navigator.clipboard.writeText('untouched'));
    await page.waitForTimeout(500);
    expect(await clipboardText(page)).toBe('untouched');

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

    await page.waitForTimeout(500);
    expect(popups).toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
    ).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('title: a refused clipboard and a failed execCommand show the link in a selected field', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
    const problems = trackProblems(page);
    await prepare(context, page, { clipboard: 'reject', exec: 'fail' });
    await gotoTitle(page);
    const fallback = page.locator('[data-action="title-coffee-fallback"]');
    await expect(fallback).toBeHidden();
    await page.locator('[data-action="title-coffee-copy"]').click();
    await expectFallback(fallback, LINK_COPY_TEXT.copyBlocked, KOFI_URL);
    // Close (or Escape) puts it away and focus back on Copy link.
    await page.locator('[data-action="title-coffee-close"]').click();
    await expect(fallback).toBeHidden();
    await expect(page.locator('[data-action="title-coffee-copy"]')).toBeFocused();
    await page.locator('[data-action="title-coffee-copy"]').click();
    await expect(fallback).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fallback).toBeHidden();
    // Still on the title: pressing Copy did not start the game.
    expect(
      await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.flow.state),
    ).toBe('title');
    expect(problems).toEqual([]);
  });

  test('title: a refused writeText still copies through execCommand', async ({ context, page }) => {
    test.setTimeout(60_000);
    const problems = trackProblems(page);
    await prepare(context, page, { clipboard: 'reject' });
    await gotoTitle(page);
    // Read back through the real clipboard (the stub only replaced writeText).
    const copy = page.locator('[data-action="title-coffee-copy"]');
    await copy.click();
    await expect(copy).toHaveText(LINK_COPY_TEXT.copied);
    expect(await clipboardText(page)).toBe(KOFI_URL);
    await expect(page.locator('[data-action="title-coffee-fallback"]')).toBeHidden();
    await expect(copy).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('title: gamepad A on Ko-fi with the new tab blocked shows the copy field', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
    const problems = trackProblems(page);
    await prepare(context, page, { popup: 'blocked' });
    await gotoTitle(page);
    const link = page.locator('a.lr-title-coffee');
    await link.focus();
    await padPress(page, 0);
    expect(
      await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
    ).toEqual([KOFI_URL]);
    await expectFallback(
      page.locator('[data-action="title-coffee-fallback"]'),
      LINK_COPY_TEXT.popupBlocked,
      KOFI_URL,
    );
    expect(
      await page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.flow.state),
    ).toBe('title');
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

  test('end card: no clipboard API, and a blocked pad open, both show the field', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const problems = trackProblems(page);
    await prepare(context, page, { clipboard: 'missing', exec: 'fail', popup: 'blocked' });
    await gotoEndCard(page);

    await page.locator('[data-action="ending-coffee-copy"]').click();
    await expectFallback(
      page.locator('[data-action="ending-coffee-fallback"]'),
      LINK_COPY_TEXT.copyBlocked,
      KOFI_URL,
    );

    await page.locator('a.lr-end-join').focus();
    await padPress(page, 0);
    expect(
      await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
    ).toEqual([DISCORD_INVITE_URL]);
    await expectFallback(
      page.locator('[data-action="ending-join-fallback"]'),
      LINK_COPY_TEXT.popupBlocked,
      DISCORD_INVITE_URL,
    );
    // Back is still on screen and reachable.
    const back = page.locator('.lr-end-back');
    await expect(back).toBeInViewport();
    expect(problems).toEqual([]);
  });
});

// itch's game iframe has no clipboard-write in its allow list, so Chromium refuses writeText
// there (https://github.com/itchio/itch.io/issues/1202). Copy must still land, via execCommand,
// or else show the field. itch-sim uses itch's exact allow list.
test("itch embed: Copy link still copies the Ko-fi URL inside itch's iframe", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(ITCH_SIM_URL).origin,
  });
  // Record what writeText did in the game frame (it is expected to be refused there).
  await page.addInitScript(() => {
    if (!navigator.clipboard?.writeText) return;
    const real = navigator.clipboard.writeText.bind(navigator.clipboard);
    const w = window as unknown as { __writeText?: string };
    navigator.clipboard.writeText = (t: string) =>
      real(t).then(
        () => {
          w.__writeText = 'ok';
        },
        (e: unknown) => {
          w.__writeText = 'refused';
          throw e;
        },
      );
  });
  await page.goto(`${ITCH_SIM_URL}/?autoload=1`);
  const frame = await itchGameFrame(page);
  expect(new URL(frame.url()).origin).toBe(ITCH_GAME_ORIGIN);
  await waitForBoot(frame);
  const copy = frame.locator('[data-action="title-coffee-copy"]');
  await expect(copy).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => navigator.clipboard.writeText('untouched'));
  await copy.click();

  const fallback = frame.locator('[data-action="title-coffee-fallback"]');
  await expect
    .poll(
      async () => (await fallback.isVisible()) || (await copy.textContent())?.includes('Copied'),
    )
    .toBe(true);
  // Chromium exposes the frame's policy, so writeText is not even tried (no policy error);
  // where it is tried, it is refused. Either way the copy went another route.
  expect(await frame.evaluate(() => (window as { __writeText?: string }).__writeText)).not.toBe(
    'ok',
  );
  if (await fallback.isVisible()) {
    await expect(fallback.locator('input')).toHaveValue(KOFI_URL);
  } else {
    await expect(copy).toHaveText(LINK_COPY_TEXT.copied);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(KOFI_URL);
  }
  expect(problems).toEqual([]);
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
