# Workstream: create-game (Phase 1, after host and promote-ui)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/create-game. Decision: D-041.

## Scope
- **Split `game/ctx.ts`.** The noun-free wiring becomes `createGame(opts): EngineCtx` in `engine/core/game.ts`. That covers surface, renderer, post, particles, input, audio, overlay, save, host, device mode, lifecycle and fill bands.
- **Game context.** `GameCtx` wraps `EngineCtx` and adds the game nouns: sound, progress, setMood, FUSE and so on.
- **Entry point.** `main.ts` shrinks to `createGame({...}).then(ctx => scenes.push(title))`.
- **Docs.** `ARCHITECTURE.md` documents `createGame`, and `CHANGELOG.md` is updated.

## Follow-ups from host (PM calls)
- `games/last-rune/ui/settings-panel.ts` save export: route it through `ctx.host.copyText`. The execCommand and selected-field fallback inside itch is the D-036 behaviour we want everywhere, so the behaviour change is accepted.
- `phone-chrome.ts` / rotate-card fullscreen goes through `ctx.host.fullscreen`. Do this after promote-ui lands, wherever that code ends up.
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
