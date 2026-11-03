import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, SAVE_KEY, trackProblems, waitFrames } from './helpers';

// mobile-perf: the page lifecycle a phone puts the game through. iOS and Android can freeze or
// kill a background tab without warning, so every way out (hidden, pagehide, freeze) must
// flush the save at once, stop drawing, and pause audio; coming back must resume both.
// Dev server: the `window.__game` handle lets the test write to the save without flushing.

// biome-ignore lint/suspicious/noExplicitAny: page-side handle
type G = any;

async function toHall(page: Page) {
  await page.addInitScript(() => {
    // Count frames the game schedules, and keep every AudioContext to read its state.
    let frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      frames++;
      return raf(cb);
    };
    const contexts: AudioContext[] = [];
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(o?: AudioContextOptions) {
        super(o);
        contexts.push(this);
      }
    };
    (window as unknown as { __life: () => { frames: number; audio: string[] } }).__life = () => ({
      frames,
      audio: contexts.map((c) => c.state),
    });
  });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
    null,
    { timeout: 60_000 },
  );
  // A click unlocks audio, then straight into the hall.
  const box = (await page.locator('#app canvas').first().boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + 4);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    g.save.update((d: G) => {
      d.flags.hallIntro = true;
      d.settings.captionSpeed = 'instant';
    });
    g.flow.continueGame();
  });
  await expect(page.locator('.lr-hud')).toBeVisible();
  await expect
    .poll(() => life(page).then((l) => l.audio.at(-1)), { timeout: 10_000 })
    .toBe('running');
}

function life(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __life: () => { frames: number; audio: string[] } }).__life(),
  );
}

/** Write a marker into the save (debounced, not yet on disk); returns what is on disk now. */
function writeMarker(page: Page, n: number) {
  return page.evaluate(
    ({ n, key }) => {
      const g = (window as unknown as { __game: G }).__game;
      g.save.update((d: G) => {
        d.stats.attempts = n;
      });
      return JSON.parse(localStorage.getItem(key) ?? '{}')?.d?.stats?.attempts ?? null;
    },
    { n, key: SAVE_KEY },
  );
}

function storedMarker(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}')?.d?.stats?.attempts ?? null,
    SAVE_KEY,
  );
}

function setHidden(page: Page, hidden: boolean) {
  return page.evaluate((hidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('hiding the tab flushes the save, stops frames and audio; showing it resumes both', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await toHall(page);
  expect(await writeMarker(page, 4101)).not.toBe(4101);
  await setHidden(page, true);
  expect(await storedMarker(page)).toBe(4101);
  await expect.poll(() => life(page).then((l) => l.audio.at(-1))).toBe('suspended');
  const before = (await life(page)).frames;
  await page.waitForTimeout(400);
  expect((await life(page)).frames).toBe(before);

  await setHidden(page, false);
  await expect.poll(() => life(page).then((l) => l.audio.at(-1))).toBe('running');
  await waitFrames(page, 5);
  expect((await life(page)).frames).toBeGreaterThan(before);
  expect(problems).toEqual([]);
});

test('pagehide and freeze flush the save; pageshow brings the game back', async ({ page }) => {
  const problems = trackProblems(page);
  await toHall(page);

  // pagehide (iOS: switching apps, closing the tab, bfcache).
  expect(await writeMarker(page, 4201)).not.toBe(4201);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  expect(await storedMarker(page)).toBe(4201);
  await expect.poll(() => life(page).then((l) => l.audio.at(-1))).toBe('suspended');
  const before = (await life(page)).frames;
  await page.waitForTimeout(300);
  expect((await life(page)).frames).toBe(before);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect.poll(() => life(page).then((l) => l.audio.at(-1))).toBe('running');
  await waitFrames(page, 5);
  expect((await life(page)).frames).toBeGreaterThan(before);

  // freeze (Chrome on Android freezes background tabs, then may discard them unannounced).
  expect(await writeMarker(page, 4202)).not.toBe(4202);
  await page.evaluate(() => document.dispatchEvent(new Event('freeze')));
  expect(await storedMarker(page)).toBe(4202);
  await page.evaluate(() => document.dispatchEvent(new Event('resume')));
  await waitFrames(page, 5);
  expect(problems).toEqual([]);
});
