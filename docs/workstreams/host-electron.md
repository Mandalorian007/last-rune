# Workstream: host-electron (Phase 4, parallel with Phase 2, after Gate 1)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 4" → ws/host-electron. Decisions: D-041 (unsigned builds for now, user-confirmed), Host contract in packages/engine/ARCHITECTURE.md.

## Scope
- `packages/host-electron/` is a new workspace package, `@thunderclap/host-electron`, with no game nouns.
- **Main process:**
  - Creates the window.
  - Enables WebGPU explicitly with `app.commandLine.appendSwitch`, so the build doesn't depend on Chromium defaults. Log the exact switches per OS in its README.
  - Opens no other network connections and loads only local files.
- **Preload** (`contextIsolation` on, `nodeIntegration` off) exposes `window.thunderclap` with:
  - `openExternal`, through `shell.openExternal`, https only, with `safeExternalUrl` semantics;
  - `copyText`, through `clipboard`;
  - `fullscreen`;
  - `window`: minimise, close and title.
- **Renderer:** `createElectronHost()` reads the bridge and satisfies `Host`.
- **Storage (PM call):** storage stays browser storage, meaning the renderer's `localStorage`, the same backend as the web host. It does **not** write a JSON file in `userData`.
  - Reason: the user said storage is browser-only for now.
  - Write a file-backed backend only as a design note in the README. It is an open question for the user.
- **Packaging:**
  - `electron-builder` config for Windows, macOS and Linux, unsigned (signing is an open question), output to `dist/desktop/`.
  - Scripts: `pnpm desktop:dev` (the Vite dev server inside Electron) and `pnpm desktop:build`.
  - CI: add a job that builds the desktop artefacts on the three OSes, non-blocking at first. Build-time downloads (the Electron binaries) are fine; runtime network calls are not.
- **Decision to propose:** Electron over Tauri, because Chromium parity keeps WebGPU behaviour identical. Write it in your log for the PM to file as a DECISIONS entry.

## Not in scope
- Last Rune booting with the Electron host, a Quit entry, or the Electron e2e of the game. Those belong to ws/last-rune-desktop.
- You may boot the engine's noun-free harness page in Electron to prove the host.

## Tests
- Unit tests for `createElectronHost()` against a fake bridge.
- A Playwright Electron-driver smoke on the harness page: WebGPU init, `host.kind === 'electron'`, copy and open through the bridge (stub `shell.openExternal`), and storage round trip.

## Rules
- No secrets and no signing material in the repo. pnpm only.
- `pnpm check:boundaries` must still pass. Extend it so host-electron imports only the engine's public exports.
- Commit to `ws/host-electron` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e:engine` must be green. The game is untouched, so `pnpm baseline` stays 129/129.

## Log
