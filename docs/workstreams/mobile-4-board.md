# Workstream: mobile-4-board (phone altar: clear socket states and nothing clipped)

## Background
mobile-3 hit the D-040 socket pitch. The D-040 gate review (4 blind reviewers, 2026-11-03) still scored 6/6/6.5/6.5, so the gate failed. Problems more than one reviewer raised on the altar, all checked by the PM against the screens:

1. **Blocked vs open sockets are ambiguous (4 of 4 reviewers; one called it a blocker).**
   - The phone blocked "plate" (`stone-wgsl.ts` state 5) shows as a grey disc. Open sockets show as navy discs.
   - Nobody could tell which is which (`pm-review-altars/*/14-roof-array`, `gate1/promax/10-archive`).
2. **Fixed-gem dashed corner brackets read as "selected / picked up" (3 of 4).** D-040 kept them; the PM is reversing that, see below.
3. **The held gem lifts over the altar title** and its count badge is clipped at the top edge. The gem tooltip covers the tray counts (`gate1/*/12-relay-tower-held`). Raised by 3 of 4.
4. **The hint runs under Strike on SE:** "Tap a gem, then a socket · ↻ turns i…" (`gate1/se/12-relay-tower-placed`).
5. **Gauge labels and orbs touch or cross the play-area edge on large phones.**
   - The Last Rune's top and bottom "Needs" plates hit y=0 and the bottom edge (`gate1/promax/10-the-last-rune`).
   - The Gives orb touches the left bar (`gate1/promax/10-archive`).
6. **The Gives label formatting varies:**
   - "Gives 8 2 strikes" on one line in lift-shaft;
   - three stacked lines elsewhere;
   - "in one strike" on some gauges and not others.
7. **The tray is small on large phones** while the right column has empty space. "×0" types for gems the puzzle doesn't offer clutter the tray and read as "forbidden".

## Scope (PM calls, recorded in D-040 addendum 2)
Phone only, unless a point says otherwise. Desktop and iPad stay pixel-identical, except for item 2, which applies everywhere.

1. **On phones, a blocked cell is not a socket.**
   - Draw no disc, ring or plate. The board's stone surface simply continues, perhaps with a very faint flat inset. Only real sockets show as holes, with the pale rim mobile-3 added.
   - Test: at arm's length, a newcomer sees "the holes are where gems go".
   - Check that 8×6 and 10×8 boards still read as a grid. If they don't, a barely-there seam is fine, but never a disc.
2. **Fixed gems: replace the dashed corner brackets on all platforms** (D-027: the brackets read as selection).
   - Use a "bolted in" treatment instead: a solid dark-metal collar ring with 3–4 small rivets around the gem, or a small padlock pip.
   - It must not look like a selection or hover state.
   - Make sure nothing else uses dashed brackets to mean "selected" in a way that collides.
   - Desktop changes for this item only. Check the Intake Desk, Furnace and The Last Rune at 1920×1080 and on phones.
3. **The held gem stays inside the column.**
   - The lifted tray gem must not overlap the altar title, and its count badge must stay fully on screen.
   - The gem chip/tooltip goes in the card lane **below** the tray. It must never cover the tray counts.
4. **The hint fits.**
   - The hint is laid out inside the right column's width and never runs under Strike.
   - If it doesn't fit, drop the ↻ clause before truncating.
   - No ellipsis on any viewport.
5. **Edges.**
   - Every gauge orb, Gives/Needs plate and source orb sits at least 4 px inside the play area (the safe-area insets and the side bars) on all four phone viewports.
   - Shrink the board pitch slightly if needed, but stay at or above D-040.
6. **One label format.**
   - Gives: "Gives N" with a second line "×K strikes" only on multi-strike altars.
   - Needs: "Needs N" with a second line "in one strike" only on multi-strike altars.
   - Use the same structure on every altar. Never run it together on one line.
7. **Tray.**
   - On phones, hide gem types the puzzle starts with zero of.
   - Types depleted *during play* stay visible: dimmed to about 40%, "×0" not struck, no slash.
   - Scale tray gems to the column: ≥44 px drawn where the column allows (promax, android), ≥38 px on SE, counts ≥13 px.

**Out of scope:**
- the hall, menus, Codex, journal, ending and hangout (that's mobile-4-chrome);
- rules, puzzles and wording.

Keep `ui/phone-styles.ts` edits in a `/* mobile-4-board */` block.

## Tests and capture
- Extend `tests/e2e/mobile-budget.spec.ts`, at iphone, se, promax and android:
  - every gauge, source and label rect is ≥4 px inside the play area;
  - the held gem and its badge don't overlap the title and stay on screen;
  - the tooltip doesn't overlap the tray;
  - the hint isn't truncated and doesn't overlap Strike.
- Add a unit or e2e check that blocked cells use the new no-disc state on phones.
- Capture with the existing scripts, then build contact sheets in `docs/design/screens/local/mobile-4-board/`:
  - `M2_TAG=m4board pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review`
  - the mobile-3-board spec, for before/after and desktop.
- Critique your own sheets as a first-time player before reporting.

## Done when
- The issues above are fixed, and before/after sheets exist for iphone, se, promax, android, desktop and ipad.
- The desktop and iPad diffs are limited to the fixed-gem treatment.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Log in this file.

## Log
