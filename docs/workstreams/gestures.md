# Workstream: gestures (Phase 2, parallel with layout and host-electron, after Gate 1)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 2" → ws/gestures. Decision: D-041 (addendum 2: the engine owns platform tests).

## Scope
- `packages/engine/src/input/gestures.ts`: `Gestures` attached to a pointer target and reporting per tick like `Input`.
  - Gestures: `tap`, `doubleTap`, `longPress` (default 450 ms), `pan` (threshold default 10 CSS px, with `dx`, `dy`), `drag` (start, move and end, with the origin), `pinch` (scale only, for later).
  - Thresholds are in CSS px. Positions are in game space through the same `PointerTransform` that `Input` uses.
  - `blocked()` is shared with `Input`.
- Public feed methods for tests, the same way `Input` has them.
- A gesture can be an action binding (`{ gesture: 'longPress' }`), so a game can map long-press to `info` and tap to `select` without reading gestures directly.
- Export from `@thunderclap/engine/input`. Document it in ARCHITECTURE.md ("Input") and CHANGELOG.md under `0.2.0-dev (unreleased)`. If the top section is dated, add a new `## 0.2.0-dev (unreleased)` heading.

## Not in scope
- No game scene changes. port-chrome and port-altar adopt gestures later. The game must behave identically (`pnpm baseline` 129/129).

## Tests
- Unit tests under happy-dom: every gesture, the tap-versus-pan boundary, long-press timing, drag origin, `blocked()`, and action binding.
- An engine e2e harness page proves real touch and pointer events on the phone, iPad and desktop rows (`pnpm test:e2e:engine`). The CI engine e2e job is now blocking, so keep it green.

## Rules
- No game nouns in the engine (`pnpm check:boundaries`). pnpm only.
- Commit to `ws/gestures` and never merge.
- `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e` and `pnpm test:e2e:engine` must be green.

## Log
