# Workstream: host (Phase 1, parallel with promote-ui, after workspace)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/host and "Target architecture" → Host. Decision: D-041 (wrappers: itch iframe, Pages, later Electron).

## Scope
- **Host interface** in `packages/engine/src/host/`:
  - `interface Host { kind; openExternal; copyText; fullscreen; storage; window?; embed }`.
  - `createWebHost()` detects `embedContext()` and wraps the D-036 link service (`openExternal`, `copyText`, `clipboardWriteAllowed`), the fullscreen helpers, and a storage backend over `localStorage` with today's quota and blocked-storage handling.
- **Callers go through the host:**
  - `engine/save` takes its storage from the host.
  - The `externalLink` widget takes the host.
  - Ko-fi and invite links go through `ctx.host`.
  - After this workstream, nothing in the engine calls `window.open`, `navigator.clipboard` or `localStorage` directly. Check with grep and list any exceptions.
- **Electron seam:** write the interface so `createElectronHost()` (Phase 4) can satisfy it with a preload bridge. Window controls are optional.
- **Tests:** unit tests for the web host. The itch-sim e2e covers copy and open through the host in a cross-origin frame (`scripts/itch-sim/`).

## Rules
- The game behaves identically: `pnpm baseline` shows no change on desktop, and saves from v1.0 still load.
- Storage stays `localStorage` only on the web (CLAUDE.md).
- Commit to `ws/host` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` must be green.

## Log

## Test ownership (D-041 addendum 2)
Platform assertions for the modules you move or create go in the engine suite: unit tests plus the engine e2e harness. Then trim the matching checks out of the game specs in this same branch. Follow `docs/engine/test-split.md`. Coverage must never drop between the two.
