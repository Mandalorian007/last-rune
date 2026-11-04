# Workstream: dense-board-2 (Gate 2: The Last Rune on the SE)

Source: D-040 addendum 8. dense-board landed (see its log in `docs/workstreams/dense-board.md`), but The Last Rune on the iPhone SE stays at 26.4 CSS px pitch. The SE column has to stay 186 px wide for the card lane. Read the dense-board log first.

## What the PM sees
In `docs/design/screens/local/dense-board/se/12-the-last-rune-aim.png` (main repo), the board spans only about 40% of the width. The space goes to:
- the side gauge cards ("Gives 16 per strike" on the left, "Needs 20 in one strike" on the right), which reserve wide horizontal margins;
- fully blocked (carved) edge columns and rows inside the board plate.

The right column has empty space under the tray.

## Do (phones; desktop and iPad unchanged)
1. **Compact side labels on dense boards.**
   - East and west Gives/Needs cards stack above or below their gauge or source, or sit over carved stone, instead of reserving width beside the board.
   - Keep them readable at `--tc-text-min`, with no overlap with any open cell.
2. **Trim fully blocked edge rows and columns** from the fit, so the open cells drive the pitch. dense-board proposed this; Roof Array benefits too.
3. **Let the SE card lane use the height under the tray** (the verdict, teach cards and the "Try" line), if that lets the column narrow. dense-board's other proposal. Cards must never scroll on first view or overlap Strike (mobile-moments, altar-column).
4. **Target:** The Last Rune on SE ≥ 32 CSS px pitch. Report before and after for every dense altar on all four phones. No board may get smaller.

## Done when
- check, check:boundaries, build and test:e2e are green.
- `dense-board.spec` minimums are raised to the new numbers.
- `pnpm baseline` passes with no update.
- `SHOTS=dense-board-2` is regenerated, and you looked at The Last Rune, Lift Shaft, Capacitor Bay, Archive and Roof Array on SE and Android at real size, including a long verdict.
- Commit to ws/dense-board-2 and never merge. Log here.

## Log
