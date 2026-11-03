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

## Log
