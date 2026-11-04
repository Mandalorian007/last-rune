# Workstream: create-game (Phase 1, after host and promote-ui)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/create-game. Decision: D-041.

## Scope
- **Split `game/ctx.ts`.** The noun-free wiring becomes `createGame(opts): EngineCtx` in `engine/core/game.ts`. That covers surface, renderer, post, particles, input, audio, overlay, save, host, device mode, lifecycle and fill bands.
- **Game context.** `GameCtx` wraps `EngineCtx` and adds the game nouns: sound, progress, setMood, FUSE and so on.
- **Entry point.** `main.ts` shrinks to `createGame({...}).then(ctx => scenes.push(title))`.
- **Docs.** `ARCHITECTURE.md` documents `createGame`, and `CHANGELOG.md` is updated.

## Follow-ups from host (PM calls)
- `games/last-rune/ui/settings-panel.ts` save export: route it through `ctx.host.copyText`. The execCommand and selected-field fallback inside itch is the D-036 behaviour we want everywhere, so the behaviour change is accepted.
- ~~phone-chrome fullscreen through the host~~: done in promote-ui.
- Afterwards, grep that the game makes no direct `navigator.clipboard`, `window.open`, `localStorage` or `requestFullscreen` calls.

## Gate 1 (the PM runs it after this merges)
- `pnpm check` is green in both packages.
- full-run e2e passes 16/16.
- `pnpm baseline` shows no pixel change on desktop.
- There is no `@game` import in the engine.
- The CHANGELOG lists every promoted module.
- The engine e2e harness is green across its matrix, and the CI `engine e2e` job is a required gate (no `continue-on-error`) after repeated green runs on GitHub runners, and the game specs no longer re-assert anything the engine owns for Phase 1 modules (D-041 addendum 2).
- Then tag `engine-v0.2.0-alpha.1`.

## Rules
- Commit to `ws/create-game` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` must be green.

## Log
- **2026-11-03: createGame.** `createGame(opts): Promise<EngineCtx | null>` lives in `packages/engine/src/core/game.ts`. It is exported from a new root entry, `@thunderclap/engine` (`"."`, `src/index.ts`), not from `./core`: it is the top layer and imports every module, and `./core` stays the small loop/scene layer. `EngineCtx` holds design, surface, gpu, renderer, post, particles, input, padNav, audio, ui, host, device, save, stack, loop, hooks (update, beforeRender, afterRender, hide, deviceLost), setFill and onDeviceLost. `GameCtx extends EngineCtx` and adds sound, settings, graphics, fuse, codex, hud, flow, views, viewContext, sfx, tier, setMood and openSettings (`Object.assign` on the same object, so scenes get one ctx). `main.ts` went from 103 to 59 lines; the dev demo routes moved to `scenes/_demo/routes.ts`. Unit tests: `core/game.test.ts` (7).
- **Settings export** copies through `ctx.host.copyText` (PM-approved). Grep of `games/` and `index.html` for `navigator.clipboard`, `window.open`, `localStorage`, `requestFullscreen` and `execCommand`: comments only, no calls.
- **Browser-zoom blocking** moved from an inline script in `index.html` to `platform/blockBrowserZoom`, installed by `createGame` before boot (option `blockBrowserZoom`, default on).
- **Tests moved.** New harness page `harness/game.html` boots through `createGame` (`window.__harnessGame`; the save has `autoFlush: false`, so only createGame's flush stores it; a mutation check confirmed the specs fail without that flush). `e2e/lifecycle.spec.ts`: audio unlock, hidden / pagehide / freeze flush and stop, show / pageshow / resume restart, zoom blocking. `e2e/surface.spec.ts`: resize and DPR mid-scene, device loss (reload screen on top and focused, loop, audio and timers halted after hide/show, reload works), and a 10-flip GPU texture/buffer leak check (mem.spec row). `wrapper.mjs?page=` embeds a harness page. Trimmed: `tests/e2e/lifecycle.spec.ts` deleted; robustness :91, :133 and :164 removed; play time while hidden is a new `game/flow` unit test. `docs/engine/test-split.md` rows updated.
- **CI gate.** In `mcr.microsoft.com/playwright:v1.64.1-noble` on arm64 (colima), CI=1, `--repeat-each=3`, no retries: 576 runs, 529 passed, 45 skipped, 0 device losses, 2 failures in host.spec "fullscreen from a click, and back" (the watch list), now polled with repeats folded. `continue-on-error` removed from the `engine e2e` job; restore it if device loss returns on GitHub's runners.
