# Workstream: create-game (Phase 1, after host and promote-ui)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/create-game. Decision: D-041.

## Scope
- **Split `game/ctx.ts`.** The noun-free wiring becomes `createGame(opts): EngineCtx` in `engine/core/game.ts`. That covers surface, renderer, post, particles, input, audio, overlay, save, host, device mode, lifecycle and fill bands.
- **Game context.** `GameCtx` wraps `EngineCtx` and adds the game nouns: sound, progress, setMood, FUSE and so on.
- **Entry point.** `main.ts` shrinks to `createGame({...}).then(ctx => scenes.push(title))`.
- **Docs.** `ARCHITECTURE.md` documents `createGame`, and `CHANGELOG.md` is updated.

## Gate 1 (the PM runs it after this merges)
- `pnpm check` is green in both packages.
- full-run e2e passes 16/16.
- `pnpm baseline` shows no pixel change on desktop.
- There is no `@game` import in the engine.
- The CHANGELOG lists every promoted module.
- Then tag `engine-v0.2.0-alpha.1`.

## Rules
- Commit to `ws/create-game` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` must be green.

## Log
