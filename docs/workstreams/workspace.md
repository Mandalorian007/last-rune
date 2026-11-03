# Workstream: workspace (Phase 1, first; it blocks host, promote-ui and create-game)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/workspace. Decision: D-041. The game must run identically at the end of this workstream: there are no layout or renderer changes.

## Scope
1. **Move the engine.** Move `engine/` to `packages/engine/`, as `@thunderclap/engine`, version `0.2.0-dev`.
   - Give it its own package.json, an exports map per module (`./input`, `./ui`, `./platform`, `./render`, …), a tsconfig, and its own test and check scripts.
   - The root becomes a pnpm workspace. `games/last-rune` depends on `@thunderclap/engine` via `workspace:*`. Choose the least disruptive shape: if the game stays at the root package, say so and justify it.
2. **Imports.** Replace the `@engine/*` alias with package imports everywhere (game, tests, scripts, vite and vitest config).
   - Add a lint or check that fails if a game file imports `packages/engine/src/**` directly instead of going through the exports map.
3. **Docs.**
   - `packages/engine/ARCHITECTURE.md` gets the plan's "Contracts" section, one paragraph per contract, as the target. Mark what exists today vs what is planned.
   - Start `packages/engine/CHANGELOG.md` at 0.2.0-dev.
   - Update `docs/architecture.md` and `docs/engineering.md` paths.
4. **CI.** Engine tests and game tests run as separate jobs in `.github/workflows/ci.yml`. The Pages deploy must still work: check `base`, the build output and the workflow paths.

## Gate checks (yours)
- `pnpm check` and `pnpm build` are green.
- `pnpm test:e2e` is green, with full-run 16/16.
- `pnpm baseline` (from v1-ship) shows no pixel change on desktop.
- No game import exists inside `packages/engine`; check with `grep -r "games/" packages/engine/src`.
- `pnpm package:itch` still produces a valid zip.

## Rules
- **Don't change:** rules, content, art, audio or shaders, other than import paths.
- **Commit** to `ws/workspace` and never merge.
- pnpm only. No new runtime deps (D-008). Dev deps are fine if justified in the log.

## Added by the PM (D-041 addendum 2: test ownership)
- Set up `packages/engine` test infrastructure:
  - `vitest` for unit tests;
  - an engine e2e harness: its own Playwright project, served from `packages/engine/harness/` as a noun-free page, with a viewport, device and wrapper matrix that includes an itch-style cross-origin iframe.
- Seed the harness with one smoke spec: WebGPU init, surface resize, one input tap.
- CI runs engine and game test jobs separately.
- Do not move game specs yet. `docs/engine/test-split.md` (being written) maps what moves where.

## Log

### 2026-11-03: package move, boundary check, CI split (commit 63aca2f, then main merged)
- **Layout chosen.** `git mv engine packages/engine/src`. `packages/engine/package.json` is `@thunderclap/engine` 0.2.0-dev with its own `tsconfig.json`, `vitest.config.ts` and `typecheck`/`lint`/`test`/`check` scripts. The exports map has one subpath per module (`./audio`, `./core`, `./fx`, `./input`, `./platform`, `./post`, `./render`, `./save`, `./ui`), plus `./testing` for the recording fake GPU device (was `@engine/render/fake-gpu`, used by one game test and two engine tests). It points at `.ts` source; the game's Vite build compiles it, so there is no engine build step until Phase 5. History follows (`git log --follow packages/engine/src/render/renderer.ts` reaches the first engine-render commit).
- **The game stays the root package** (`last-rune`, depending on `@thunderclap/engine: workspace:*`); `pnpm-workspace.yaml` lists only `packages/*`. Why: every tool works on the root today (Vite config, `dist/`, Playwright with its three servers, itch-sim, `package:itch`, perf and audio scripts, Pages, `.claude` hook). Moving the game into its own package would have moved all of that for no gain. At Phase 5 the engine leaves and the root simply stays the game. A `games/last-rune/package.json` can come later if a second game joins this repo.
- **Imports.** Everything in `games/` now imports `@thunderclap/engine/<module>`. The engine's own cross-module imports (`fx`, `post` → `render`) are relative. The `@engine` alias is gone from `tsconfig.json` and `vite.config.ts`; `@game` stays. A missed relative import (`content/ending.ts` → `../../../engine/platform/links`, there because content is also loaded under Node) now goes through `@thunderclap/engine/platform`. I checked that it still loads under `tsx`.
- **Boundary check:** `scripts/check-boundaries.mjs`, run as `pnpm check:boundaries` inside `pnpm check`. It fails on three things:
  - outside the engine (games, tests, scripts, tools, root configs): any `@engine/*`, any `@thunderclap/engine/...` subpath that isn't a key in the exports map (it reads package.json, so new modules like `./host` only need the map entry), or any relative or root-absolute path into `packages/engine/`;
  - inside `packages/engine/src`: any `@game/*` or `games/` import, or any path that leaves `src/`;
  - any engine import in `games/*/rules/`.
  I verified it by planting one violation of each kind (all caught, exit 1). I chose a script over Biome's `noRestrictedImports` because relative-path depth varies and the script also reads the exports map. `grep -r "games/" packages/engine/src` finds no imports, only prose in comments and READMEs.
