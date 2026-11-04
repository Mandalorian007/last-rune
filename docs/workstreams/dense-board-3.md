# Workstream: dense-board-3 (Gate 2, blind review 8: D-040 add. 9 e)

Screens: /Users/matthewfontana/repos/last-rune/docs/design/screens/local/gate8/{se,iphone,promax,android}/ (git-ignored; read from the main repo). Read the Logs of dense-board.md, dense-board-2.md and card-fit.md first.

## Findings
- **Major (iPhone, Pro Max, Android).** The Last Rune is still about 28–30 px sockets on a 34–39 px pitch. The board uses about 55% of the width while the right column under the tray is mostly empty (10-the-last-rune, 12-the-last-rune-held).
  - Target **≥ 40 px pitch on The Last Rune on iPhone, Pro Max and Android, and ≥ 34 on SE**, without clipping any card (card-fit's altar-column checks must stay green).
  - Levers: narrow the column on dense boards when no long card is up, letting cards use height; let the tray wrap tighter; shrink the gap between the left rail and the board.
  - Measure the best each phone can reach, report it, and propose what more would need (e.g. the D-044 camera).
- **Loupe placement** (12-the-last-rune-aim, 12-lift-shaft-aim). It covers the target's neighbours (the built-in Gate and two rows) and the held-gem pill and tray count. Offset it so it never covers the cell being aimed at or its 8 neighbours. Prefer free margin or the column; flip to the side with room.
- **Gauge label anchoring.** On The Last Rune "Needs 20 in one strike" sits a row below and left of its gauge; Archive's "Needs 3" sits under a socket column; the top-left Last Rune gauge is drawn smaller than the others. A label must read as belonging to its gauge at a glance: notch-to-gauge distance ≤ one label height, same gauge size everywhere.
- **Minor: source orbs clipped** by the bottom screen edge on 10-lift-shaft, 10-capacitor-bay and 13-capacitor-bay-multi (iPhone). Keep every orb and gauge fully on screen.

Phones only; desktop and iPad unchanged (`pnpm baseline` passes with no update). ws/teach-6 is changing card copy and the legend in parallel; stay in layout.ts, the loupe (altar-edit.ts / loupe code) and placement. Don't change copy.

## Done when
check, check:boundaries, build and test:e2e green. Raise the dense-board.spec minimums. Add checks: the loupe never overlaps the aimed cell or its neighbours; every label lies within reach of its gauge; every orb and gauge is inside the viewport. `SHOTS=dense-board-3`; look at The Last Rune (10, 12-held, 12-aim), Lift Shaft, Capacitor Bay and Archive on all four phones. Report a before/after pitch table. Commit to ws/dense-board-3 and never merge. Log here.

## Log
