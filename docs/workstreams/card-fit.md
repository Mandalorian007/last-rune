# Workstream: card-fit (Gate 2, before blind review 8)

## Problem
The PM saw this in `docs/design/screens/local/dense-board-2/se/12-the-last-rune-aim.png` on main. On the iPhone SE (667×320) at The Last Rune, the held-gem card reads "Channel  Carries the charge straight through," and stops: the rest of the sentence is clipped. The dot legend ("The dot on a gauge: …") sits under it in the same lane and takes the height. The clipping predates dense-board-2.

Text that is cut mid-sentence breaks D-027 (intuitiveness) outright.

## Do
1. Find every place in the phone altar column where a card can clip its text: the held-gem card, the teach cards, the verdict, the dot legend and the Capacitor warning. Check all four phones and every altar, including when two cards are stacked (held card plus dot legend; teach card plus legend).
2. Fix it so no card ever clips. Options, in this order of preference:
   - give the dot legend its turn: show it on its own, never stacked under the held card;
   - shorten copy where it is long, keeping the rules exact (D-043: no numbers in the legend);
   - let the column grow down into free space.

   Do not shrink text below `--tc-text-min`. Do not shrink the board: dense-board.spec minimums must hold (The Last Rune: SE 32, iPhone 34, Pro Max 38.5, Android 36).
3. Add an e2e check in altar-column.spec: in the phone column, every visible card's text is not clipped (scrollHeight ≤ clientHeight + 1, and the card stays inside the column), across the altar states that stack cards.

## Done when
- check, check:boundaries, build and test:e2e are green.
- `SHOTS=card-fit` is regenerated, and you looked at The Last Rune, Capacitor Bay and Relay Tower on SE and iPhone.
- Commit to ws/card-fit and never merge. Log here.

## Log

**2026-11-04 (card-fit agent): no card in the phone column clips.**

Checks: `pnpm check`, `check:boundaries`, `build` green; full `pnpm test:e2e` 180 passed, 20 skipped, no flakes (E2E_PORT_OFFSET=437). No `BASELINE_UPDATE`.

What clipped where (found by the new altar-column check, half of each altar's design placed so a
dot lights and the legend comes up, then the arrival card, the altar at rest and each tray gem
in hand):
- **Dot legend stacked under a gem's card** (the PM's shot): The Last Rune and Storm Cell 2 on
  SE, iPhone and Android. The legend (four lines) took the lane, so the gem's card stopped at
  "straight through," (SE: 59 px of text in 42) and the legend was cut too.
- **Dot legend stacked with the Capacitor plan** at rest (The Last Rune, SE/iPhone/Android): both
  cut.
- **Gem card over the two-line Turn line** ("↻ Turn rotates the Gate in your hand."): Crane Gate
  and Press Unit 4 Split on SE (59 in 56), Crane on iPhone (77 in 74). It flaked: 1 to 3 px.
- **Teach card's picture row**: Relay Tower on iPhone ran "New" under "Got it"; Furnace on
  iPhone/Pro Max read "New / here / · / 1 of 2" with "1 of 2" past its box.

Fix, in the brief's order:
1. **The legend gets its turn** (`arrangeColumn`, column CSS): it waits (`data-wait`) while a
   gem's card, teach card, the verdict or a live read-out is up, and the Capacitor plan steps
   aside while it shows. It still retires on the next Strike (no change to `dotTold`).
2. **Shorter copy**: the Turn line in hand is "↻ Turn rotates the Gate." (the "Holding Gate" pill
   and "Turn Gate" on the rail already say it is in hand); one line on an SE. "…you just placed."
   is unchanged. No legend copy changed (still no numbers, D-043).
3. Picture row: a row too narrow for "New here" also gets the smaller picture (`data-tight`, as a
   too-short lane already did); "1 of 2" sits on its own line under "New here" (no lone "·"),
   and the button there has 8 px side padding (its 44 px hit area is unchanged).
No text got smaller, and no board changed size (dense-board.spec passes).

Tests: altar-column's `unfit` now checks every card in the lane (how-to line, legend, Capacitor
read-outs too) and FUSE's docked line: no text cut (scrollHeight ≤ clientHeight + 1, not
scrolled), no words past their own box, and the card inside the lane and the column. New test
"no card clips mid-play, cards stacked" on all four phones. moments.test updated for the Turn
line.

Shots: `SHOTS=card-fit`. I looked at The Last Rune (10, 12-held, 12-aim), Capacitor Bay (12-held,
13-before) and Relay Tower (13-fail, 14-teach) on SE and iPhone. The Channel card reads in full
("Carries the charge straight through, unchanged."). Not a clip, but noted: Relay Tower's Gate card on the SE
breaks after "sides of the arrow" because "in one strike;" is kept together (keepTogether).
