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

**Pitch (CSS px), before (dense-board-2) → after:**

| Altar | SE | iPhone | Pro Max | Android |
|---|---|---|---|---|
| The Last Rune | 32.3 → 32.3 | 34.4 → 35.2 | 38.6 → 40.3 | 36.4 → 38.1 |
| Lift Shaft | 37.2 → 35.8 | 39.8 → 38.3 | 45.4 → 43.7 | 42.7 → 41.0 |
| Capacitor Bay | 39.3 → 38.6 | 41.8 → 41.4 | 47.1 → 47.1 | 44.4 → 44.4 |
| Archive | 38.6 → 36.1 | 46.9 → 46.9 | 52.1 → 52.1 | 49.0 → 49.0 |
| Control Booth | 38.6 → 39.6 | 46.9 → 48.0 | 51.3 → 51.3 | 49.0 → 49.0 |
| Roof Array | 45.2 → 46.2 | 53.1 → 53.1 | 50.9 → 50.9 | 47.7 → 47.7 |
| Splitter Mill | 44.1 → 44.1 | 61.3 → 61.3 | 71.2 → 71.2 | 68.7 → 67.8 |

- **Compact gauges** (`layout.ts`, `PH.compactGain`). A dense board takes every cabinet at `machineDense` (34 CSS) when that buys the sockets at least 0.5 CSS px. That happens on height-bound boards, where the gauges above and below cost rows. All gauges on a board stay one size.
- **Orbs on screen** (`orbExtent`). A north orb's reach counts its brass rings (0.8 + 0.075 per ring, in units of 0.4 size), and a south orb's counts its iron foot (0.48 size below the glass). Before, both counted a 0.29-size disc, so the foot fell off the bottom on Lift Shaft and Capacitor Bay. This costs Lift Shaft about 1.5 CSS px. West/east orbs were already on screen; the e2e now checks that.
- **Label rule.** A west/east card hangs under its gauge. When it would cover the edge column's rings, it either drops past them or (new) lifts over the gauge past them, whichever leaves it nearer its gauge (`placePhoneLabels`). Its notch follows the gauge both ways: the `above` notch now uses `--lr-notch`.
  - The layout only accepts a narrow (gauge-only) gutter when that move is at most one card height (`labelH`; was 1.1 pitch).
  - A height-bound board also tries a `wide` fit, where such a card gets its own gutter clear of the rings, and takes it when it costs no pitch.
  - Effect: The Last Rune's "Needs 20" sits under its gauge on iPhone, Pro Max and Android. Archive's "Needs 3" on an SE no longer drops a row under a socket column, which costs the SE 2 CSS px of pitch there (still 36).
- **Loupe rule** (engine `MagnifyOptions.clear` and `loupeClear`, noun-free, unit-tested in `magnify.test.ts`). The loupe takes the free spot nearest the aim point that is:
  - 6 px clear of the aimed socket's 3×3 neighbourhood;
  - clear of the fingertip;
  - never below the finger;
  - on screen.
  It covers the column's title, held-gem pill and tray counts (`colL..colR`, above `laneTop`) only when nothing else is free.
- **SE ≥34 on The Last Rune is not reachable.** The SE is width-bound at the 140 lane. The E card can't hang on carved stone without dropping over col-9 rings, so it needs a full gutter. Reaching 34 needs about 15 CSS more width. The levers are a smaller orb, nesting the E cabinet into the slab margin, or a narrower lane. Each one costs legibility or puts the card back over the sockets. 40 on iPhone is also out of reach: with zero-cost gauges the ceiling is (340 − 8)/8.38 ≈ 39.6. Beyond these numbers you need the camera (D-044): pan or zoom the board, or a portrait layout.
- **Tests** (`tests/e2e/dense-board.spec.ts`):
  - The Last Rune minimums are raised to iPhone 35, Pro Max 40 and Android 38. The SE stays at 32.
  - New checks: one gauge size per board; every orb (rings and foot) and gauge inside the app on screen; every card within its own height of a gauge, one card per gauge.
  - A new loupe test drags to the extreme and middle sockets of The Last Rune and Lift Shaft on four phones, then checks that the loupe is clear of the 3×3 and on screen.
- **Gates** (E2E_PORT_OFFSET=573):
  - `pnpm check`: 597 passed. `check:boundaries` and `build` ok.
  - Full `pnpm test:e2e`: 177 passed, 3 failed, 20 skipped. The 3 failures were mobile-ending se, and solve-truth boiler-room and foundry. Rerun alone with `--workers=1`, all 20 tests in those two specs pass. They are flakes; none of them touch layout or the loupe.
  - `pnpm baseline`: exit 0, 125 passed. 4 desktop scenes were flaky on retry (splitter-mill and crane empty at 720, title and boiler-room empty at 1080). No image changes.
- **Shots:** `docs/design/screens/local/dense-board-3/{se,iphone,promax,android}/` (not committed).
