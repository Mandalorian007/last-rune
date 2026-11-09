# Workstream: harden-app (first-release hardening, D-053)

Branch `ws/harden-app`. PM merges. Scope: the game survives real players' browsers. Product behaviour only; the engine's own platform tests are upstream's.

## Audit, then fix what fails (each with a unit or e2e test)
1. **No WebGPU** (Firefox, old Safari, disabled GPU): a clear, styled message with what to do, not a blank page or console error. Same for adapter/device request failure and **device lost** mid-run (recover or tell the player).
2. **Storage:** localStorage throws (Safari private mode, quota, disabled), returns corrupt JSON, or holds an older save shape → game still boots, progress fallback is sane, nothing crashes. Saves from v1.0.0 load in 1.1 (check the save version/migration path).
3. **Uncaught errors:** a top-level handler shows a recoverable message instead of a frozen canvas; no `console.error` during a full normal run (full-run.spec) on desktop, iPad and one phone.
4. **Network:** the built `dist/` makes zero external requests (assert in e2e: every request is same-origin). No sourcemaps or dev-only code shipped unintentionally; check bundle for stray `console.log`/debug hooks (`?demo=` routes: keep only if harmless).
5. **Pages subpath:** `pnpm build && pnpm preview` under `/last-rune/` base: every asset (social.jpg, apple-touch-icon, fonts if any) resolves; reload mid-run and back/forward don't break state; tab hidden/visible pauses and resumes audio and loop.
6. **Input edge cases:** resize/rotate mid-placement, rapid double taps, keyboard-only play (a11y.spec exists, extend if gaps), audio unlock on first gesture on iOS.
7. **Live smoke:** after your fixes, run the smoke spec against `pnpm preview`; PM will re-run against the live site.

Anything that's an engine bug: write a minimal repro into the Log under **Upstream asks**; don't patch node_modules.

## Gates
`pnpm check`, `pnpm build`, `pnpm test:e2e` green, `pnpm baseline` 129/129, `pnpm test:e2e:desktop` green. D-046: fix real gaps, no gold-plating.

## Log
