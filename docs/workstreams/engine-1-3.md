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
