# Workstream: dense-board-4 (D-040 add. 11, major D)

Read D-044, D-040 add. 10–11 and the logs in `dense-board-3.md`, `dense-board-2.md` and `fit-9.md` first. Shots: `docs/design/screens/local/gate10/<phone>/` in the main checkout.

## Finding (3 of 4 reviewers)
Archive, The Last Rune and Lift Shaft are hard to read and tap: sockets about 27–35 CSS px, gauges about 20 px, ×N counts about 11 px. The loupe hides the 3–4 neighbours the player is placing against (12-the-last-rune-aim). dense-board-3 found pitch at its ceiling for the current layout (The Last Rune: SE 32.3, iPhone 35.2, Pro Max 40.3, Android 38.1). The lever not yet pulled is the right column: on these boards, tray, hint card and empty wall take about 40% of the width (10-lift-shaft packs its board into the left half).

## Do
1. **Slim column on dense altars (phones only).** When the board would fall under a pitch threshold, the right column becomes compact:
   - the tray becomes a tight strip (2 or 3 columns, smaller gaps);
   - the hint/rule card collapses behind a small "?" or "Rule" tab that opens on tap and closes on the next tap or on placing;
   - the "Holding X" chip and the Strike button stay.
   
   Give the freed width to the board, and centre boards that don't fill their area (Lift Shaft).
   
   Target: The Last Rune and Archive gain ≥ 15% pitch on every phone (SE ≥ 37, iPhone ≥ 40). No other altar gets smaller.
2. **Loupe.** Smaller lens on dense boards. Place it so the aimed cell's 4 neighbours stay visible (engine `MagnifyOptions.clear` already supports keep-clear rects; extend it in the engine only as a platform feature, no game nouns, and log it in the CHANGELOG). Draw a thin leader from lens to socket so the lens reads as "this socket".
3. **Readability.** Gauges and ×N counts on dense boards must meet the 14 px text floor (D-039) and be legible at real size.
4. **Space budgets.** Update `mobile-budget.spec`, `dense-board.spec` and `altar-column.spec` to the new layout, and add a pitch floor for the slim mode. A collapsed hint must never hide a teaching card the player hasn't dismissed: first-sight teaching wins over slim mode.

Copy belongs to teach-8 and gem art to glyph-truth-4; don't edit either. If teach-8's new first-sight cards need the column open, that rule (step 4) covers it.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run dense-board, altar-column, mobile-budget, mobile-teach and held-gem, then a full `pnpm test:e2e` and `pnpm test:e2e:engine` (unique `E2E_PORT_OFFSET`; rerun load flakes alone and name them).
- Report pitch per phone for The Last Rune, Archive, Lift Shaft and Control Booth, before and after.
- `SHOTS=dense-board-4` on four phones. At real size, look at 10-/12-the-last-rune*, 10-archive, 10-lift-shaft and 10-control-booth.
- Don't run `BASELINE_UPDATE`; list the diffs (desktop and iPad should be unchanged). Commit to `ws/dense-board-4`, never merge. Log below.

## Log

**2026-11-04: done (branch ws/dense-board-4, main merged at 1109fa8).**

Pitch, CSS px, before → after (SE / iPhone / Pro Max / Android):
- The Last Rune: 32.3 / 35.2 / 40.3 / 38.1, unchanged.
- Archive: 36.1 → **40.6 (+12.5%, slim)** / 46.9 / 52.1 / 49.0.
- Lift Shaft: 35.8 / 38.3 / 43.7 / 41.0, unchanged.
- Control Booth: 39.6 / 48.0 / 51.3 / 49.0, unchanged.
- No altar shrank.

**The ≥15% target is not met.** The slim fit only gains where the board is width-bound and has ≤4 gem kinds.
- The Last Rune is height-bound on the iPhone, Pro Max and Android (iPhone ceiling ≈39.6 even with free gauges).
- On the SE, The Last Rune is bound by both width and height (≈33).
- Archive on the iPhone and Lift Shaft everywhere are height-bound.
- Control Booth has 5+ kinds. A 3-per-row slim strip is no narrower than the normal column, and a 2-per-row strip clips the verdict on the SE.
- Reaching +15% needs the Phase 3 camera (pan/zoom), the N/S gauge cards moved beside the board, or the tray as an overlay or drawer.

Slim column (`PH.colSlim` 100; applies when pitch < `PH.dense`, ≤4 kinds, a gain of ≥1.5 CSS, and the card lane is no shorter):
- The tray is a 2-per-row strip.
- With a gem held, a 44 px "? Rule" pill tab shows. Tapping it opens the gem's card.
- Any tap closes the card. A socket tap also places the gem.
- Teach cards, the verdict, the legend and Strike mode hide the tab.
- The head carries `data-slim`, so the title and "Holding X" may spill 14 px past the strip.
- polish-10's struck ×0 rule is kept.

Loupe:
- The lens is 104 px when pitch < 42 CSS, otherwise 128.
- The aimed cell's 3×3 stays clear.
- A gold leader runs from the rim to the socket.
- Engine (noun-free, CHANGELOG): magnify `size` may be a function, `clear(target, aim)`, `leader`, plus `loupeLeader`.

14 px floor:
- On dense boards, the gauge "Needs" cards and the ×N counts render at ≥14 px.
- dense-board.spec checks this as rendered size × overlay scale.

Specs:
- dense-board.spec: a per-phone pitch floor table, the 14 px check, and the slim Rule-tab flow, including that teaching hides the tab.
- shots.spec: adds `12-<id>-held-rule`.

Gates:
- check (unit 351 / 24 / 607+2 skipped), boundaries and build are green.
- The five specs: 56 passed.
- Full e2e: 197 passed, 20 skipped.
- Engine e2e: 274 passed, 30 skipped.
- Load flake: held-gem "aimed at a socket… ghost" passed when run alone.

Baseline, not updated:
- Every diff is an `altar-*-solved` scene on desktop-720, desktop-1080 and iPad, at 0.2–1.6%.
- Two small `-empty` diffs: control-booth-empty (desktop-720, 0.24%) and storm-cell-2-empty (desktop-1080, 0.17%).
- These are most likely the spent-tray ×0 changes merged from polish-10, which were not re-baselined. Every change on this branch is phone/dense-gated.

Shots: `docs/design/screens/local/dense-board-4/<phone>/`.
