# Workstream: engine-1-2 (refine the build onto engine 1.2.1 / host-electron 0.2.0)

Owner: worktree agent, branch `ws/engine-1-2`. PM merges. D-052 add. 2.

## Why
Our three upstream asks (D-052 add. 1) were all fixed upstream (thunderclap-engine #1–#3, closed, shipped in
engine 1.2.0 / host-electron 0.2.0; current engine 1.2.1). Delete the local workarounds and use the engine's versions.

## Do
1. Bump `@thunderclap-engine/engine` to `^1.2.1` and `@thunderclap-engine/host-electron` to `^0.2.0`; `pnpm install`.
2. **Cover fit (#1):** replace `games/last-rune/game/screen-fit.ts` with `createGame({ surface: { fit: { ...CoverOptions, belowScale: PHONE_SCALE } } })`
   (`SurfaceOptions.fit`, `Surface.visibleRect`, `Camera.fitFreeRect`). Carry over the same min-visible / focus values screen-fit used so phones look the same.
   Delete screen-fit.ts and its tests if the engine now covers them. Use `data-form-factor` on the overlay root if the game still needs device class.
3. **Select specificity (#3):** delete the (0,5,1) `.tc-overlay .tc-layer .tc-panel .lr-settings.lr-settings select` hack in `games/last-rune/ui/styles.ts`; an ordinary `.lr-settings select` rule must now win.
4. **Desktop (#2):** replace `scripts/desktop/build.mjs`, `dev.mjs`, `shell.mjs` with the `thunderclap-desktop` bin and a `thunderclap.desktop` field in package.json.
   Identity MUST stay `productName: "The Last Rune"`, `appId: "com.thunderclap.lastrune"` (saves live in userData). Keep the procedural icon (`scripts/desktop/icon.mjs`)
   as a pre-step writing `build/desktop/icon.png`. Keep `scripts/desktop/e2e.mjs` only if it is still needed. Update package.json scripts, CI and docs that name the old scripts.
5. Engine reference docs in `docs/` that describe the workarounds: update to say the engine now does it.

## Gates (all must pass)
`pnpm check`, `pnpm build`, full `pnpm e2e` (visual baselines: phone shots should be ~unchanged; if they shift, judge as a first-time player and regenerate only if no worse), desktop e2e, `pnpm desktop:build` mac dir build.
Never patch node_modules. Any new engine gap: log it here under Upstream asks; don't work around it locally without saying so.

## Log

### 2026-11-08: done (branch `ws/engine-1-2`)

**What changed**
- Deps: `@thunderclap-engine/engine` `^1.2.1` (installed 1.2.1), `@thunderclap-engine/host-electron` `^0.2.0` (0.2.0).
- **Cover fit (#1).** `games/last-rune/game/screen-fit.ts` is deleted. `FILL_BANDS` in `game/ctx.ts` are now engine
  `CoverOptions` with the same values (`minVisible` became `minVisibleHeight`, same `focusY`; the title keeps `TITLE_UPRIGHT`'s
  `minVisibleWidth: 740, focusX: 560`) plus `belowScale: PHONE_SCALE`. `engineOptions` passes the title's band as
  `surface.fit`, and the flow switches bands per scene with `surface.setFit`.
  - One semantic difference: for a tall frame the engine defaults `minVisibleWidth` to 0 (cover the height), while screen-fit
    letterboxed when it was unset. So every band except the title sets `minVisibleWidth: DESIGN_W`, which gives the contain fit.
  - Device mode stays game-side, about 20 lines in ctx.ts. The engine's `createDeviceMode`/`setScale` keeps `data-phone`,
    `data-touch`, the `--tc-crop-*` tokens and the soft side-edge mask for wide phones; `data-form-factor` alone doesn't carry
    the crop tokens the altar and phone CSS read. It runs on `surface.onResize` and on each band switch.
  - `socket-looks.test.ts` uses the engine's `computeCover` (the same maths as the old `computeFill`).
- **Select specificity (#3).** The (0,5,1) rule is back to a plain `.tc-overlay .lr-settings select`.
- **Desktop (#2).** `scripts/desktop/build.mjs`, `dev.mjs` and `shell.mjs` are deleted.
  - `desktop:dev` is now `thunderclap-desktop dev`, on the same 5198 default port.
  - `desktop:build` is now `node scripts/desktop/icon.mjs && thunderclap-desktop package`. It still needs `pnpm build` first.
  - package.json has `thunderclap.desktop` `{ productName: "The Last Rune", appId: "com.thunderclap.lastrune", icon: "build/desktop/icon.png" }`.
  - `scripts/desktop/e2e.mjs` stays: it builds dist/ and runs `tests/desktop`, which the bin doesn't do.
  - CI comment, docs/architecture.md and docs/engineering.md are updated.

**Gates**
- `pnpm check`: green (unit 602 passed, 2 skipped).
- `pnpm build`: green.
- `pnpm test:e2e`: 213 passed, 20 skipped (the opt-in `SHOTS` specs), 0 flaky.
- `pnpm baseline`: 129/129 passed with no `BASELINE_UPDATE`, so **no baselines were regenerated**. The largest diff was solve-card at 0.06%, which is animation noise. The rest were at most 0.003%.
- Phone check by eye (`SHOTS=… SHOTS_ONLY=iphone,chrome,moments` plus portrait, saved to `docs/design/screens/local/engine-1-2-shots/`):
  - The iPhone hall is indistinguishable from `gate11/iphone/02-hall.png`.
  - The upright title still side-crops to the storm cell and FUSE, and the altar band is unchanged.
  - The `moments iphone` shot spec timed out waiting for `__altarView.held` to clear after the first gem tap. The screenshot shows
    the gem placed on the right cell with the hand still holding Channel ×5. That looks like a stale shot script (not run since
    one-overlay), not a fit change: the tap landed on the right cell. Not fixed here; it is outside the gate and opt-in.
- `pnpm test:e2e:desktop`: 2 passed.
- `pnpm desktop:build --mac --dir`: `dist/desktop/mac-arm64/The Last Rune.app`. Info.plist has `CFBundleIdentifier`
  com.thunderclap.lastrune, `CFBundleName` "The Last Rune" and `icon.icns`. The asar holds only `out/main.mjs`, `out/preload.cjs`,
  `out/renderer/**` and `package.json`.
- The dev-only `[layout] … overflows its region` warnings in the e2e log come from the engine's ui-7 layout warning and predate this change.

**Upstream asks:** none new. A possible nicety: `thunderclap.desktop` could take a pre-package hook (e.g. an icon command) so that
`desktop:build` needs no `&&`. It is not needed.
