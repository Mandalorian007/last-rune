# Workstream: port-altar-2 (Phase 2, altar layout + camera)

Follows port-altar (part 1, merged). Read its log in [port-altar.md](port-altar.md) first: magnify in the engine, altar touch input on Gestures, portrait decision (rotate card stays, D-040 pitch numbers) and the proposal this brief adopts.
Decisions: D-026, D-027, D-039, D-040 (+addenda), D-041 (+addenda 1–3).

## Scope
- **Phone altar as a `LayoutSpec` behind a flag** (`?layout=1` or a dev setting, off by default until the gates pass, then on and the flag removed):
  - board in `fill` with a camera fit to `freeRect`;
  - tray, gem card and hint lane in `cardLane`;
  - Back / Undo / Clear / Turn / ☰ / Strike as rail widgets on `ctx.chrome`.
- Keep teach, moments, hints, strike, cursor and board and their tests; adapt seams only.
- Once the layout path is on: delete `ui/phone-styles.ts`, `phoneFrameFor` and the `L.phone` branches in `altar-scene.ts`. Targets: under 2,000 lines, zero `L.phone`. If the last few branches are genuinely product (not layout), say which and why.
- **Fix two issues from the PM's port-altar review** (`docs/design/screens/local/port-altar/` in the main repo):
  1. **iPhone, The Last Rune altar:** the altar title is clipped at the top edge and the "Holding Bend" pill sits on it. The header must be fully on screen and readable, with the pill clear of it, on every phone.
  2. **Upright title:** the picture and menu now sit high with a large empty bottom half. Centre the picture + menu group vertically (or grow the picture) so it reads as one balanced screen.

## Acceptance (Gate 2 inputs)
- `mobile-budget.spec`, `altar-labels.spec`, `altar-keys` and the full run (16/16) green; D-026 press counts unchanged.
- Socket pitch at or above the D-040 floors on all four phones in landscape, and no smaller than part 1 on any altar (list per-altar before/after).
- Desktop and iPad match v1.0 (`pnpm baseline`); list any intended diff.
- Screenshots of every altar on every phone, as it opens and holding a gem, into `docs/design/screens/local/port-altar-2/` (use `SHOTS=<dir> pnpm exec playwright test tests/e2e/shots.spec.ts`).

## Rules
- Product tests stay in the game; platform tests in the engine.
- pnpm only; `pnpm check:boundaries`. Commit to `ws/port-altar-2`; never merge.
- Gates before reporting: `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`, `pnpm test:e2e:engine`, `pnpm test:e2e:desktop`.

## Log
