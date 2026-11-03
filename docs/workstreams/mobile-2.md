# Workstream: mobile-2 (a real phone layout)

User (2026-11-03), on a real phone after mobile-ui merged: "phone is absolutely unplayable. help menus cover the full screen. the bottom buttons go almost to the center... just a total mess. The text boxes are huge wrapping messes. It's very awkward. I honestly expected dramatically better. The horizontal ask is fine". Landscape-only stays (D-039).

## Why mobile-ui failed (PM)
- **Inflated layout.** mobile-ui kept the 1920×1080 desktop layout, scaled it to about 0.35, and floored every font at 14 CSS px (`ui/device-mode.ts`, `--lr-text-min`) and every hit area at 44 CSS px. Relative to the screen, that makes text and boxes 2–3× desktop size inside a layout built for desktop proportions, so panels wrap, balloon and cover the board.
- **Wrong test conditions.** Emulation used the full 844×390 / 667×375 viewport. A real phone has less room: Safari's landscape toolbar and address bar, plus about 47–59 px of left and right safe area for the notch and Dynamic Island.
- **Wrong success test.** The fit tests checked rules (text size, target size, no overlap), not "is the board the star and is it calm". The PM approved on those screenshots. Not again.

## Goal
A phone in landscape feels like a phone game: the board is the star, the chrome is small and tucked to the edges, and help is brief and dismissable. A first-time player gets the goal, the target and each piece (D-027) without the screen ever being covered.

## Design rules (hard budgets, checked by tests)
1. **Phone layout.** Design one for phones; don't inflate the desktop one. On phones the overlay uses a phone layout: buttons, tray, labels and captions are positioned for a ~2:1 landscape screen in CSS px.
   - Remove the global 14 px text floor and 44 px box inflation. Use about 12–13 CSS px for body text on phones; games routinely do this.
   - The 44 px rule applies to **hit areas** (invisible padding is fine), not drawn boxes.
2. **Board first.** On every altar, the board plus its source and need gauges take ≥55% of the usable height and ≥45% of the usable width.
3. **Chrome budget.** The persistent HUD (buttons, tray, title, counts, labels) covers ≤20% of the usable screen area.
   - Buttons are compact icon buttons on the edges (Undo, Clear, Back, Strike; Codex, Settings and Journal in a corner or behind a single ☰), each with a visible label or icon that a newcomer understands.
   - The hall's buttons must not reach in toward the centre.
4. **Help is brief and never covers the board.**
   - Any transient panel (gem info, hint, FUSE caption, verdict) is ≤1/3 of the screen width and ≤3 lines.
   - It goes in a margin that isn't over the board, and it can be dismissed with a tap.
   - FUSE's captions on phones go in a slim strip or small bubble beside FUSE. Longer lines page through (tap to advance), never one huge wrapped box. Keep the words; change how they're shown.
   - The gem info card is a compact chip: name plus a one-line rule. Long-press opens the full text and a tap closes it.
5. **Realistic viewports.** Test in these sizes, with matching safe-area insets (emulate them with CSS env overrides or by padding the test viewport):
   - iPhone Safari landscape with the toolbar showing: about 844×340 usable, with 47 px left and right insets;
   - iPhone SE: 667×320;
   - Pro Max: 932×380 with 59 px insets;
   - Android Chrome: 915×360.
6. **Desktop and iPad unchanged.** The phone layout only applies under the existing phone detection. iPad and desktop screenshots must not change.

## Scope
Cover every scene: the title, Settings, Codex, the journal, the hall, every altar (intake, relay, furnace, the big boards: archive, control-booth, Last Rune), the solve card, the ending hangout and the end card.

Keep from mobile-ui what works:
- the ↻ Turn button;
- long-press for info;
- drag-off to remove;
- lifted aim;
- the loupe and snap;
- safe areas;
- the rotate card;
- touch wording.

## Done when
- **Screenshot sheets.** The PM reviews a contact sheet per viewport above (every scene; `scripts/playtest/`; local only, `docs/design/screens/local/mobile-2/`).
- **Before images.** Include them from current main at the same realistic viewports so the difference is obvious.
- **Budget tests.** e2e checks for rules 2–4 on every altar at 667×320 and 844×340 with insets: board share, chrome share, panel size, nothing over the board except the loupe and held gem, and no page scroll.
- **Touch playthrough.** The existing touch playthroughs still pass.
- **Gates.** `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
