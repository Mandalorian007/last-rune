# Workstream: turn-2 (wave 5, top priority, D-027 / D-029)

## User feedback (verbatim, 2026-11-02, after turn-clarity merged)
> roate should save rotation without enter key and should be more intuitive on text

## PM reading (verify by reproducing before changing anything)
After a gem is placed, the tray keeps the same kind in hand. Hovering the Bend you just placed shows the held-gem ghost *over* it. R or scroll then turns the ghost (the hand), not the placed Bend. The turn only "saves" if you click or press Enter to set the ghost down. The player sees the gem turn and expects it to stay turned.

Reproduce the real flows (mouse and keyboard) on splitter-mill and furnace, and find every path where a turn is shown but not committed.

## Goal
- **A turn you see is a turn that sticks.**
  - R, Q or scroll over a placed gem turns that placed gem immediately, with no Enter or click, and it stays turned, even with a gem in hand.
  - The ghost of the held gem appears only over empty sockets, never over a placed gem.
  - Keyboard: R over a placed Bend at the cursor turns it in place. Never require pick-up → turn → set-down.
  - Check whether keeping the gem in hand after placing is still right. If it causes the confusion, propose a fix, e.g. the hand empties after placing a turnable gem, or the ghost hides until the pointer leaves the placed socket. Choose what a first-time player would expect, and justify it in your log.
- **Plainer text.** Rewrite the altar hint line, turn tags, card tags and announcements in plain words a newcomer gets at a glance. Short, concrete verbs, no jargon. For example:
  - "Click a gem below, then a socket to place it · R or scroll to turn · Right-click to remove"
  - "Can't turn: the bolt splits left and right"
  
  Keep FUSE's voice out of UI text. Match the rules exactly (`docs/design/rules.md`). Check that the text fits at 1280×720 with 150% text.

## Done means
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green. Extend `tests/e2e/turn-clarity.spec.ts`:
  - with a Bend in hand, R or scroll over a placed Bend turns the placed one, the turn persists with no click or Enter, and the hand is unchanged;
  - the keyboard equivalent.
- Before and after screenshot sequences of the flows, in your scratchpad, listed in your report.
- Update the input rule in `docs/design/altar-ux.md`. Propose any change to D-029 to the PM.

## Log (turn-2 agent)

### Reproduced (before shots: scratchpad `turn2/before/`)
PM reading confirmed. `scripts/playtest/turn-2.spec.ts` logs the saved turn next to each shot. On
splitter-mill and furnace, mouse and keys, at 1920 and 1280@150: place a Bend from the tray, R,
scroll, look away. The saved turn stayed `0` at every step. Root cause in `altar-scene.ts`:
- `ghost()` / `lands()` treated the player's placed gems as landing spots (for "replace"), so with
  a Bend still in hand after placing, the held Bend was drawn on top of the Bend just placed;
- `turnAt()` turned the hand whenever one was held, so R/scroll turned that ghost;
- the turn only reached the board through `placeHand()`'s same-kind branch (click/Enter
  re-turned the placed gem to match the hand), which is also a click that turns.
Moving the pointer away showed the placed Bend at its old turn and the ghost leaving with it.
One more path where a turn showed but did not stick: dragging a placed Bend, turning it mid-drag
and dropping it back on its own socket threw the turn away.

### Fix (built)
- R/Q/scroll/RB over one of the player's placed gems turns that gem in place, saved at once,
  whatever is in hand. The hand is never turned there. A gem that can't turn says so at that gem.
- The held-gem ghost (and its route preview) appears only over empty sockets. Over a placed gem
  the held gem waits beside the socket (as over a refused socket), the socket gets the cyan
  hover ring, the card shows the placed gem (tag `R or scroll to turn`), and the turn badge hides.
- Click/Enter with a gem in hand on a placed gem of the same kind no longer re-turns it: it
  does nothing and says `Bend already here: R or scroll turns it` (`R or Q` on keys). On a
  different kind it still swaps.
- Dragging a placed gem and dropping it back where it came from keeps a mid-drag turn.

### Keep the gem in hand after placing? Yes.
The confusion came from the ghost sitting on the placed gem and R targeting the hand, not from
the hand itself. With both fixed, a newcomer who places a Bend and presses R sees the Bend they
just placed turn and stay turned, which is what they expect. Emptying the hand after placing a
Bend would cost a tray click per gem and make Bends behave differently from Channels (which
stamp a route one click per socket), and the keyboard flow (gem key, Enter, R) relies on the
hand staying. Hiding the ghost until the pointer leaves would still leave R ambiguous on the
next press, so the rule is by target instead: R turns what you see in that socket.

### Text (old → new)
See the report; all strings live in `altar-scene.ts` (`INFO_TAG`, `NO_TURN`, `SPLIT_CARD`,
`DENY_REASON`, `sidesText`, `hintLine`, announcements). Hint lines checked at 1280×720 / 150%.

### Tests
`tests/e2e/turn-clarity.spec.ts`: two new tests (mouse: Bend in hand, R and scroll over the placed
Bend turn it, persists with no click, hand unchanged, click doesn't turn it back; keys: Enter,
R, Q Q over the placed Bend at the cursor, persists after moving off, hand unchanged). Existing
tag strings updated.

### Proposed for the PM
- D-029 amendment: "R/scroll turns the gem you see under the pointer; a placed gem turns in
  place even with a gem in hand. The held gem is drawn only in empty sockets. A click never
  turns, including a click with the same kind in hand on a placed gem."
