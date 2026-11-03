# Workstream: mobile-5-board (phone altar: a big, legible board whose looks match the rules)

## Background
Gate review 2 (4 blind reviewers, 2026-11-03) scored 6 / 6 / 6.5 / 6.5, a fail. The PM checked each point below against the screens in `docs/design/screens/local/mobile-2/gate2/` and `.../pm-review-altars/`. The calls are recorded in D-040 addendum 3.

1. **Fixed gems still look like player gems (3 of 4 reviewers).** mobile-4-board's iron collar (overlay state 6) can't be seen at phone size. Compare the pink and green gems in `gate2/android/10-relay-tower.png` with a placed gem.
2. **The stone slab doesn't enclose the sockets.**
   - In `pm-review-altars/se/13-lift-shaft.png` and `12-capacitor-bay.png`, a socket by the source hangs below or outside the slab.
   - The slab also covers large blank areas, so players read blank slab as playable.
   - It is worse on 15-control-booth and 16-the-last-rune.
3. **The board is small on phones while the right column is mostly empty.**
   - Android 6×4: the board is about 320×215 of a 915×360 screen (`gate2/android/10-relay-tower.png`).
   - The Last Rune on SE has 27.6 px sockets, the main tap-accuracy worry.
4. **Text is too small: about 10–12 px** for the Gives/Needs plates, counts, "in one strike", the hint and "got N" (4 of 4).
5. **Two rotate controls.** The ↻ chip sits over the placed gem and the board edge, while Turn is in the left rail (3 of 4).
6. **Purple "valid socket" rings stay after the gem is placed**, so it's unclear whether you are still holding one.
7. **Multi-strike is unparseable (4 of 4).** From "Gives 8 ×2 strikes", "Needs 8 in one strike" and "Strike ×2", a newcomer can't tell whether one tap fires twice or whether 8 is per strike.
8. **On Android, Strike is flush with the right screen edge.**

## Scope (phones only; desktop and iPad must stay pixel-identical except where noted)
1. **Fixed means fixed at arm's length, on all platforms.** Make the collar unmistakable at 30 px sockets:
   - a thicker dark-iron ring with a lighter bevel;
   - rivets large enough to see (radius ≥0.14 pitch-relative, or whatever reads);
   - or add a small lock pip on the rim if a ring alone doesn't read.
   - It must not look like selection or hover.
   - Check at 1920 too: the desktop change is allowed for this item only.
2. **The slab hugs the sockets.**
   - The stone panel is the union or hull of the socket cells plus a margin. No socket, source or gauge stub hangs off it.
   - Large blank areas inside it should read as plain wall, not as playable slab.
   - Choose between a tight rectangle around the used cells and per-region panels. The rule: a newcomer sees "the slab is where the holes are".
   - Applies on phones. Fine on desktop too if it's a clear win, but call it out.
3. **The board fills the height.**
   - On every phone and every altar, the board plus its gauges and labels should use at least 85% of the play-area height.
   - On wide phones (promax, android), take width from the right column. The tray and Strike column can be narrower when the tray has few types.
   - Re-measure pitch and raise the e2e floors to whatever you reach. Targets:
     - The Last Rune on SE ≥30 px;
     - 6×4 on android and promax ≥60 px.
   - If a floor can't be reached, say why in the log.
4. **Text floors on phones:**
   - Gives/Needs numbers ≥15 px;
   - every other board label, gem count and the hint ≥13 px;
   - captions on dark plates at ≥4.5:1 contrast.
5. **One rotate control on phones.**
   - Remove the ↻ chip on the placed gem. The rail's Turn button stays.
   - When a turning gem is selected, Turn shows its icon or highlights, so the link is obvious.
   - Keep keyboard and desktop behaviour.
6. **Valid-socket rings show only while a gem is held.** Once a gem is placed or released, they clear.
7. **Multi-strike copy.**
   - Make the source plate, the gauges and Strike answer two questions: "one tap fires K bolts" and "N is per bolt".
   - Example (your call, check it against `docs/design/rules.md` and the capacitor rule): Strike reads "Strike" with a sub-line "fires 2×"; the source reads "Gives 8 per bolt"; the gauges read "Needs 8 from one bolt".
   - Keep it to two lines. Update any teaching or verdict copy that uses the old phrases so the wording is consistent.
   - Propose rule-text changes, but don't edit `rules/` semantics.
8. **Strike sits ≥12 px from the screen edge on every phone** (curved-edge Android).

**Out of scope:**
- the hint and FUSE placement, the verdict stacking and the solve screen (that's mobile-5-moments, which owns `solve-scene.ts` and the FUSE and verdict overlays);
- the hall, menus, ending and hangout (mobile-5-chrome).

**File ownership:**
- You own `layout.ts`, `socket-looks.ts`, the stone/slab shaders and art, and the board and label parts of `altar-scene.ts` and `altar-styles.ts`.
- Keep `altar-scene.ts` edits small and local. Merge `main` before you report.
- Keep `ui/phone-styles.ts` edits in a `/* mobile-5-board */` block.

## Tests and capture
- `tests/e2e/mobile-budget.spec.ts`, on four phones:
  - board-height share ≥85%;
  - every socket inside the slab;
  - text floors (computed font-size of the board labels, counts and hint);
  - the new pitch floors;
  - no ↻ chip on phones;
  - Strike ≥12 px from the edge;
  - no valid-socket rings after placement.
- Unit test (`socket-looks` or `layout`): every puzzle's sockets lie inside its slab rect(s).
- Capture:
  - `M2_TAG=m5board pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review`;
  - before and after sheets in `docs/design/screens/local/mobile-5-board/`, including desktop and iPad.
  - Critique your own sheets as a first-time player before reporting.

## Done when
- Everything above is fixed.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- The log in this file has the pitch table and a list of changes.

## Log
