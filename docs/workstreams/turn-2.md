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
