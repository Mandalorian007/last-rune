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
