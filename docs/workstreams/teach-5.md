# Workstream: teach-5 (Gate 2, blind review 7 copy and cards)

Source: D-040 addendum 8; D-043 (Strike is a free test; **no** live "would get N" readout). Shots: `docs/design/screens/local/gate7/` in the main repo. Key files: 10-capacitor-bay, 15-capacitor-teach*, 13-capacitor-bay-before, 10-roof-array, 10-lift-shaft, 10-conveyor-a, 10-relay-tower, 14-relay-tower-teach, 10-foundry, 10-furnace, 12-furnace-held, 12-storm-cell-2-held, 20-solve, 06-menu-altar, 30-ending, 31-hangout, 32-end-card, 01-title.

## Do
1. **Multi-strike label (4/4 major).** "Strike (2 left)" → "Strike ×2", with two pips that light one per pulse as they fire. Nothing on the button counts down. The Capacitor card says it plainly: one tap sends two pulses, one after the other; a miss resets for free. Update `nowrap` and its test.
2. **Diagram cards.** For Split, Gate and Capacitor, put the diagram above the text on phones so the text gets the full card width: no "Power / the no- / arrow end", no hyphen splits. Plain words: e.g. Split "Charge in at the plain end, half out of each arrow"; Gate "Charge must arrive on both sides in the same strike". Keep wording consistent with the Codex.
3. **Amplify gets a picture.** An in→out diagram like the others: "4 → 8; a second Amplify on the same path: 8 → 8".
4. **Furnace Channel line.** Replace "A Channel lies along the run on its own: no turning." with plain words (e.g. "Channels line up with the wire by themselves, so Turn skips them.").
5. **Explain the Needs dot once.** First time a dot lights, a short line: hollow = no charge reaches it yet, lit = charge reaches it, red = it will trip. This explains an existing signal; it is not a value readout.
6. **Capacitor warning fits.** One short line, no scroll chevron: e.g. "Strike 2 sends 16; this gauge needs 8."
7. **Minors.** The solve card shows the gauge result ("got 8 ✓"). The ending (30, 31) shows a visible "Tap to skip" (or Skip) control. The ☰ menu on the altar does not cover the hint (06-menu-altar). The title FUSE box sizes to its line.

ws/dense-board is moving the altar column at the same time: stay in copy, card content and layout inside the card, and the strike button; leave column sizing to it. ws/glyph-truth-2 owns gem glyphs and the lock badge.

## Done when
- check, check:boundaries, build, test:e2e green; update or add e2e for the strike label and pips, the dot explanation shown once, and the ending skip.
- `SHOTS=teach-5` regenerated; you read every changed card on SE at real size.
- `pnpm baseline`: list intended desktop/iPad diffs; don't regenerate.
- Commit to ws/teach-5, never merge. Log here.

## Log

### 2026-11-04 (teach-5 agent)
1. **Strike ×2.** Phone Strike reads "Strike ×2" (nothing counts down) with two pips that light one per strike as it fires, and hide on "Try again" (`strikeLabel`, `setStrikeWord`, altar-chrome). `keepTogether` keeps "Strike ×2" on one line. The strikes card now says: "One tap sends two strikes, one after the other. A miss resets for free." ("Needs 8 in one strike" already sits on the gauges.)
2. **Picture first.** On phones, the Split, Gate, Capacitor and Amplify cards put the picture in a head row (picture · New here · button), with the words at full width under it. The Codex wording is now plain:
   - **Split:** "Charge goes in at the plain end; half comes out of each arrow. Odd charge, or charge from another side, is lost." Chip: "Charge in at the plain end, half out of each arrow; odd charge lost."
   - **Gate:** "Charge must reach the two sides beside the arrow in one strike; their sum leaves by the arrow. One side alone is lost." Chip: "Charge both sides of the arrow in one strike; the sum goes out."
3. **Amplify picture.** The card shows 4 in, 8 out, then "Doubles the charge, once per path." and "A second Amplify on the same path: 8 → 8."
4. **Furnace Channel.** "Channel works whichever way the charge comes in: no need to turn it."
5. **Dot legend, once per game.** The first time a gauge dot lights, the hint shows "The dot on a gauge:" with three rows: hollow, "no charge reaches it yet"; lit, "charge reaches it"; red, "it will trip". It shows no numbers. The next Strike retires it through a new optional save flag, `flags.dotTold`. The red-dot line is now "Red dot: this gauge will trip."
6. **Capacitor warning.** "Strike 2 sends 16; needs 8." fits on one line with no chevron.
7. **Minors:**
   - The solve card leads with a "Got 8 ✓" pill.
   - The ending always shows Skip, including the first viewing (`endingSkippable` returns true; ending.md updated). This changes the rule that only replays could skip.
   - With the altar ☰ open, the hint is hidden instead of being half covered.
   - The landscape title FUSE box hugs its one line.

Tests:
- strike/nowrap/teach/flow/ending-model unit tests updated.
- `mobile-strike.spec` checks "Strike ×2", that 2 pips show unlit, that they light 1 then 2 during the run, and that none show on "Try again".
- `mobile-teach.spec` has a new "dot legend (se)" test: it shows once, Strike sets `dotTold`, and nothing shows after a reload or at the next altar.
- `ending.spec` has a new test that the first viewing shows Skip and Skip reaches the end card.
- `capacitor.spec` copy updated.

Shots: `docs/design/screens/local/teach-5/se/` (read at SE size: 01, 06-menu-altar, 10-furnace, 13-capacitor-bay-before, 14-relay-tower-teach, 15-capacitor-teach*, 20-solve, 30-ending).

Gates:
- `pnpm check`, check:boundaries and build are green.
- `pnpm test:e2e`: 164 passed and 1 failed. The failure was altar-column se: the crane Gate card overflowed with the longer chip. I shortened the chip to "Charge both sides of the arrow in one strike; the sum goes out.", and that spec passes when rerun alone.
- A picture-first card that still does not fit its lane draws its picture smaller (`data-tight`) rather than scroll.

`pnpm baseline`: 30 intended diffs, the same 10 scenes on desktop-720, desktop-1080 and iPad. Not regenerated.
- splitter-mill, relay-tower, press-unit-4 and crane, empty and solved: the Split and Gate Codex wording.
- verdicts › solve card: the "Got N ✓" pill.
- ending › the hangout: Skip is visible on the first viewing.
- Flaky, passed on retry: title (720 and 1080), boiler-room empty and roof-array empty (720).
