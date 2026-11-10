# Workstream: engine-1-3 (onto engine 1.3.0 / host-electron 0.3.0; launch build)

Owner: worktree agent, branch `ws/engine-1-3`. PM merges. D-054.

## Why
Every upstream ask from D-053 hardening (thunderclap-engine #4–#10) is fixed in engine 1.3.0 / host-electron 0.3.0 (engine E-040). Delete the local workarounds and use the engine's versions. This is the last change before the launch release (v1.2.0).

## Do
1. Bump `@thunderclap-engine/engine` to `^1.3.0` and `@thunderclap-engine/host-electron` to `^0.3.0`, then run `pnpm install`. Read the engine's CHANGELOG 1.3.0 entry and the READMEs in `node_modules/@thunderclap-engine/*` for the exact API.
2. **Crash screen (#5, #6, #7).** Replace `games/last-rune/game/crash.ts` (and its tests) with the engine's `createGame({ crash })`. The crash card should keep what ours does:
   - save first, then claim "progress saved" only if the save flush succeeded
   - Reload and Keep playing
   - the same noise filters
   Wire in the game's own save flush only if the engine's default (`save.flush()`) doesn't flush our store. Restyle the engine card with game CSS so it matches our UI.
   Delete `crash.ts`, `crash.test.ts` and their wiring in `main.ts`. `tests/e2e/hardening.spec.ts` must pass unchanged in intent: getContext throw → the unsupported screen; boot throw and uncaught errors → the crash card. Adjust only its selectors.
3. **Layout guard (#8).** The engine now warns only in dev builds (`LayoutSpec.warnOverflows`), so the console-text guard in `tests/e2e/fixtures.ts` would go quiet against the production preview. Move the guard to `layout.overflows()`, reached through a test hook (the game's existing `__` test globals pattern). It must still fail any test that ends with an overflow on any profile.
   - Prove it isn't a no-op: break one widget on purpose, show that the guard fails, then revert.
   - Players' consoles get no `[layout]` text.
4. **Layout workarounds (#9, #10).** The engine now judges the finished layout (a deferred check, plus `layout.batch(fn)`) and measures the computed content box. Remove the workarounds where doing so is a simplification:
   - the add-ordering in `scenes/altar/altar-chrome.ts`
   - the kept engine padding and title-band offset in `altar-column-styles.ts`
   Pixels must not move (baseline 129/129 without a regen). If removing the padding workaround would change the layout, keep it and say why.
5. **Desktop (#4).** Add `"prePackage": "node scripts/desktop/icon.mjs"` to `thunderclap.desktop`, and set `desktop:build` to `thunderclap-desktop package`. Update the docs that name the old chain.
6. Update `docs/architecture.md` and `docs/engineering.md` where they describe crash.ts, the guard or the workarounds.

## Gates (all must pass)
- `pnpm check`
- `pnpm build`
- the full `pnpm test:e2e` with 0 flaky
- `pnpm baseline` 129/129 (no regen unless pixels change for a reason you can name; judge them as a first-time player)
- `pnpm test:e2e:desktop`
- `pnpm desktop:build --mac --dir`

Never patch node_modules. Log any new engine gap under **Upstream asks** here.

## Log

### 2026-11-10: done (branch `ws/engine-1-3`)

**What changed**
- Deps: `@thunderclap-engine/engine` `^1.3.0` (installed 1.3.0), `@thunderclap-engine/host-electron` `^0.3.0` (0.3.0).
- **Crash screen (#5, #6, #7).** `game/crash.ts` and `crash.test.ts` are deleted. main.ts installs the engine's
  `installCrashScreen({ root, title, flush })`. It flushes `ctx.save.flush()` first and says "progress saved" only when that
  returns true. It offers Reload, plus Keep playing once the game runs, and keeps the same noise filters (the engine's are a
  port of ours). `main().catch` reports with `{ fatal: true }`, so Reload is the only button.
  - It uses `installCrashScreen` rather than `createGame({ crash })` because `createGame({ crash })` only covers throws inside
    `createGame`. Our boot also runs `bootHost()` (the Electron host import), the dev demo routes and `createGameCtx`/`startGame`
    outside it. A throw there would get no card, and the engine gives the game no handle to report it as fatal. Our save is the
    engine's `save` (`createGameSave` is a `createSaveStore`, and its `flush()` returns a boolean). With `createGame({ crash })`,
    the engine's default flush would therefore have been enough; the flush passed here is the same call.
  - **Restyle:** none needed. The old card was already the engine's `showMessageScreen` with the engine's CSS, which was drawn from
    Last Rune's palette (gold on night blue, serif). The card the player sees is unchanged, and so are the unsupported and
    device-lost screens.
  - `tests/e2e/hardening.spec.ts`: a throwing `getContext('webgpu')` now gets the unsupported screen ("WebGPU is not available",
    no canvas). A new boot-throw case stubs `GPUCanvasContext.prototype.configure` to throw: "Something went wrong", Reload
    only. The uncaught-error case is unchanged ("Your progress is saved", Keep playing, the hall still plays).
- **Layout guard (#8).** `tests/e2e/fixtures.ts` now reads `layout.overflows()` at the end of every test on every open page,
  through `window.__lrOverflows` (main.ts, set in every build because the preview is a production build; read-only). The
  `[layout]` console listener stays for dev pages, so a mid-test warning still fails the test too. The production bundle
  compiles the overflow warning out (`warnOverflows ?? false`), so players' consoles get no `[layout]` overflow text.
  - **Proof it isn't a no-op:** I set the phone Strike to `min-width: 900px !important` and turned the console listener off, so
    only the `overflows()` path could fail. Then I ran `hardening › phone › turning the phone…`. It failed with
    `844px: lr-altar-strike (900×58) overflows bottom (224×58)`. Both changes are reverted (not in any commit).
- **Layout workarounds (#9, #10), both removed:**
  - `altar-chrome.ts`: the widgets go back to their natural order (rails, then head and cards), without the add-ordering
    comment. `placeWidgets` (ui/chrome.ts) wraps the adds in `layout.batch` so there is one layout per set.
  - `altar-column-styles.ts`: the `top` region holding the head gets `padding: 0` again, and `--lr-head-out` is gone (title
    `left/right: 0; top: 3px`, slim `-14px`). This is pixel-identical: the head now fills the region edge, so the title sits
    where `-pad` put it. `placeHead` positions the slots from the head's own rect, so they don't move.
- **Desktop (#4).** `thunderclap.desktop.prePackage` is `node scripts/desktop/icon.mjs`, and `desktop:build` is
  `thunderclap-desktop package`.
- Docs: `docs/engineering.md` covers the desktop:build line and the e2e layout guard. `docs/architecture.md` has the dep
  versions (it still said ^1.1.0/^0.1.0) and an Errors line. The CI desktop comment is updated too.

**Gates**
- `pnpm check`: green (unit 604 passed, 2 skipped; the crash tests went upstream with the code).
- `pnpm build`: green.
- `pnpm test:e2e`: 224 passed, 20 skipped (the opt-in `SHOTS` specs), 0 flaky. Zero `[layout]` lines in the log.
- `pnpm baseline`: 129/129 passed with no `BASELINE_UPDATE`, so **no baselines were regenerated**. The largest diffs were
  ipad/solve-card at 0.06% and desktop-1080/title at 0.009% (animation noise, the same as engine-1-2). The rest were at most 0.004%.
- `pnpm test:e2e:desktop`: 2 passed.
- `pnpm desktop:build --mac --dir`: the log shows `prePackage: node scripts/desktop/icon.mjs`, which drew the icon, then
  `dist/desktop/mac-arm64/The Last Rune.app` (`CFBundleIdentifier` com.thunderclap.lastrune, `icon.icns`).

**Upstream asks**
- New (small): the crash screen is either inside `createGame` (`crash`) or fully game-owned (`installCrashScreen`). A game whose
  boot continues after `createGame` resolves cannot report its own setup throw as fatal through the `crash` option. Possible fix:
  expose the screen (e.g. `ctx.crash.report`), or let `installCrashScreen`'s handle be passed into `createGame({ crash })` so it
  wires the save flush itself.
- Note, not an ask: the engine's `[layout] <id>: no "<region>" region …; hidden` warning is not gated by `warnOverflows`, so it
  can still reach a production console on a misconfigured form. Last Rune never triggers it (it would fail the dev-page
  listener).
