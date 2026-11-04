# Workstream: polish-10 (D-040 add. 11, minors)

Read D-040 add. 11 and the logs in `polish-9.md` and `held-gem.md` first. Shots: `docs/design/screens/local/gate10/<phone>/` in the main checkout.

## Do
1. **Aim ghost reads as placed** (Android: 12-the-last-rune-aim, 12-lift-shaft-aim). Make the ghost unmistakably a preview: translucent (about 45% alpha) with a dashed or pulsing rim, in the socket and in the loupe. Keep held-gem.spec green and update it.
2. **×0 tray gems** shrink and turn brown, so the spent Amplify is unrecognisable (Pro Max). Keep the full-size gem in its colour, dimmed slightly, with the count "×0" and a clear "spent" mark (e.g. struck-through count). Same on every phone.
3. **First gem keeps the hold?** (Android: 14-intake-desk-first-gem vs 12-intake-desk-held, the "Holding Channel" chip gone after the first teaching card.) Check whether a gem stays in hand after placing when more remain. If the teaching card clears the hold, it shouldn't; if the hold ends by design after placing, say so in the log and make sure the card doesn't read as if something was lost.
4. **Portrait Settings** sheet overlaps the Play button and a ghost "Pl" shows through (portrait/03-settings). Fix.
5. **Menu over the hall** cuts the "Lift S…" label (06-menu). The dim layer or menu must not clip labels mid-word: hide labels under the sheet, or keep them whole.
6. **Control Booth's Capacitor** on a single-strike altar (iPhone: "only hurts"). Check the puzzle in `content/puzzles`. If it's a decoy by design, leave it, and log it for teach-8/PM so the card can say so. If it's a content bug, report it to the PM rather than editing the puzzle.

Don't edit copy in content/ (teach-8), gem shaders (glyph-truth-4) or the right column layout (dense-board-4).

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run the specs you touch plus held-gem and mobile-teach, then a full `pnpm test:e2e` (unique `E2E_PORT_OFFSET`; rerun load flakes alone and name them).
- `SHOTS=polish-10` on four phones plus portrait. Look at the affected shots at real size.
- Don't run `BASELINE_UPDATE`; list the diffs. Commit to `ws/polish-10`, never merge. Log below.

## Log
