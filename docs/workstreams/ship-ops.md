# Workstream: ship-ops

**Owns:** `scripts/`, `.github/workflows/`, `playwright.config.ts`, `tests/e2e/`, `docs/shipping-itch.md`, `docs/research/`.

## Deliver
1. **Research** (`docs/research/itch-webgpu.md`), with sources linked and access dates. Use the web:
   - itch.io HTML5 game requirements: zip structure (`index.html` at root), file count/size limits, case sensitivity, embed options (viewport size, fullscreen button, scrollbars, mobile-friendly flag, "click to launch" vs autoplay), SharedArrayBuffer option, CDN paths.
   - **WebGPU in the itch.io iframe:** does the iframe's permissions policy allow WebGPU (`allow` attribute; the `webgpu` permissions-policy feature and its default allowlist)? What happens in Chrome, Edge, Safari 26+ and Firefox. If it is blocked or unclear, what are the workarounds (e.g. the "launch in new window" embed mode)? This is a **ship-blocking risk**, so be precise.
   - `localStorage` inside the itch iframe (third-party storage partitioning in Chrome/Safari/Firefox; does it persist across sessions?).
   - Audio autoplay unlock in the iframe; fullscreen API in the iframe.
   - **butler** CLI for uploads (channels, versioning). Do **not** upload anything and do not require credentials in the repo.
   - Tip jar = itch's "pay what you want / donations" setting. Note how it's configured (page settings), and what the user must do manually.
2. **`docs/shipping-itch.md`**: step-by-step ship runbook (build → zip → upload via web UI or butler → page settings, with recommended embed settings → page copy checklist → post-launch). Include the itch page settings we recommend: 960×540 viewport, fullscreen button on, and the click-to-launch choice from your research.
3. **`scripts/package-itch.mjs`**: runs the production build and zips `dist/` with `index.html` at the root into `build/last-rune-itch-<version>.zip`. Validates the limits from your research (file count, sizes, no absolute `/` asset URLs in the built HTML/JS/CSS, no source maps unless intended). Pure Node, or a small, justified devDep for zipping.
4. **CI** `.github/workflows/ci.yml`: on push/PR to main, set up pnpm (via the `packageManager` field) and Node 22, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and upload `dist` as an artifact. Cache pnpm store. Keep it fast. Add the e2e job only if it runs reliably on GitHub runners (WebGPU headless may need flags/SwiftShader); otherwise leave it local-only and document why.
5. **Playwright** `playwright.config.ts` + `tests/e2e/smoke.spec.ts`: launches `vite preview` (or dev), opens the game in Chromium with WebGPU enabled (research the flags: `--enable-unsafe-webgpu`, `--enable-features=Vulkan`, SwiftShader/`--use-angle` as needed on macOS/Linux headless), asserts no console errors, and asserts the canvas renders non-black pixels. Also a test that forces `navigator.gpu` undefined and asserts the unsupported screen appears (it will exist once engine-render merges; write the test against `#app` text containing "WebGPU", or mark it `fixme` with a note). Document how to run it locally on macOS.
6. A **local itch simulation**: a tiny static page under `scripts/itch-sim/` that embeds the built game in a cross-origin-like iframe at 960×540 with the same `allow` attributes itch uses (from your research), served via a script (`pnpm itch:sim`), so we can test iframe behaviour locally.

## Quality bar
Accuracy over speed: cite sources for every itch claim. Nothing in the repo needs credentials.

## Log
_(agent appends progress, decisions, open issues here)_

### 2026-11-02 — ship-ops wave 1

**Done**
- `scripts/package-itch.mjs` builds `dist/`, checks it against itch's upload rules (`scripts/lib/itch-validate.mjs`) and writes `build/last-rune-itch-<version>.zip` with a deterministic zip writer that needs no dependencies (`scripts/lib/zip.mjs`). 11 unit tests run under `pnpm check`.
- `scripts/itch-sim/` and `pnpm itch:sim` run a local itch page. The game loads in a cross-site iframe (localhost → 127.0.0.1) with itch's exact `allow` attribute at 960×540.
- `playwright.config.ts` and `tests/e2e/` hold the WebGPU smoke tests:
  - flags are chosen per OS (macOS: `--enable-unsafe-webgpu --use-angle=metal`; Linux: SwiftShader)
  - the suite covers console errors, canvas pixels, the unsupported screen and the itch iframe
  - canvas and unsupported-screen tests are `fixme` while `main.ts` is the scaffold placeholder
  - all 7 tests passed against a stand-in WebGPU boot
- `.github/workflows/ci.yml` runs check, build and package, then uploads the `dist` and `itch-zip` artifacts. It needs no secrets.
- `.github/workflows/e2e.yml` runs e2e by hand only (`workflow_dispatch`) on `ubuntu-24.04-arm`.
- Docs: `docs/research/itch-webgpu.md`, `docs/shipping-itch.md`, `tests/e2e/README.md`.

**Decisions**
- WebGPU works inside itch's iframe. No browser has a `webgpu` permissions-policy feature, and live itch frames passed in Chromium and WebKit. Embed setting: "Embed in page".
- Recommended embed settings: 960×540, Click to Play on, fullscreen button on, scrollbars off, Mobile Friendly off, SharedArrayBuffer **off**.
- E2E is not a merge gate. Linux SwiftShader passed 140/140 in the Playwright container on arm64, but the suite hasn't run on real GitHub runners, and x86 emulation couldn't launch Chromium.

**Open issues / for PM**
- engine-systems: all itch games share one `localStorage` (itch.io + html-classic.itch.zone). Prefix keys with `last-rune:`, never call `clear()`, and wrap access in try/catch with an in-memory fallback. Proposed as a DECISIONS entry.
- Proposed DECISIONS entry: the itch embed settings above, and SharedArrayBuffer must never be turned on (doing so wipes saves).
- Firefox is untested: Playwright Firefox won't launch on this Mac. Test it by hand on the live page before announcing.
- After engine-render merges: delete the `fixme` lines in `tests/e2e/smoke.spec.ts`, run the e2e workflow a few times, then consider adding it to push/PR.
- Shared files changed: `vite.config.ts` (vitest include `scripts/**/*.test.ts`) and `package.json` (`itch:sim` script).
