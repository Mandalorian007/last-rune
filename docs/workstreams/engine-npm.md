# Workstream: engine-npm (D-052)

The Last Rune leaves its in-repo engine copy and runs on the published engine from npm: `@thunderclap-engine/engine@^1.1.0` plus `@thunderclap-engine/host-electron@^0.1.0`. This makes it the first title on the published engine. Branch: `ws/engine-npm`, cut from `ws/one-overlay` (one CSS-px overlay; already drops `ctx.chrome`, `CssChrome`, `avoid()`, `setRect`).

Read first:
- `docs/DECISIONS.md` D-052, D-044, D-046, D-048, D-049
- `docs/workstreams/one-overlay.md`, especially its Log
- Upstream (local clone `~/repos/thunderclap-engine`, read-only for you):
  - `CHANGELOG.md` 1.0.0 and 1.1.0: Removed, Renamed
  - `api/*.api.txt`
  - `README.md` (Install, Modules)
  - `docs/` migration guide, if there is one

## Known breakage (PM trial, 2026-11-07, on main)
Swapping the imports on main gave 69 tsc errors in 21 files:
- Renames:
  - `PostSettings.fog` → `mist` (14 sites)
  - platform `prefersReducedMotion` → `isReducedMotion`
  - input `Rect` → `Edges`
  - `Host` now needs `requestFrame`/`cancelFrame`; use the npm host-electron or the engine's web host
- Removed:
  - `ctx.device` (20 sites)
  - `ctx.setFill` / `computeFillWidth` / `FillWidthOptions` / `fillBands`: a 2D game frames `ui.layout.freeRect` with `renderer.camera.fitRect`
  - `ctx.chrome` / `CssChrome` (12 sites; gone on ws/one-overlay)
  - `overlay.setRect`
  - `CaptionCard.avoid`
- Also: `Camera` argument changes in two calls, one call that now takes 1 argument instead of 3, and `createGame`'s `overlay: { layout }` option shape.

ws/one-overlay is 18 commits behind main. Those commits include D-048 chain placement, the D-049 teach overlay and D-050 share embeds.

## Do
1. **Rebase onto main.** Merge `main` into `ws/engine-npm` first and resolve conflicts, keeping main's product behaviour (D-048, D-049, D-050, polish). Commit.
2. **Swap the dependency.**
   - `pnpm add @thunderclap-engine/engine@^1.1.0 @thunderclap-engine/host-electron@^0.1.0`.
   - Rewrite every import `@thunderclap/engine…` → `@thunderclap-engine/engine…` and `@thunderclap/host-electron` → `@thunderclap-engine/host-electron`. Use public subpaths only; there are no deep `src/` imports.
   - Delete `packages/engine` and `packages/host-electron`, plus any workspace entries, tsconfig paths or Vite aliases pointing at them.
   - Add `@webgpu/types` to tsconfig `types` if needed.
3. **Fix the game to the v1 API.**
   - Apply the renames.
   - Replace `device` / `setFill` with the layout model: form factor from `ui.layout`, and world framing via `renderer.camera.fitRect(ui.layout.freeRect)`.
   - Desktop and iPad must look the same as v1.0. Phones must keep the D-048/D-049 behaviour and the dense-board work.
4. **Tooling.**
   - `package.json`: drop `check:engine`, `test:engine`, `test:e2e:engine`, `check:host-electron`, `engine:release` and `desktop:build:shell` where they pointed at the deleted packages.
   - `check` becomes the game check.
   - Point the desktop scripts (`scripts/desktop/*`, `desktop:dev`, `desktop:build`, `test:e2e:desktop`) at the npm host. Read its README for how a game plugs in.
   - Keep `scripts/check-boundaries.mjs` meaningful: the game imports only the engine's public entry points.
   - CI (`.github/workflows/*`): remove the engine and engine-e2e jobs; the game, build, desktop and e2e jobs stay green.
   - Update `CLAUDE.md` and `docs/architecture.md` / `docs/engineering.md` wherever they describe `packages/engine`.
5. **Upstream gaps.** If the game needs something the npm engine lacks (for example a behaviour that existed only in the old copy), do not patch node_modules and do not vendor engine code. Write it up under "Upstream asks" in the Log, with the file and what is missing, and use a small game-side workaround if one exists. The PM files it upstream.

