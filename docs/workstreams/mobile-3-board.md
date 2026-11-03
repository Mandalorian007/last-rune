# Workstream: mobile-3-board (the altar is the star on phones)

## Background
The PM's blind screenshot review of mobile-2 scored the phone altars 6/10: "a desktop diorama letterboxed onto a phone".

On iPhone 844×340:
- the board takes about 35% of the width;
- 6×4 sockets have about a 36 px pitch;
- The Last Rune (10×8) has about a 21 px pitch, so a thumb covers 2–3 sockets.

Read D-039 and **D-040** in docs/DECISIONS.md, and docs/workstreams/mobile-2.md (budgets and viewports). The screens are in `docs/design/screens/local/mobile-2/pm-review*/` (local, not in git; regenerate them with the commands below).

## Scope
These are PM decisions. Phone only: the desktop and iPad output must be pixel-identical (`data-phone` / `deviceTraits().handheld`).

1. **Frame the board.**
   - On phones the altar camera and layout frame the board plus its source and gauges.
   - Drop or crop the decorative surround: the candles and floor fog under the board, and the empty stone at the sides.
   - Hit the D-040 socket pitch:
     - iPhone 844×340 with 47 px insets: 6×4 ≥44, 8×6 ≥38, 10×8 ≥30;
     - SE 667×320: at least 90% of those.
   - Use the width as well. Put the source and target gauges plus their "Gives/Needs" labels at the **sides** of the board where possible, so the height goes to the rows.
   - Fold the level title into the top margin, or a rail, so it doesn't eat a row.
   - FUSE, the tray and the hint stay in the margins.
2. **Light the whole grid evenly.**
   - Remove the vignette or fog darkening over the board rectangle; keep the mood outside it.
   - Give empty sockets a visible lighter rim, readable outdoors.
   - Make blocked (⊗) sockets read as a recessed plate that's barely there. They must not look like close buttons.
   - The phone and desktop shaders may share the change only if desktop screenshots are unchanged. Otherwise gate it to phone.
3. **Labels.**
   - Each Gives/Needs label is unambiguous about its gauge: next to it, with a minimum gap, or with a short leader where gauges share an edge (boiler-room, roof-array).
   - Keep about 8 px or more clearance from the board.
4. **Multi-strike panel.** "Strike 1: keeps 8 / Strike 2: …" must never cover the board or another label. Put it in a margin beside its source.
5. **Verdict strip.**
   - After a strike, the bottom band must not be jammed. Hide or shorten FUSE's quip while a verdict shows, or move the hint.
   - Show the failure tag ("Empty socket: the bolt fizzled") by the red socket, not over the source.
   - The hint is one line.
