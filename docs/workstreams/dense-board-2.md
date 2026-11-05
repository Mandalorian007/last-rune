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

**2026-11-04: The Last Rune on the SE reaches 32.3 CSS px (was 26.4).** Every change is in
the dense fit (`phoneFit(..., dense)`, phones only), so desktop, iPad and non-dense boards are
untouched.

Pitch / column (CSS px), before → after:

| Altar | SE | iPhone | Pro Max | Android |
|---|---|---|---|---|
| the-last-rune | 26.4/146 → **32.3/142** | 32.8/164 → 34.4/195 | 36.9/186 → 38.6/206 | 34.7/216 → 36.4/216 |
| lift-shaft | 36.1/216 → 37.2/216 | 39.1 → 39.8 | 44.5 → 45.4 | 41.9 → 42.7 |
| capacitor-bay | 35.1/188 → 39.2/216 | 40.2 → 41.8 | 45.4 → 47.1 | 42.7 → 44.4 |
| archive | 33.3/142 → 38.5/142 | 45.7/123 → 46.9/140 | 52.1 → 52.1 | 49.0 → 49.0 |
| control-booth | 33.3/142 → 38.5/142 | 43.4/142 → 46.9/140 | 51.3 → 51.3 | 49.0 → 49.0 |
| roof-array | 40.6/143 → 45.1/140 | 45.7/184 → 53.1/178 | 50.9 → 50.9 | 47.7 → 47.7 |
| splitter-mill | 44.1 → 44.1 | 61.3 → 61.3 | 71.2 → 71.2 | 68.6 → 68.6 |

Every other altar is unchanged on every phone. No board got smaller.

What changed (`games/last-rune/scenes/altar/layout.ts`):
- **West/east cards over carved stone** (`sideFit`): a W/E gauge whose Gives/Needs card can hang
  under it over carved stone, after the same single drop past rings that `placePhoneLabels`
  makes (at most 1.1 pitches, ending above the slab's front), gets a gutter only as wide as the
  gauge (`sideOff`); otherwise its side keeps the 66 CSS gutter. The card still sits right under
  its gauge with the notch pointing up at it.
- **Trimmed carved edges** (`carvedEdges`): fully carved edge rows/columns are left out of the
  fit (they are only wall on the hugged slab). `AltarLayout.span` marks the cells still in play,
  so `cellAt` returns null over a trimmed column (a tap there can reach the tray).
- **Height**: dense cabinets go down to 34 CSS (`machineDense`), dense orbs to 1.7 pitches
  (`stormDense`); a cabinet no longer reserves the orb's 1.4-radius room; N/S cabinets nest over
  the slab margin to 2 CSS short of their socket's ring (`nestAt`); a dense board's top/bottom
  inset is 4 CSS (`edgeDense`).
- **SE lane**: on a narrow phone the dense fit is also tried with the 140 CSS lane, but only for
  boards whose base column was already under 186 (The Last Rune, Archive, Control Booth, Roof
  Array). Capacitor Bay and Lift Shaft keep the 186+ lane their long verdicts need.
- **N/S cards**: a north/south card's reach past the (trimmed) slab is reserved in the block, and
  two gauges on one side never sink their cards toward each other into the same stone (Roof
  Array's two north cards collided once its carved columns were trimmed). The reach is taken at
  the verdict's width ("Needs 10 · got 16", `labelGot` 118 CSS).

The third proposal (the SE card lane using the height under the tray) was not needed: the SE
lane stays at 142 and every card fits it (altar-column).

Tests: `dense-board.spec` minimums raised (SE 32, iPhone 34, Pro Max 38.5, Android 36), plus a
new check that no two Gives/Needs cards overlap on a dense board (altar-column skips label vs
label). `mobile-budget.spec` takes the slab as the layout's `span` (trimmed edges are not slab)
and checks only open sockets against it (a carved cell is no socket on a phone).
Shots: `SHOTS=dense-board-2`.

Checks: `pnpm check`, `check:boundaries`, `build` green; full `pnpm test:e2e` 176 passed (no
flakes). **`pnpm baseline` fails on main itself**: on a clean checkout of c820979 the same 101
shots fail (the tray gems' glyphs changed since the baseline was taken; e.g. Intake Desk
desktop-720 2813 px on both). This branch fails exactly the same 101 with the same counts
(within the run-to-run jitter), so it changes nothing on desktop or iPad. The baseline needs a
`BASELINE_UPDATE` from the PM on main; not done here.
