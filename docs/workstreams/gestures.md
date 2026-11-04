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

### 2026-11-03: Gestures module
- `packages/engine/src/input/gestures.ts`: `Gestures` with `tap`, `doubleTap`, `longPress` (450 ms), `pan` (10 CSS px, `dx`/`dy`, `pointers`), `drag` (`start`/`move`/`end`/`cancel`, `origin`) and `pinch` (`scale`, `delta`). Thresholds in CSS px (client coordinates); positions in game space through `PointerTransform` (`inside: false` when it returns `null`). Feed methods `pointerDown`/`pointerMove`/`pointerUp`/`pointerCancel`/`cancelAll`, and an injectable `now` clock.
- Tick model: one tap, double tap and long-press per tick (extras queue, like `queueTaps`); the double tap is reported on the same tick as its second tap. Pan, drag and pinch report every tick while running (merged moves, `dx: 0` when idle), with `start` and `end` on their own ticks, so `dx` sums to the total travel.
- Choices: a long-press does not turn into a drag; a second pointer cancels the drag and starts pinch plus two-finger pan; lifting one of two pointers ends them and voids the press until all pointers are up; mouse uses the primary button only.
- `blocked()`: nothing is reported and the press is dropped, but a pan, drag or pinch that had started gets exactly one `cancel` (so a game can put a dragged thing back). Browser `pointercancel`, blur and hidden tab do the same.
- Binding design: `Binding` gains `{ gesture: GestureKind }` (types.ts). `Input.setGestures(g)` / the `gestures` option links them: the gestures share `input.blocked` (read live, so reassigning it works), the pointer transform, `attach`/`detach`, and are advanced by `Input.update()` before actions are read. `tap`/`doubleTap` press for one tick (each one fresh, so taps on consecutive ticks re-press), `longPress` is held until the pointer lifts, `pan`/`drag`/`pinch` are held from `start` to `end`. Unlinked, a gesture binding reads inactive. `createGame` does not link gestures, so the game is unchanged.
- Tests: `gestures.test.ts` (feed methods: tap, the 10 px boundary exactly, CSS vs game px, custom thresholds, pan/drag merging and flicks, origin and drag-off, long-press at 449/450 ms and on a stalled tick, double tap timing and distance, tap queueing, pinch and two-finger pan, blocked and cancel, all bindings) and `gestures.dom.test.ts` (happy-dom: target-relative coordinates, transform, mouse buttons, pinch, `pointercancel`, blur, detach, linked `Input` attach/detach).
- Engine e2e: `harness/gestures.html` (no WebGPU; 4:3 stage letterboxed so every landscape row has bars) and `e2e/gestures.spec.ts`: tap position and binding, tap vs pan (6 px tap, 30 px drag with travel 30/scale), long-press timing and hold, double tap, drag origin and drag-off into the bar, blocked and cancel, two-finger pinch. Real CDP touch on iPad and the phones, the mouse on desktop and inside the itch iframe. 53 pass, 3 skipped (pinch on mouse rows); stable over `--repeat-each 4`.
- Not done here (for the PM): the `magnify` (loupe and snap) option. The refactor plan puts it in ws/port-altar, while test-split.md listed it for gestures; I updated the test-split row to say it follows in port-altar. No game spec was trimmed because the game does not use `Gestures` yet; mobile :173's drag-off moves when port-altar adopts it.
