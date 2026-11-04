# Workstream: polish-8 (Gate 2, blind review 8: D-040 add. 9 f + chrome minors)

Screens: /Users/matthewfontana/repos/last-rune/docs/design/screens/local/gate8/{se,iphone,promax,android,portrait}/ (git-ignored; read from the main repo).

## Do
1. **Shot coverage** (tests/e2e/shots.spec.ts). Reviewers couldn't judge turning, because every 12-*-held shot holds a Channel, so Turn is always disabled.
   - Add shots holding a Bend and a Split with Turn enabled, and after one Turn.
   - 14-intake-desk-teach and 14-relay-tower-teach are pixel-identical to their 10-* shots. Capture the actual teaching moment (step 2 of the card, or the card that appears on the first placement), or drop the duplicate.
   - Add a shot where the gauge-dot legend is up. ws/teach-6 is changing when it shows: key the shot on a stable selector and coordinate through the PM if it breaks.
2. **Hall.** The locked "The Last Rune" label sits on the "Start here ▾" pill (02-hall, Android), so it reads as "The Last Rune: Start here". Separate them.
3. **Title.**
   - FUSE is cut off by the bottom edge and his bubble floats far from him (01-title, Android).
   - The candle flames overlap "Copy link" and "Buy ThunderSoap a coffee" (iPhone).
   - Portrait title has a dead band (portrait/01-title).
4. **Menu over the altar.** With ☰ open, Strike and FUSE's bubble stay fully lit above the dimmed board and look tappable (06-menu-altar). Dim or hide them under the menu.
5. **Solve card.** A stray small dark diamond sits under the result card (20-solve, Android). Find it and remove it.
6. **Rotate prompt.** "This room is wider than it is tall" shows on the hall as well (40-rotate-hall); give the hall its own wording.

Don't touch scenes/altar layout, the loupe, gem art or teach copy: ws/dense-board-3, glyph-truth-3 and teach-6 are running. Item 4 may touch the altar menu dimming only.

## Done when
check, check:boundaries, build and test:e2e green. `pnpm baseline`: list intended diffs (don't update). `SHOTS=polish-8`; look at the changed screens on SE, Android and portrait. Commit to ws/polish-8 and never merge. Log here.

## Log