6. **Tray and hint.**
   - Tray gem tiles are ≥36 px drawn with ≥44 px hits; counts are ≥12 px.
   - Depleted (×0) gems clearly read as used up (dimmed and struck through, or moved to the end). They must not look like usable gems.
   - On Intake Desk's first visit, give the tray a gentle pulse until the first pick.
   - The hint is always one line: no orphan "·", and the ↻ part only when a turnable gem is held or placed (keep mobile-2's rule).
7. **Strike.**
   - Clearly primary when a strike is possible.
   - The capacitor marker is readable as text ("2 strikes" or "1/2"), not a 6 px "∘∘".
8. **Solve card on phones.**
   - It must not cover the board's left column; dim the board under it, or place it where it fits.
   - The "Journal · Page 2" heading must not wrap.
   - The FUSE line sits by FUSE.
   - Re-capture with a **real solved circuit**: place the intended gems before `completePuzzle`. The old capture placed none.

**Out of scope:**
- the title, hall, menus, Codex and journal (that's mobile-3-chrome);
- the ending and hangout (mobile-3-ending);
- rules and puzzles;
- wording.

`ui/phone-styles.ts` is shared with the other two workstreams. Keep your edits inside one block marked `/* mobile-3-board */` to keep merges clean.

## Tests and capture
- Extend `tests/e2e/mobile-budget.spec.ts`:
  - assert the socket pitch per board size at iphone and se;
  - assert the multi-strike panel, labels, verdict and hint don't overlap the board or each other.
- Captures:
  - `M2_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2` (fix its solve shot to place the gems);
  - `scripts/playtest/pm-review.spec.ts` (all 16 altars, half placed).
- Check the phone shots as a newcomer, and compare desktop 1920 and iPad before/after for no change.

## Done when
- Before/after contact sheets are in `docs/design/screens/local/mobile-3-board/`.
- Socket pitch numbers per board and viewport are in the log.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Commit to your branch. The PM merges, then runs the blind review (D-040).

## Log

### 2026-11-03 · board framed, column on the right (agent)

**Layout (`scenes/altar/layout.ts` `phoneLayout`, phones only).**
- The board and its gauges take the canvas height on the left. A column on the right holds, top to bottom:
  - the title;
  - the tray (rows of ≤3, gems 38 px with 46×56 px hits, counts 12 px);
  - the *lane* (gem chip, verdict, Capacitor read-out, stacked top-down);
  - FUSE's bubble or the hint (one line, reaching into the free right bar);
  - FUSE.
- West/east gauges stand in a 62 px gutter with their Gives/Needs card under them. North/south cards sit beside their gauge, 8 px clear of the board. Sides are chosen jointly (`placePhoneLabels`): never off-canvas, then never over another card, then never over a gauge. Cards are placed again whenever a card changes size (readings after a strike).
- Slab border 0.22 and front face 0.16 pitch (desktop: 0.8 / 0.42). The pitch is the biggest that fits (≤52 px).
- Turn (↻) moves to the left bar under Clear, so the right bar between ☰ and Strike is free for the chip and FUSE's bubble.

**Light.**
- Phones drop the candles, floor, fog and vignette.
- One even work light over the board, plus one on the tray.
- New socket states (`stone-wgsl` 4 'rim', 5 'plate'): empty sockets get a pale lip; blocked sockets are a matte recessed plate (no ✕). These are phone-only, so desktop shaders are unchanged.

**Cards.**
- The fail tag sits by its socket: above, else below, avoiding the cards, else dropped.
- The Capacitor read-out has a "Capacitor" head and stands in the lane, never over the board.
- The hint hides while FUSE speaks. FUSE's bubble hides if it would crowd the lane.

**Tray and Strike.**
- A ×0 gem gets a slash over its slot and a struck-through count.
- On Intake Desk's first visit the tray pulses until the first pick (static with reduced motion).
- Strike is full gold whenever it can fire.
- Multi-strike shows "×2", then "1/2", as text; the pips are hidden on phones.

**Solve.** On phones the card, journal page and Continue fill the column and the right bar, so the solved board stays in view on the left. The journal heading doesn't wrap, and FUSE's line sits beside him at the column's foot. Both capture scripts now place the intended gems before `completePuzzle`.

**Socket pitch (CSS px), before → after:**

| Board | iPhone 844×340 (47 px insets), target | iPhone before → after | SE 667×320, target | SE before → after |
|---|---|---|---|---|
| 6×4 | ≥44 | 31.5–41.5 → **51.6–51.9** | ≥39.6 | 29.6–39.1 → **45.6–52.1** |
| 8×6 class | ≥38 | 25.5–28 → **39.3–45.0** | ≥34.2 | 24–26.4 → **35.0–41.8** |
| 10×8 (The Last Rune) | ≥30 | 21.4 → **30.2** | ≥27 | 20.1 → **27.9** |

**Tests.** `tests/e2e/mobile-budget.spec.ts` now also asserts, at iphone and se:
- the pitch per board class;
- Gives/Needs cards ≥8 px clear of the board, not overlapping each other or chrome;
- the Capacitor read-out off the board and the cards;
- the hint, chip, verdict and bubble off the cards;
- the hint is one line.

**Captures.** `MB_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-3-board`. Contact sheets are `docs/design/screens/local/mobile-3-board/{before,after}-<viewport>.png`, with pitch JSON alongside.

**Proposals for the PM.**
- **D-040 addendum.** On phones, Turn lives in the left bar, bottom. The right bar is for ☰, the transient cards and Strike.
- **Shared phone-styles hygiene.** The mobile-2 info-lane rules (`--lr-info-l/-w`) are now overridden by the lane on altars. They can be deleted once mobile-3 merges.
