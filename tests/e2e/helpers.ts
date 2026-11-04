/// <reference types="@webgpu/types" />
import type { Frame, Page } from '@playwright/test';

import { ITCH_GAME_ORIGIN } from './ports';

export { DEV_URL, ITCH_GAME_ORIGIN, ITCH_SIM_URL, PREVIEW_URL } from './ports';

/** Console noise that is not ours: Chromium warns about itch's non-standard allow tokens. */
const IGNORED_CONSOLE = [/Unrecognized feature: '(monetization|xr|web-share)'/];

/**
 * Collect console errors, uncaught exceptions and failed requests (4xx/5xx) for a page,
 * including its iframes. Call before navigating.
 */
export function trackProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    problems.push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    // Favicon misses are browser noise, not game assets.
    if (res.status() >= 400 && !res.url().endsWith('/favicon.ico')) {
      problems.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (!req.url().endsWith('/favicon.ico')) {
      problems.push(`request failed: ${req.url()} (${req.failure()?.errorText})`);
    }
  });
  return problems;
}

/** Wait until the game has put something into #app (text placeholder, canvas or a screen). */
export async function waitForBoot(target: Page | Frame) {
  await target.waitForFunction(() => (document.getElementById('app')?.childNodes.length ?? 0) > 0);
}

/** Probe WebGPU inside a page or frame. */
export function probeWebGPU(target: Page | Frame) {
  return target.evaluate(async () => {
    if (!navigator.gpu) return { adapter: false as const, reason: 'navigator.gpu missing' };
    // Linux SwiftShader occasionally (~1-3%) returns a null adapter, or an adapter whose
    // requestDevice() throws "external Instance reference no longer exists", when a second
    // adapter is requested while the game acquires its own. Retry briefly so this harness
    // check isn't flaky; the game's own boot is covered by the canvas tests.
    let reason = '';
    for (let i = 0; i < 4; i++) {
      if (i) await new Promise((r) => setTimeout(r, 250));
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          reason = 'requestAdapter() returned null';
          continue;
        }
        const device = await adapter.requestDevice();
        const result = {
          adapter: true as const,
          device: true,
          vendor: adapter.info.vendor,
          architecture: adapter.info.architecture,
          attempts: i + 1,
        };
        device.destroy();
        return result;
      } catch (e) {
        reason = String(e);
      }
    }
    return { adapter: false as const, reason };
  });
}

/**
 * Fraction of pixels in a PNG screenshot that are clearly not black. Decoding happens in the
 * browser (createImageBitmap + 2D canvas) so we need no image library in Node.
 */
export async function nonBlackFraction(page: Page, png: Buffer, threshold = 40) {
  return page.evaluate(
    async ({ b64, threshold }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.max(data[i], data[i + 1], data[i + 2]) > threshold) lit++;
      }
      return lit / (data.length / 4);
    },
    { b64: png.toString('base64'), threshold },
  );
}

/** Wait for the itch-sim iframe and return its Frame. */
export async function itchGameFrame(page: Page): Promise<Frame> {
  const handle = await page.locator('iframe#game_drop').elementHandle();
  if (!handle) throw new Error('itch-sim iframe#game_drop not found');
  for (let i = 0; i < 50; i++) {
    const frame = await handle.contentFrame();
    if (frame?.url().startsWith(ITCH_GAME_ORIGIN)) {
      await frame.waitForLoadState('load');
      return frame;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('itch-sim game frame never loaded');
}

// ── Gameplay helpers (full-run, playtest) ─────────────────────────────────────

/** localStorage key of the main save slot (engine/save envelope). */
export const SAVE_KEY = 'thunderclap:last-rune:main';

export interface SaveDataView {
  progress: { solved: string[] };
  puzzles: Record<string, { attempts: number; placements: unknown[] }>;
  journal?: { found: number[] };
  stats?: { attempts: number; breakersTripped: number; playSeconds: number };
}

/** Read the save as the game wrote it (read-only: tests never seed saves). */
export async function readSave(target: Page | Frame): Promise<SaveDataView | null> {
  const raw = await target.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  return raw ? (JSON.parse(raw) as { d: SaveDataView }).d : null;
}

/** Wait `n` real animation frames in the page (game state advances per frame, not per ms). */
export async function waitFrames(target: Page | Frame, n = 3) {
  await target.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);
}

/**
 * Press a key `times` times. Input collapses repeat taps of one key inside a single tick, so
 * wait three real frames (at least one fixed-step tick) between presses.
 */
export async function pressKey(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key, { delay: 50 });
    await waitFrames(page, 3);
  }
}

/**
 * Strike at the altar (F) and let the bolt run to its verdict. No Enter to skip it: in edit
 * mode Enter picks up the gem at the cursor, and on a loaded machine a short bolt can end
 * (several fixed steps run per frame) between the test seeing the strike and its Enter landing.
 * Enter then lifted a gem and hid the verdict ("F, wait 300 ms, Enter" did the same when both
 * keys reached one tick). Waits until the verdict shows, on the page's own frames.
 */
export async function strikeToVerdict(page: Page): Promise<void> {
  await page.keyboard.press('KeyF', { delay: 50 });
  await page.waitForFunction(
    () => {
      const verdict = document.querySelector<HTMLElement>('.lr-altar-verdict');
      return !!verdict && !verdict.hidden;
    },
    null,
    { polling: 'raf', timeout: 30_000 },
  );
}

/**
 * Waits until every element matching `selector` has the same box (whole CSS px) for 2
 * frames running: a layout that has finished moving, on game frames rather than wall time.
 */
export async function settled(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const w = window as unknown as { __tcSettle?: { key: string; same: number } };
      const key = [...document.querySelectorAll(sel)]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
        })
        .join(';');
      const st = w.__tcSettle;
      w.__tcSettle = { key, same: st && st.key === key ? st.same + 1 : 0 };
      if (w.__tcSettle.same < 2) return false;
      w.__tcSettle = undefined;
      return true;
    },
    selector,
    { polling: 'raf', timeout: 30_000 },
  );
}
