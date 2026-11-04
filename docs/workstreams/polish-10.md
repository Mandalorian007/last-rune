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

### 2026-11-04 (polish-10 agent)
1. **Aim ghost.** `shaders/gem-wgsl.ts` ghost state (6) only: the body is ~36% alpha and the glyph ~58% (it was 38% / 95%), and a dashed warm rim (10 dashes) runs just inside the cut's outline, turned with the gem. It's static, so reduced motion needs nothing. The loupe copies those pixels, so it shows the same. `held-gem.spec` desktop test: the ghost's middle is <80% of the placed gem's luma at the same socket and turn, and >8% of pixels differ.
2. **×0 tray gems.** `altar-hand.ts` no longer shrinks a spent gem to 0.8 on phones. The shader's spent state is now ×0.68 with 12% grey (it was ×0.42 with 35%, which turned gold Amplify brown), and its bloom is ×0.35. The "×0" count is struck through in gold (`altar-column-styles.ts`, one rule on `.lr-n`). This is the same on every phone. `mobile-teach.spec` "used-up gem" now also checks full size and the strike-through.
3. **First gem and the hold.** By design, not a bug: on phones, setting a gem down ends the hold (`placeHand`, mobile-5-board), so the rings clear and Turn turns the placed gem. The teach card does not clear it. A new `held-gem.spec` phone test shows that paging Next keeps the gem and "Holding" chip, and that placing ends both. The card on screen at that moment (Bend, 2 of 4) says nothing about losing anything. Its "Other sides lose it" is about charge, which is fine. While teaching, the first tray gem bobs again once the hand is empty, so the next tap is cued.
4. **Portrait Settings over Play.** On phones, while a modal panel is open, the title menu and links are hidden, the same as the ☰ (`chrome-styles.ts`). There's no more ghost "Pl". `chrome-polish.spec` checks this.
5. **Menu cuts hall labels.** `hud.menu(open)` marks any door plate that meets the open list's panel (plus its 6 px edge and shadow) with `data-under-menu`, which sets `visibility: hidden` (`door-plate-styles.ts`). Closing the menu clears it. `mobile-hall.spec` checks that no visible plate meets the open menu.
6. **Control Booth Capacitor.** It's a decoy by design: `content/puzzles/control-booth.ts` says "The Capacitor is a red herring: there is only one strike". The solution doesn't use it, and `essential` is split/amplify/gate. No card says so, though. **For teach-8/PM:** in single-strike rooms, add a short line to the Capacitor's card, e.g. "One strike here: what it stores never comes out." Control Booth is the only single-strike room with a Capacitor in the tray. I didn't edit the puzzle or the copy.
- Not in this brief but in add. 11's minors: "each lighting a mark" was left untouched (teach-8 copy).
- **Conflict note for the PM:** items 1 and 2 touch only the ghost and spent blocks of `gem-wgsl.ts`, which is glyph-truth-4's file. Item 2's badge rule is one rule in `altar-column-styles.ts`, which is dense-board-4's area.
- **Gates.**
  - `pnpm check` is green: 348 + 24 + 607 passed, 2 skipped. `check:boundaries` and `build` are also green.
  - Spec results:

    | Spec | Result |
    |---|---|
    | `held-gem` | 5/5 |
    | `mobile-teach` | 22/22 |
    | `mobile-hall` + `chrome-polish` + `menu-flow` + `mobile-chrome` | 25/25 |

  - Full `pnpm test:e2e` (`E2E_PORT_OFFSET=911`): 194 passed, 20 skipped and 2 failed. Both failures were load timeouts of over 5 minutes in `solve-truth` (storm-cell-2 and relay-tower, solved). Run alone, `solve-truth` passes 17/17.
  - `SHOTS=polish-10`: 17 passed and 1 skipped, on se, iphone, promax and android plus portrait. The shots are in `docs/design/screens/local/polish-10/`.
- **Baseline (`pnpm baseline`, not updated).**
  - Expected: every `altar-*-solved` shot except intake-desk, in all three viewports. The cause is the spent (×0) tray gems: same size, brighter, and the count struck through.
  - Noise, not this branch: `altar-lift-shaft-empty` (all three viewports), `altar-archive-empty` (1080), `altar-foundry-empty` (iPad) and `hall-mid` (iPad). These diffs are animation only (the Fuse character, the storm orb, the hall machinery and the windows).
  - The baseline should be regenerated after merge.
