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
- 2026-11-03: Host landed on `ws/host`.
  - `packages/engine/src/host/`: `Host`, `createWebHost({ win? })`, `defaultHost()` / `setDefaultHost()`, exported as `@thunderclap/engine/host`. The link service moved from `platform/links.ts` into `host/web-links.ts`; `safeExternalUrl` and `embedContext` stay in `platform`.
  - `createSaveStore`, `listSlots`, `persistMixer` and `externalLink` take `host` (default `defaultHost()`). The game builds one web host in `ctx.ts` (`ctx.host`), and its save, mixer, title Ko-fi link and end-card links use it. Keys and format unchanged; v1.0 saves load.
  - Grep: `window.open`, `navigator.clipboard`, `execCommand` and `localStorage` appear in the engine only in `host/web.ts` and `host/web-links.ts` (plus comments and READMEs). The fullscreen DOM calls stay in `platform/device.ts`; `host.fullscreen` wraps them.
  - Follow-ups (not done): the game's `ui/phone-chrome.ts` (promote-ui's file) still calls the platform fullscreen helpers directly and should move to `ctx.host.fullscreen`. The game's `ui/settings-panel.ts` save export calls `navigator.clipboard?.writeText` directly. Moving it to `ctx.host.copyText` would add the `execCommand` fallback in itch, which changes behaviour, so it needs a PM call.
  - Tests moved to the engine: `src/host/*.test.ts` (unit) and `e2e/host.spec.ts` (harness host probe on all 8 matrix rows, including itch's iframe and click-to-launch).
  - Tests trimmed from the game:
    - link-copy :252, :279, :294, :373 and :409, plus the clipboard and popup mechanics in :196.
    - smoke :88 and :117.
    - robustness corrupt saves, from 5 shapes to 1.
    - The "opens only on a click" waits in title :85 and ending :23.
    - Three storage tests in `game/save.test.ts`.

## Test ownership (D-041 addendum 2)
Platform assertions for the modules you move or create go in the engine suite: unit tests plus the engine e2e harness. Then trim the matching checks out of the game specs in this same branch. Follow `docs/engine/test-split.md`. Coverage must never drop between the two.
