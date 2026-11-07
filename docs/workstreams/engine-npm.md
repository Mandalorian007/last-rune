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