## Done when
- `grep -rn "@thunderclap/" --include=*.ts --include=*.json --include=*.mjs --include=*.yml . | grep -v node_modules` finds nothing outside docs history.
- `packages/` contains neither engine nor host-electron.
- `pnpm check` and `pnpm build` are green. `pnpm test:e2e` is green (rerun flakes alone with `--workers=1` and name them). `pnpm test:e2e:desktop` and `pnpm desktop:build` work on mac.
- `pnpm baseline` against the committed v1.0 baselines with no `BASELINE_UPDATE`. Each remaining diff is looked at and fixed, or explained in the Log with before/after paths in `docs/design/screens/local/engine-npm/`.
- Phone shots (iPhone portrait/landscape, Android) of title, hall, a dense altar and teach card are looked at as a first-time player.
- Commit to `ws/engine-npm`; never merge to main (the PM merges). Log below.

## Log

### 2026-11-07: swap done; gates

**What changed**
- Main merged in (a2607da). Main's D-048 chain place, D-049 teach overlay, D-050 share embeds and the dense-board work are kept on the one overlay.
- The game now depends on `@thunderclap-engine/engine@^1.1.0` and `@thunderclap-engine/host-electron@^0.1.0` from npm. `packages/engine` and `packages/host-electron` are deleted. Imports use only public subpaths (7a14597).
- v1 renames applied:
  - post `fog` → `mist`
  - `prefersReducedMotion` → `isReducedMotion`
  - `Rect` → `Edges`
  - `fullscreen.active` is a getter
  - `createSpriteMaterial({...})`
  - `stack.render(frame, camera, alpha)`
  - e2e specs: `stack.list()` → `stack.scenes`; `input.getGestures()` → `input.gestures`
- **Phone fill (`game/screen-fit.ts`).**
  - Engine v1's Surface always letterboxes. `setFrame` clamps to the container, and `camera.fitRect` can only reframe inside the canvas, so the layout model cannot remove a phone's side bars.
  - So the game restores the D-040 fill bands and the device mode (`data-phone`/`data-touch` and the crop tokens) itself, after each Surface layout, through the surface's public `rect`, `backbuffer` and `canvas`. It uses the engine's own `computeLetterbox` / `computeBackbuffer` / `createDeviceMode`.
  - Desktop and tablet never fill, so the surface stays exactly as the engine lays it out.
  - I did not move to the `ui.layout.formFactor` model; it is a PM decision, listed below.
- `pnpm-workspace.yaml` is `packages: [.]`. It keeps this folder its own workspace root, so pnpm does not climb into a parent checkout (worktrees sit inside the main checkout).
- `scripts/check-boundaries.mjs` reads the installed packages' `exports` maps. It flags deep or non-public subpaths, the old `@thunderclap/` names, paths into `node_modules` or `packages/engine`, and `rules/` importing the engine or a host.
- **Desktop (0166312).**
  - The npm host ships only `out/main.mjs`, `out/preload.cjs` and its `dist`; there is no packaging CLI or dev script.
  - `scripts/desktop/dev.mjs` runs Electron on the host package folder with `TC_RENDERER_URL`.
  - `scripts/desktop/build.mjs` stages `build/desktop/app`: the host's `out/`, the game's `dist` as `out/renderer`, and a small `package.json`. It then calls electron-builder itself, with the same config upstream uses: appId, mac dmg/zip ad-hoc signed, win nsis/zip, linux AppImage/tar.gz.
  - `!**/node_modules/**` in `files` is needed, or electron-builder copies the workspace root's node_modules into the asar. The asar went from 4.2 MB to 1.5 MB, 11 entries.
  - `tests/desktop` resolves the shell from the installed package.
- CI: the `engine` and `engine-e2e` jobs are removed. Docs updated: CLAUDE.md, README, architecture.md and engineering.md (commands, layout, `render(frame, camera, alpha)`).
- **Settings selects (c7a64bd).**
  - Engine v1 adds a zoomed-select rule, `.tc-overlay[data-units="frame"] > .tc-layer:is([data-layer="panels"],[data-layer="toasts"]) select`, specificity (0,4,1). It gave the selects theme padding 8px 16px and pushed Settings 23 px past the frame at 150% text (layout-fit failed).
  - The game rule is now (0,5,1) and keeps the v1.0 design px. Measured identical to the pre-swap build.

**Gates (final tree)**
- `pnpm check`, `pnpm build`: green.
- `pnpm test:e2e`: **213 passed, 0 failed, 0 flaky, 20 skipped** (9.6 min).
  - An earlier run on this tree had 2 failures, both now named flakes: `altar-column.spec.ts:349` "column se" (667×320) and "column short" (852×270), where the altar tip clips under load.
  - Alone with `--workers=1`: 5 passed.
