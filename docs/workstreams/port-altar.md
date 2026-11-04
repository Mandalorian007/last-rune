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

### 2026-11-03: magnify, touch aim on Gestures, chrome polish, portrait decision

**Done**
- **Engine `Gestures` `magnify`** (9d947c2):
  - `MagnifyOptions { below = 44, size = 128, zoom = 2.5, lift = 56, pitch(), when?, snap?(x, y) → { x, y, r, data? }, over?, toClient?, source?, className?, parent? }`.
  - `gestures.aim` (`{ x, y, inside, client, finger, lifted, target, loupe, ended, at }`), `setMagnify`, `loupeElement`, `destroy()`.
  - Helpers: `snapToGrid(grid, x, y, ok)`, `loupeSpot`, `MAGNIFY_DEFAULTS`.
  - Unit tests (pure and happy-dom) and an engine e2e. The game's `snapCell` wraps `snapToGrid`, and its snap test moved to the engine.
- **Altar touch aim** (f3f8465):
  - The altar links its own `Gestures` (`linkGestures`) with pitch, `when` (holding a gem in edit mode), snap to the nearest open socket, and the loupe on the canvas.
  - `updateLoupe` and the LIFT/LOUPE constants are gone. `updateEdit` reads `gestures.aim` for hover, drop and the lifted held gem.
  - mobile.spec :173 (drag-off) now drives the input feed. :350 ("fits a phone") was deleted because mobile-budget and altar-labels cover it.
- **Chrome polish** (23b0cac):
  1. **SE hall.** The hall's side reserve comes from the layout's right region, so the ☰ rail no longer covers Lift Shaft. The badge reads "New page / in journal" on two lines and sits just under Menu inside the rail. mobile-hall checks this.
  2. **Upright Settings.** All labels share one column (`flex: 0 0 8.5em`), so the slider tracks start at the same x.
  3. **Upright title.** Portrait rows are `[56, {frac .27, 190–246}, fill, {frac .11, 72–104}, 64]`. The picture sits high, the menu sits right under it, and the slack falls below the menu.
- **Screenshots:** `tests/e2e/shots.spec.ts` (`SHOTS=port-altar`) saves 135 images to `docs/design/screens/local/port-altar/`. They cover every altar, each in its opening state and with the hand emptied (on touch an altar opens holding its first gem), on every phone, plus the hall and the upright title, Settings and rotate card.

**Portrait: keep the rotate card.** The upright fill column is the width minus the 56 and 64 rails. The board loses another 2×8 px of edge, or 2×66 px when it has west and east gauges. Best-case pitch (no side gauges) against the D-040 floors (6×4 / 8×6 / 10×8):

| Phone (upright width) | Free | Pitch 6 / 8 / 10 cols | Floors | Side gauges, 6 cols |
|---|---|---|---|---|
| SE (320) | 184 | 30.7 / 23 / 18.4 | 43 / 32.5 / 25 | 11.3 |
| iPhone (390) | 254 | 42.3 / 31.8 / 25.4 | 57 / 37 / 28.5 | 22 |
| Android (412) | 276 | 46 / 34.5 / 27.6 | 62 / 40 / 30.5 | 25.7 |
| Pro Max (430) | 294 | 49 / 36.8 / 29.4 | 66 / 43 / 32.5 | 28.7 |

Every phone misses every floor. Upright only reaches the floors if the rails move to top and bottom bands and the board spans the full width (for example iPhone 374 → 62 / 47 / 37). Even then, boards with west and east gauges fail, and the tray, cards, FUSE and Strike would need a separate stacked column. That is a new altar layout, not a port, so the rotate card stays.

**Not reached, and why**
- altar-scene.ts went from 4,264 to 4,231 lines. 49 phone branches remain.
- The altar still draws on the scaled 1920×1080 overlay. On phones, `phoneFrameFor` (50 and 58 CSS px columns) and `ui/phone-styles.ts` lay it out, and phone-styles.ts was not deleted.
- Moving the rail buttons, Strike, the tray column and the cards into `ctx.chrome` regions means rewriting the phone band: the tray, lane, FUSE and bubble geometry that mobile-budget pins (pitch floors, height share, card clearances, text floors, Strike inset).
- The altar is the one screen the user judges on real phones. I judged a rewrite of that band in this branch too risky for D-027.
- Proposal: a follow-up workstream (port-altar-2) that builds the phone altar as a `LayoutSpec` (board in `fill`, tray and lane in `cardLane`, buttons as rail widgets) behind a flag, with mobile-budget and the screenshot spec as the gate before deleting phone-styles.ts.
