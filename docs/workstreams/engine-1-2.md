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
