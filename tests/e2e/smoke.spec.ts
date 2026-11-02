/// <reference types="@webgpu/types" />
import { expect, test } from '@playwright/test';
import {
  ITCH_GAME_ORIGIN,
  ITCH_SIM_URL,
  itchGameFrame,
  nonBlackFraction,
  PREVIEW_URL,
  probeWebGPU,
  trackProblems,
  waitForBoot,
} from './helpers';

// Smoke tests for the production build (vite preview of dist/) and for the itch.io embed
// (scripts/itch-sim). Several tests depend on engine-render's WebGPU boot; until it merges,
// engine-render boot is merged; all tests are strict.

test.describe('production build', () => {
  test('boots without console errors or failed requests', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto(PREVIEW_URL);
    await waitForBoot(page);
    // Let the first frames run so async boot errors surface.
    await page.waitForTimeout(1000);
    expect(problems).toEqual([]);
  });

  test('test browser exposes a WebGPU adapter (harness sanity)', async ({ page }) => {
    await page.goto(PREVIEW_URL);
    const gpu = await probeWebGPU(page);
    test.info().annotations.push({ type: 'webgpu-adapter', description: JSON.stringify(gpu) });
    expect(
      gpu.adapter,
      'No WebGPU adapter: check Chromium flags in playwright.config.ts (E2E_CHROMIUM_ARGS)',
    ).toBe(true);
  });

  test('renders a canvas with non-black pixels', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto(PREVIEW_URL);

    const canvas = page.locator('#app canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
    // Give the renderer a moment to present real frames (title scene, bloom, etc.).
    await page.waitForTimeout(1500);
    const lit = await nonBlackFraction(page, await canvas.screenshot());
    test.info().annotations.push({ type: 'non-black-fraction', description: lit.toFixed(4) });
    expect(lit, 'canvas looks all black: WebGPU frames are not being presented').toBeGreaterThan(
      0.01,
    );
    expect(problems).toEqual([]);
  });

  test('shows the unsupported screen when navigator.gpu is missing', async ({ page }) => {
    await page.addInitScript(() => {
      // Remove WebGPU entirely, as in a browser without it (e.g. Firefox on Linux).
      delete (Navigator.prototype as { gpu?: unknown }).gpu;
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    });
    const problems = trackProblems(page);
    await page.goto(PREVIEW_URL);
    const app = page.locator('#app');
    await waitForBoot(page);

    await expect(app).toContainText(/WebGPU/i);
    // D-002: the screen names the supported browsers.
    await expect(app).toContainText(/Chrome|Edge|Safari/);
    expect(problems).toEqual([]);
  });

  test('shows the unsupported screen when requestAdapter() resolves null', async ({ page }) => {
    await page.addInitScript(() => {
      // navigator.gpu exists but there is no usable adapter (blocklisted GPU/driver).
      GPU.prototype.requestAdapter = async () => null;
    });
    await page.goto(PREVIEW_URL);
    const app = page.locator('#app');
    await waitForBoot(page);

    await expect(app).toContainText(/WebGPU/i);
  });
});

test.describe('itch.io embed (itch-sim)', () => {
  test('game loads in a cross-site iframe with WebGPU and localStorage', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto(`${ITCH_SIM_URL}/?autoload=1`);
    const frame = await itchGameFrame(page);
    expect(new URL(frame.url()).origin).toBe(ITCH_GAME_ORIGIN);

    // WebGPU is not gated by a permissions policy; it must work in itch's iframe.
    const gpu = await probeWebGPU(frame);
    expect(gpu.adapter).toBe(true);

    // Partitioned localStorage must be usable from inside the iframe.
    const stored = await frame.evaluate(() => {
      const k = 'last-rune:e2e-probe';
      localStorage.setItem(k, 'ok');
      const v = localStorage.getItem(k);
      localStorage.removeItem(k);
      return v;
    });
    expect(stored).toBe('ok');

    // itch's allow list includes fullscreen and autoplay.
    expect(await frame.evaluate(() => document.fullscreenEnabled)).toBe(true);

    await waitForBoot(frame);
    await page.waitForTimeout(1000);
    // Catches absolute URLs and wrong-case paths: itch-sim 404s them like itch's CDN does.
    expect(problems).toEqual([]);
  });

  test('click-to-launch flow starts the game at 960x540', async ({ page }) => {
    await page.goto(ITCH_SIM_URL);
    await page.getByRole('button', { name: /Run game/ }).click();
    const frame = await itchGameFrame(page);
    const size = await frame.evaluate(() => [innerWidth, innerHeight]);
    expect(size).toEqual([960, 540]);

    const canvas = frame.locator('#app canvas').first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await nonBlackFraction(page, await canvas.screenshot())).toBeGreaterThan(0.01);
  });
});
