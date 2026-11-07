/// <reference types="@webgpu/types" />
import { expect, test } from '@playwright/test';
import { nonBlackFraction, PREVIEW_URL, probeWebGPU, trackProblems, waitForBoot } from './helpers';

// Smoke tests for the production build (vite preview of dist/). Several tests depend on engine-render's WebGPU boot; until it merges,
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

// The itch.io embed (cross-site iframe, WebGPU, localStorage, fullscreen, click-to-launch) is an
// engine host check now: packages/engine/e2e/host.spec.ts on its itch-iframe row.
