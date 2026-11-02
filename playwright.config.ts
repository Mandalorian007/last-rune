import { defineConfig, devices } from '@playwright/test';

// E2E smoke for the production build. Run with `pnpm test:e2e` (see tests/e2e/README.md).
//
// Two servers:
//   - vite preview of dist/ at http://localhost:4173 (top-level page)
//   - itch-sim (scripts/itch-sim) at http://localhost:8790, which embeds the same dist/ in a
//     cross-site iframe from http://127.0.0.1:8791 with itch.io's exact iframe attributes.

// Keep in sync with tests/e2e/helpers.ts. E2E_PREVIEW_PORT / E2E_ITCH_PORT move the servers so
// parallel worktrees don't reuse each other's server (reuseExistingServer is on locally).
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4173);
const ITCH_PORT = Number(process.env.E2E_ITCH_PORT ?? 8790);
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const ITCH_SIM_URL = `http://localhost:${ITCH_PORT}`;

const isCI = !!process.env.CI;

/**
 * Chromium flags that give a WebGPU adapter in headless mode. Verified 2026-11-02 with
 * Playwright 1.64.1 / Chromium 156 (details in docs/research/itch-webgpu.md):
 *   - macOS: --enable-unsafe-webgpu + --use-angle=metal  → real Metal adapter (apple/metal-3).
 *     Without --use-angle=metal the headless shell falls back to SwiftShader; with no flags at
 *     all requestAdapter() resolves null.
 *   - Linux: SwiftShader (software Vulkan) adapter + SwiftShader ANGLE compositing; no GPU
 *     needed. Verified in the mcr.microsoft.com/playwright:v1.64.1-noble container.
 * Override with E2E_CHROMIUM_ARGS="--flag1 --flag2" if a machine needs something else.
 */
function webgpuArgs(): string[] {
  const override = process.env.E2E_CHROMIUM_ARGS;
  if (override) return override.split(/\s+/).filter(Boolean);
  const base = ['--enable-unsafe-webgpu'];
  if (process.platform === 'darwin') return [...base, '--use-angle=metal'];
  if (process.platform === 'linux') {
    // --use-angle=swiftshader matters: without it the adapter works but the compositor
    // presents an all-black canvas in screenshots.
    return [
      ...base,
      '--use-angle=swiftshader',
      '--enable-features=Vulkan',
      '--use-webgpu-adapter=swiftshader',
    ];
  }
  return base;
}

// E2E_SKIP_BUILD=1 reuses an existing dist/ (e.g. after `pnpm build` in CI).
const previewServe = `pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`;
const previewCommand = process.env.E2E_SKIP_BUILD ? previewServe : `pnpm build && ${previewServe}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-webgpu',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: webgpuArgs() },
      },
    },
  ],
  webServer: [
    {
      command: previewCommand,
      url: PREVIEW_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      // Serves dist/ lazily, so it is fine that the build above may still be running.
      command: `node scripts/itch-sim/serve.mjs --port ${ITCH_PORT}`,
      url: `${ITCH_SIM_URL}/`,
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
  ],
});
