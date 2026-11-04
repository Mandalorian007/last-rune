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
- 2026-11-03: Shell landed on `ws/host-electron` (D-041 Phase 4). Details are in `packages/host-electron/README.md`.
  - **Package:** `packages/host-electron` (`@thunderclap/host-electron`, private, devDependencies only), with no game nouns.
    - `src/main` is the main process. `src/preload` holds the sandboxed bridge. `src/renderer.ts` has `createElectronHost()`. `harness/` is a noun-free WebGPU page and the default renderer.
    - Electron 45.2.2 (Chromium 156), electron-builder 26.18.
  - **Bridge `window.thunderclap` (v1):**
    - `openExternal` is plain https only. It is re-checked in main with the same rule as the engine's `safeExternalUrl`.
    - Also exposed: `copyText`, `fullscreen.get/set/onChange`, and `window.minimize/toggleMaximize/close/setTitle`.
    - The window runs with contextIsolation, sandbox and no nodeIntegration. Every IPC call must come from the main frame on the page's own origin.
  - **WebGPU switches:** `--enable-unsafe-webgpu` on every OS, plus `--enable-features=Vulkan` on Linux. `TC_GPU_SWITCHES` overrides them, unpackaged only.
  - **Local only:**
    - Pages are served from a privileged `app://bundle` scheme with a path guard and a CSP.
    - `webRequest` cancels anything off-origin.
    - No new windows, webviews or navigation away. Permissions are denied except fullscreen. Spellcheck is off.
  - **Storage:** the renderer's `localStorage` (PM call). The fixed `app://bundle` origin and the `productName` keep saves across updates. A single-instance lock is held. The file backend is documented only, as an open question.
  - **Engine change (additive):** optional `HostWindow.setTitle?`. Logged in the CHANGELOG under "Next".
  - **Shared files:**
    - Root `package.json` gains `desktop:dev`, `desktop:build`, `test:e2e:desktop` and `check:host-electron`. `pnpm check` now includes `check:host-electron`.
    - `scripts/check-boundaries.mjs` rule 4: host-electron may not import the game. It reaches the engine only via the engine's exports map. Other code reaches host-electron only via its exports map. The engine may not import `@thunderclap/*`.
    - `scripts/package-itch.mjs` skips `dist/desktop/`.
    - CI: `check:host-electron` runs in the engine job. A new `desktop` job runs a 3-OS matrix with `continue-on-error`, runs `pnpm desktop:build`, and uploads the artefacts.
  - **Tests:**
    - 24 unit tests (fake bridge in happy-dom; policy and switches).
    - 5 Playwright Electron-driver tests (`pnpm test:e2e:desktop`):
      1. WebGPU init, `host.kind`, no Node in the page, and the bridge shape.
      2. Open via the bridge, with `shell.openExternal` stubbed in main and file/javascript URLs refused.
      3. Copy through to the system clipboard.
      4. A save/load round trip that survives a relaunch.
      5. No network, and no navigation away.
  - **Gates (macOS arm64):**
    - `pnpm check` green (engine 248, host-electron 24, game 556 tests).
    - `pnpm build` green. `pnpm test:e2e:engine`: 177 passed and 15 skipped. `pnpm test:e2e:desktop`: 5/5.
    - `pnpm baseline`: 129/129 (126 passed and 3 flaky altar scenes that passed on retry while other agents ran tests). The game is untouched.
    - `pnpm desktop:build`: `ThunderClap-0.1.0-dev-mac-arm64.dmg` 114 MiB, `.zip` 111 MiB, `.app` 257 MB. The packaged app ran with `gpu: ok` (bgra8unorm).
  - **Note:** `pnpm build` (Vite) empties `dist/`, which deletes `dist/desktop/` too. Run `desktop:build` after it.
  - **Open questions for the PM and user:**
    - Code signing and notarisation (needs certificates in CI secrets).
    - A file storage backend.
    - The Linux AppImage sandbox on Ubuntu 24.04+ (AppArmor).
    - Running the Electron e2e in CI on Linux (SwiftShader via `TC_GPU_SWITCHES`).
    - A procedural app icon (ws/last-rune-desktop).
    - Windows and Linux builds are untested on hardware.

### Decision proposal: Electron over Tauri (for docs/DECISIONS.md; PM to file)
- **Decision:** the desktop host is Electron, not Tauri.
- **Why:**
  - The game is WebGPU-only (D-001). Electron ships its own Chromium, so the desktop build runs the same Dawn WebGPU implementation, with the same WGSL compiler and limits, as Chrome on the web. One renderer is tested once.
  - Tauri renders in the OS webview:
    - macOS: WKWebView. WebGPU only arrived with recent Safari, and its limits and features differ.
    - Windows: WebView2, which is Chromium but tied to the machine's installed version.
    - Linux: WebKitGTK, which has no usable WebGPU.
  - With Tauri, Linux would not run at all, and macOS would be a second GPU target to test.
- **Cost accepted:**
  - Larger downloads: about 110 MiB per OS for Electron, against about 10 MiB for Tauri.
  - More memory.
  - We track Electron releases for Chromium security fixes.
- **Mitigations:**
  - No network at runtime.
  - Sandboxed renderer with a minimal bridge.
  - The engine stays host-agnostic behind `Host`. A Tauri host could still be written later against the same interface if OS webviews converge on WebGPU.
