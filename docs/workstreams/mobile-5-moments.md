# Workstream: mobile-5-moments (phone altar: hint, FUSE, verdict and solve read one at a time)

## Background
Gate review 2 (2026-11-03) scored 6 / 6 / 6.5 / 6.5, a fail. These points were checked by the PM against `docs/design/screens/local/mobile-2/gate2/*`. The calls are in D-040 addendum 3.

1. **On the first altar, FUSE's line takes the slot of the only instruction** (`gate2/se/11-intake-desk-fuse.png`). "Tap a gem, then a socket" disappears while FUSE says "Day 14,610…".
2. **A fail shows three text blocks at once** (`gate2/*/13-relay-tower-verdict.png`): the red socket tag, the verdict panel with "· Try: …" wrapping, and FUSE's quip just above Strike.
3. **The solve screen is cluttered** (`gate2/iphone/20-solve.png`, 4 of 4 reviewers):
   - the bloom washes out the finished circuit;
   - an oversized gem glow (the new-gem Amplify) sits over the top row;
   - the result card, the tilted journal scrap and Continue are stacked separately;
   - Continue is about 90×26 px;
   - FUSE's line touches the bottom edge;
   - on Android the card hugs the right edge.
4. **FUSE's sprite is clipped at the bottom edge on altar screens.**
5. **The hint stays on every altar through the last one, which is noise late in the game.**

## Scope (phones; desktop and iPad stay unchanged unless the fix is clearly shared)
1. **The hint and FUSE never compete.**
   - The how-to hint keeps its own slot. FUSE's bubble goes elsewhere: above the hint, or anchored to FUSE with a tail. It never covers or replaces the hint.
   - Once the player has completed N altars (your call, about 3) or has placed and struck successfully, the hint retires. Or it shortens to a contextual line, such as "Tap a socket" while a gem is held.
2. **A fail shows one thing at a time.**
   - The socket marker plus one verdict card ("No charge reached the machine", then "Try: …" on its own line, not "·").
   - FUSE's quip waits until the player acts, or is skipped on phones while the verdict card is up.
3. **Solve screen on phones:**
   - Tone the bloom and new-gem glow down so the lit circuit stays readable. The reward gem appears on the card, not over the board.
   - One card holds the title, line, new-gem row, journal page and Continue.
   - Continue is ≥44 px tall and full card width.
   - The card is ≥12 px inside the play area on all four phones.
   - FUSE's line sits fully on screen without covering the card.
4. **FUSE's sprite is fully on screen on altar screens** (or clearly intentional, such as peeking over a ledge, not cut by the viewport).
5. **Captures must show first-appearance teaching.**
   - Extend `scripts/playtest/mobile-2.spec.ts` with a fresh-progress capture of relay-tower (or the first altar that has a fixed new gem), so its card and pulse are visible: `14-relay-tower-teach`.
   - Do the same for the first capacitor altar, `15-capacitor-teach`.
   - Keep the existing shot names.

**File ownership:**
- You own `solve-scene.ts`, the FUSE bubble and placement code, the verdict card and the hint text/slot logic, and `scripts/playtest/mobile-2.spec.ts`.
- mobile-5-board owns the board layout, labels, Strike copy and the ↻/Turn controls. Coordinate through small, local `altar-scene.ts` edits and merge `main` before you report.
- Keep `ui/phone-styles.ts` edits in a `/* mobile-5-moments */` block.

## Tests and capture
- e2e on four phones:
  - the hint is visible and not overlapped while FUSE talks on intake-desk;
  - on a fail, FUSE's bubble and the verdict card are not visible together;
  - the solve card is inside the play area with Continue ≥44 px;
  - FUSE's sprite rect is inside the viewport.
- Capture `M2_TAG=m5moments ...mobile-2`, with sheets in `docs/design/screens/local/mobile-5-moments/`.
- Critique your own sheets as a newcomer.

## Done when
- Everything above is fixed.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- The log in this file is updated.

## Log
