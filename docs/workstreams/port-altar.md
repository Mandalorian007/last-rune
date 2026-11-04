# Workstream: port-altar (Phase 2, last; the hard one)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 2" → ws/port-altar, and "Risks" (altar UX loss).
Decisions:
- D-026: keyboard press counts.
- D-027: intuitiveness.
- D-039 and D-040: phone budgets and the phone gate.
- D-041 addenda:
  - 1: no phone zoom.
  - 2: test ownership.

Prior logs: port-chrome.md (two overlays, `ctx.chrome`), layout.md, gestures.md.

## Scope
- **Rewrite the altar layout, input and camera code** against `Gestures`, `createLayout` (`ctx.chrome` on phones) and a camera fit to `layout.freeRect`.
  - The phone case must be a `LayoutSpec` plus a camera fit, not a code path.
  - Target: `scenes/altar/altar-scene.ts` under 2,000 lines (4,264 today), with zero `L.phone` branches (about 50 today).
- **Keep, with their tests:** `teach.ts`, `moments.ts`, `hints.ts`, `strike.ts`, `cursor.ts` and `board.ts`. They hold the UX lessons of 45 workstreams, so don't rewrite them. Adapt only the seams.
- **`magnify` option on `Gestures`:** loupe and snap (`magnify: { below: 44, size, zoom }`), so any game with small targets gets them. Engine unit tests and e2e cover it. Then move the drag-off check (`mobile.spec` :173) to the engine.
- **Delete the rest of `ui/phone-styles.ts`** (772 lines), plus `teach-styles` phone rules wherever regions replace them.
- **Portrait phones:** decide whether the altar plays upright (board in `fill`, tray in `bottom` or `cardLane`) or keeps the rotate card.
  - Make it playable upright if the D-040 socket pitch holds there.
  - Otherwise keep the rotate card and log why.
- **Fix three chrome polish items from the PM's port-chrome review** (screenshots in `docs/design/screens/local/port-chrome/`):
  1. **SE landscape hall:** the "New page" badge sits over the ☰ Menu button's label edge, and the ☰ button overlaps the Lift Shaft window. Give the badge room and keep the rail clear of the scene. Also make sure "New page" says that it is a journal page.
  2. **Upright settings:** slider tracks start at different x positions. Give them one shared label column so they line up.
  3. **Upright title:** there are tall empty bands above and below the picture. Balance the composition, for example picture higher and menu closer, so it reads as one screen.

## Acceptance (Gate 2 inputs)
- `altar-labels.spec`, `altar-keys`, `mobile-budget.spec` and the full-run e2e (16/16) are all green.
- Keyboard press counts stay at or below the D-026 numbers.
- Socket pitch meets D-040 on all four phones.
- Desktop and iPad match v1.0 (`pnpm baseline`) within tolerance. List any intended diff with its reason.
- Screenshot every altar on every phone row, landscape and portrait if it plays upright, into `docs/design/screens/local/port-altar/`, which is not committed. These feed the PM's D-040 blind review, which must score at least 8/10 with no major issues, and then the user's real-phone retest.

## Rules
- Product tests stay in the game; platform tests go to the engine. Trim duplicates in the same branch.
- pnpm only. `pnpm check:boundaries`.
- Commit to `ws/port-altar` and never merge.
- Before reporting, run `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`, `pnpm test:e2e:engine` and `pnpm test:e2e:desktop`.

## Log