- **Scripts.** `pnpm check` = `check:engine` (`pnpm --filter @thunderclap/engine check`) + `check:game` (typecheck, lint of the whole repo, check:boundaries, game unit tests). There is also `pnpm test:engine`. Root `typecheck` still typechecks the engine sources the game imports, under the same options.
- **CI.** `ci.yml` has two jobs:
  - `engine check`, which runs `pnpm check:engine`;
  - `check + build + package`, which runs `check:game`, `build` and `package:itch`. It keeps the old job name so an existing required status check still matches.
  `pages.yml` is unchanged: `pnpm check` runs both halves, `base: './'` and the `dist/` output are unchanged, and the artifact path is still `dist`. `e2e.yml` is unchanged.
- **Dev deps.** The engine package declares the dev deps it needs on its own (`@biomejs/biome`, `@webgpu/types`, `happy-dom`, `typescript`, `vite` (for `vite/client` types; `audio/synth.ts` reads `import.meta.env`), `vitest`). They use the same versions as the root, so the lockfile only adds links. No runtime deps were added; the root's one new `dependencies` entry is the workspace engine itself.
- **Docs.**
  - New in the package: `packages/engine/ARCHITECTURE.md` (the plan's contracts, one paragraph each, each marked Today or Planned with its phase) and `CHANGELOG.md` (0.2.0-dev).
  - Updated: `docs/architecture.md` (tree, rules 1–3, C5–C7), `docs/engineering.md` (workspace, three tsconfig projects, commands, paths), `README.md`, `scripts/perf/README.md`, the module READMEs (`@thunderclap/engine/...` in examples).
- **Identical game.** Built against main's tree (both 61392dd and, after the merge, 7268ccc), `dist/` is byte-identical: same `index-*.js` hash and `diff -r` clean. The engine move cannot change pixels.
- **Results:**
  - `pnpm check`: green, engine 18 files / 210 tests, game 44 files / 573 tests (+2 skipped); 62 test files, as before the move.
  - `pnpm build`: green.
  - `pnpm package:itch --skip-build`: `build/last-rune-itch-0.0.1.zip`, 272 KB, validation passed.
  - `pnpm test:e2e`, first run (load average ~49): 123 passed, 3 failed, 2 skipped. Full-run was 16/16.
    - Two failures were `mobile-zoom.spec.ts:440` (minimap hidden, se/iphone). They also failed on main's own tree at 61392dd, and main's 031b2ca minimap fix cures them: after merging main, mobile-zoom passed 12/12.
    - The third, `mobile.spec.ts:416`, passed when rerun alone. It was load.
- **Not done yet.**
  - `pnpm baseline` (v1-baselines) and mobile-7-teach have not landed on main yet. When the PM says they have, I merge main, fix any `@engine` imports they add (the boundary check names each one), and run `pnpm baseline`.
  - After merging main (7268ccc), I reran the full `pnpm test:e2e` (load average ~40): 125 passed, 1 failed, 2 skipped. Full-run was 16/16 again. The one failure was `mobile.spec.ts:416`, the same load flake as before; it passes alone (1/1, 4.2 s).

### 2026-11-03: engine e2e harness (D-041 addendum 2)
- **Harness page** `packages/engine/harness/` (`index.html`, `main.ts`, `state.ts`). It is noun-free: it calls `boot()` and gets a 1920×1080 letterboxed `Surface`, one `Input` action (`tap` = mouse 0, which covers touch and pen), and a `GameLoop` that clears and presents the swapchain each frame. It publishes `window.__harness`: gpu status and format, embedded, frames, resizes, rect, container, backbuffer, the presented texture size, and taps with their logical position and device. Vite serves it (`vite.harness.config.ts`, root `harness/`). Run it by hand with `pnpm --filter @thunderclap/engine harness`.
- **Its own Playwright project**, `packages/engine/playwright.config.ts` (testDir `e2e/`). It is separate from the game's `tests/e2e` and uses the same WebGPU flags.
  - Matrix: `desktop-1280`, `desktop-1920`, `ipad` (1180×820), `phone-se`, `phone-iphone`, `phone-promax` and `phone-android` (the mobile specs' sizes; touch projects use isMobile, hasTouch and DPR 2), plus `itch-iframe`.
  - `itch-iframe`: `e2e/wrapper.mjs` serves a page on `localhost` that embeds the harness from `127.0.0.1` (cross-site) in a 960×540 iframe with itch's exact attributes and `allow` list.
  - The fixture option `wrapper: 'top' | 'itch-iframe'` hands specs the right frame (`e2e/fixtures.ts`).
  - Ports (`e2e/ports.ts`) use the same per-worktree offset as the game's and end in 7 and 8, so they never collide with the game's.
- **Seed spec** `e2e/smoke.spec.ts`, one test per project:
  - WebGPU boots (`gpu: 'ok'`, bgra8unorm or rgba8unorm) and frames present.
  - The surface is the centred contain fit of its container, with DPR ≤ 2, the backbuffer keeping the aspect, and the swapchain presenting at the backbuffer size.
  - After a resize to 60% width (the viewport, or the wrapper's iframe box), it follows again.
  - One tap (touch projects) or click at the canvas centre gives exactly one `tap` press at logical (960, 540) from `touch` or `mouse`.
  - Negative check: with `E2E_CHROMIUM_ARGS=--disable-gpu` it fails on "WebGPU boot: no-adapter", as it should.
- **Scripts and config:**
  - Engine: `test:e2e`, `harness`; `typecheck` also runs `tsconfig.e2e.json` (adds node types for e2e/ and configs only, so `src/` stays DOM-only).
  - Root: `pnpm test:e2e:engine`.
  - Engine devDeps: `@playwright/test` and `@types/node`, both already in the root lockfile. No runtime deps.
- **CI:** a new `engine e2e` job in ci.yml. It uses the same `ubuntu-24.04-arm` runner and Playwright container as e2e.yml, runs `pnpm test:e2e:engine` and uploads the report on failure. It is `continue-on-error: true`, so it runs on every push and PR but does not gate main yet.
  - Why not a gate: in that container (run locally under Docker), SwiftShader intermittently loses the WebGPU device ("A valid external Instance reference no longer exists"). The engine shows its device-lost screen, and the test times out.
    - With 5 workers: 6 of 20 phone runs (with the resize) and 7 of 20 (without). iPad passed 8/8 both times.
    - With 1 worker: the phones passed 12/12. Over the full matrix twice, 2 of 16 failed (one phone-iphone, one desktop-1280).
    - So it is not resize-related.
    - The config therefore uses `workers: 1` and `retries: 1` under CI. Promote the job to a gate after a few green runs on GitHub.
    - Worth knowing for the game e2e too: the same SwiftShader path backs e2e.yml.
  - macOS (Metal) passes 8/8 with 5 workers, so locally it is solid.
- **Docs:**
  - `packages/engine/ARCHITECTURE.md` (package shape and test ownership), `CHANGELOG.md`, `docs/engineering.md`.
  - Dropped the obsolete zoom.ts → camera2d mentions (addendum 1) from ARCHITECTURE.md and from the open issues below.
- No game specs moved. The game's `pnpm test:e2e` is untouched (testDir `tests/e2e`).

### Open issues for later Phase 1 workstreams
- **host:** create `packages/engine/src/host/` and add `"./host": "./src/host/index.ts"` to the exports map; the boundary check picks it up. Today `window.open`/`navigator.clipboard`/`localStorage` appear in `platform/links.ts`, `ui/link.ts`, `ui/padnav.ts`, `save/storage.ts`, `save/store.ts`.
- **promote-ui:** new engine files go under `packages/engine/src/<module>/` and are re-exported from that module's `index.ts`. The game must import the promoted code from its module subpath (`@thunderclap/engine/ui`, …), not a deep path. (The zoom.ts → camera2d promotion is off since D-041 addendum 1.) List each promotion in `CHANGELOG.md`.
- **Engine e2e (whoever moves specs per `docs/engine/test-split.md`):**
  - Add a probe to `harness/main.ts` and a spec under `packages/engine/e2e/`; every spec runs on the whole matrix.
  - Phone safe-area insets (iphone 47, promax 59) are not emulated yet; the layout contract should add that.
  - `itch-iframe` runs at desktop size only. Add a phone-sized iframe entry if a capability needs it.
- **create-game:** if `core/game.ts` needs other modules it imports them relatively. Consider whether `createGame` belongs on `./core` or a new top-level `"."` export.
- **PM:**
  - CLAUDE.md still says "`engine/` has zero game nouns" (PM-owned, not edited). PLAN/STATUS rows are yours.
  - `biome check .` at the root also lints the engine, so CI lints the engine twice. That is cheap, and I left it on purpose so `pnpm lint` stays whole-repo.
