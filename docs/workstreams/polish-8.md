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

- **Shots** (tests/e2e/shots.spec.ts):
  - New Turn shots, each holding a gem that turns where it first reaches the tray:
    - `12-furnace-held-bend` and `12-furnace-held-bend-turned`
    - `12-press-unit-4-held-split` and `12-press-unit-4-held-split-turned`
    - Turn is lit in each, and the turned shot waits for the gem to settle.
  - Teach shots:
    - `14-intake-desk-teach` and `14-relay-tower-teach` duplicated `10-*` and are gone.
    - New `14-intake-desk-first-gem`: the card and board after the first gem is set.
    - `14-intake-desk-teach-2` stays.
    - `14-relay-tower-teach-2` is taken only if the card has a second page. Today it has none, so no shot.
  - New `16-dot-legend`: the intake board seeded whole, card closed. It is keyed on `.lr-altar-hint[data-legend]:not([data-wait])` with a soft expect, so teach-6 changing when the legend shows won't break the run.
- **Hall** (ui/hud.ts): the tag scorer now treats plates as obstacles grown 10 px, so "Start here" no longer reads as one label with the plate under it. It now sits beside the Intake Desk.
- **Title, landscape**:
  - The fill band is centred at y 600 (was 505), so FUSE stands whole on wide phones.
  - A new `TitleViewFrame.compact` flag (phone landscape) makes the view draw the name at y 330, scale 0.8. `.lr-title[data-compact]` moves the subtitle to match.
  - In compact mode the view drops the two short candles that burned through Copy link and the coffee link.
  - FUSE's docked line now starts just right of his head.
- **Title, portrait**:
  - The menu, caption and links rows are tighter: cardLane 0.17/130..160, captionLane 0.08/56..76, bottom 0.06/44..60.
  - The menu is centred in its lane, and `TITLE_UPRIGHT.minVisibleWidth` is 740.
  - The name is drawn at scale 0.54 and the subtitle at 36 px, so both keep a margin.
- **Menu over the altar** (altar-column-styles.ts): while ☰ is open, FUSE's caption is hidden and Strike is desaturated and darkened, so neither reads as live.
- **Solve card** (altar-phone-styles.ts): the stray dark diamond was the caption's tail (`::after`). Its `bottom` came from FUSE's face height, which is greater than a one-line caption is tall, so it floated above the line. It is now clamped to the caption's own edge.
- **Rotate prompt** (ui/chrome.ts): each landscape scene has its own line (`ROTATE_LINES`). The hall's is "The hall's doors stand side by side. It plays in landscape." The card is rebuilt when the line changes.
- **Out of scope, seen in shots:** a small dark round chip overlaps the top right of the held Split's tray slot (12-press-unit-4-held-split). That is gem art or the tray, owned by glyph-truth-3 or dense-board-3.
