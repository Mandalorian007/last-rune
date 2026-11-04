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
