# E2E smoke tests (Playwright, Chromium + WebGPU)

```sh
pnpm exec playwright install chromium   # once per machine
pnpm test:e2e                           # builds, starts vite preview + itch-sim, runs tests
E2E_SKIP_BUILD=1 pnpm test:e2e          # reuse the existing dist/
pnpm exec playwright test --headed      # watch it
```

`playwright.config.ts` starts two servers:

| URL | What |
|---|---|
Ports come from `tests/e2e/ports.ts`. Inside a `.claude/worktrees/` checkout they shift by a stable per-worktree offset (or set `E2E_PORT_OFFSET`), so parallel agents never reuse each other's servers.

| `http://localhost:4173` | `vite preview` of `dist/` (top-level page) |
| `http://localhost:8790` | `scripts/itch-sim`: itch-like page embedding `dist/` in a cross-site iframe from `http://127.0.0.1:8791/html/0000000/` with itch.io's exact `allow` attribute |

## WebGPU in headless Chromium

Flags are chosen per OS in `playwright.config.ts` (override with `E2E_CHROMIUM_ARGS="..."`). Verified 2026-11-02 with Playwright 1.64.1 / Chromium 156:

| Platform | Flags | Adapter |
|---|---|---|
| macOS (Apple Silicon) | `--enable-unsafe-webgpu --use-angle=metal` | real GPU (`apple` / `metal-3`) |
| macOS, `--enable-unsafe-webgpu` only | | SwiftShader fallback (`isFallbackAdapter`) |
| macOS, no flags (headless shell) | | `requestAdapter()` → `null` |
| Linux (container / CI) | `--enable-unsafe-webgpu --use-angle=swiftshader --enable-features=Vulkan --use-webgpu-adapter=swiftshader` | SwiftShader (software) |

On Linux, leaving out `--use-angle=swiftshader` still gives an adapter, but canvas screenshots come back all black. That combination passed 140/140 runs in `mcr.microsoft.com/playwright:v1.64.1-noble` (arm64).