- `pnpm test:e2e:desktop`: 2 passed.
- `pnpm desktop:build` (mac arm64): dmg and zip built. The asar holds only `out/main.mjs`, `out/preload.cjs`, `out/renderer/**` and `package.json`.
- `pnpm baseline` (no `BASELINE_UPDATE`, `--retries=0`): **42 passed, 87 failed**. The results are the same on both runs.

**Baseline diffs and how I judged them**
- **desktop-1080: 42 of 43 pass**, most at 0 px. One fails: `solve-card`, 8580 px (0.41%), the same on every run.
  - Main's in-repo engine gives 646 px (0.03%) and ws/one-overlay gives 0 px, so this diff comes from the engine swap.
  - It is the target machine's gauge on the solve card. On v1.0 the 100–125% red zone is washed out under the awake glow; on engine v1 it reads red, as it does on every other gauge shot (for example `altar-furnace-solved`). The robot and the wire end differ by a few anti-aliased px.
  - Layout, text and positions match. The difference is in engine v1's post stack: bloom and exposure on bright emissive frames. Nothing the game passes changed except `fog` → `mist`.
  - The rules still read right: the red zone means over 100%, and the needle sits on the mark ("Got 8 ✓").
  - Accepted, not fixed. Images:
    - before: `docs/design/screens/v1.0/desktop-1080/solve-card.png`
    - after: `docs/design/screens/local/engine-npm/baseline/desktop-1080/solve-card-actual.png`
    - diff: `.../solve-card-diff.png`
    - side-by-side crops: `.../baseline/crop-before.png` and `crop-after.png`
- **desktop-720 and iPad: all 86 shots fail**, from 0.19% to 4.93% (iPad up to 3.17%). This is the one-overlay rasterization change already logged in `one-overlay.md`: text and 1 px borders are rasterized at the scale, with 0–1 px rounding.
  - The per-shot numbers match the ws/one-overlay build, which I rebuilt in scratch and ran: title 1.5316% here against 1.5347% there; codex 4.93% against 4.94%.
  - The exception is `solve-card` (720 1.50% against 1.12%; iPad 2.65% against 2.31%). The extra is the same gauge change as at 1080.
  - Images: `docs/design/screens/local/engine-npm/baseline/{desktop-720,ipad}/<shot>-actual.png` and `-diff.png`.
  - Re-baselining is the PM's call.

**Phone shots** (`SHOTS=engine-npm`, in `docs/design/screens/local/engine-npm/{iphone,se,promax,android,portrait}/`), looked at as a first-time player:
- Android landscape: the title fills the width. The dense altar (`10-the-last-rune`) fits with every label and the tray readable. The teach card (`14-intake-desk-teach-2`) points at its gem with "2 of 4 · Next".
- iPhone landscape: the same, inside the simulated 47 px notch insets.
- iPhone portrait: the title stacks with Play and Settings under the art; the hall asks you to turn the phone.
- No regressions seen.

**Upstream asks** (for the PM to file on thunderclap-engine)
1. **Surface fill / cover mode.** v1 removed `setFill` / `fillBands` / `ctx.device`. `Surface.setFrame` clamps to the container (`src/platform/surface.ts`, wired in `src/core/game.ts`), so a phone cannot grow the canvas past the letterbox and crop to a band. Ask: a cover or fill option on Surface (or `setFrame` accepting a frame larger than the container), and a device/form-factor attribute on the overlay root. Workaround: `games/last-rune/game/screen-fit.ts`.
2. **host-electron has no packaging or dev entry.** The package ships `out/` and `dist` only. Ask: a `package` CLI (or exported electron-builder config plus a staging helper) and a `dev` launcher. Workaround: `scripts/desktop/build.mjs` and `dev.mjs`. Also document that `files` needs `!**/node_modules/**` when the game is a workspace root.
3. **Zoomed-select CSS rule specificity.** At (0,4,1) it overrides ordinary game styling of selects in panels. Ask: wrap it in `:where()` or a cascade layer, or document a token for select padding and font. Workaround: a (0,5,1) game rule in `games/last-rune/ui/styles.ts`.

**PM decisions**
- Keep the game-side `screen-fit.ts` (fill bands and device mode), or move to `ui.layout.formFactor` and accept letterboxed phones until upstream ask 1 lands. I kept screen-fit so phones look as they do on main.
- Re-baseline desktop-720 and iPad (one-overlay rasterization), and desktop-1080 `solve-card` (the engine v1 gauge red zone)?
- `pnpm-workspace.yaml` stays as `packages: [.]`.
- Housekeeping: an early install in this session climbed into the main checkout. I reverted its lockfile change, but some extra entries remain in main's `node_modules/.pnpm` (gitignored, inert). A `pnpm install` on main cleans them.
