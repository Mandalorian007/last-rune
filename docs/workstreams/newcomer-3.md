# Workstream: newcomer-3

PM judgement (2026-11-02): clear the proposals newcomer-2 logged (see its log in `docs/workstreams/newcomer-2.md`). Intuitiveness first (D-027). Keep every change small, with tests.

## Scope
1. **Pitch lines (PM-approved edits).** Update the source in `docs/` pitch-v0.3.md, then lines.ts and script.md, so content.test.ts still matches:
   - furnace solve line: "Amber rune doubles the charge" → "Amber gem doubles the charge";
   - relay arrive line: "Needs two full signals" → wording that says the two signals must arrive at once (keep FUSE's voice).
   Then sweep player-facing text for any other "rune" that means a gem. The hallway rune and the Last Rune are real runes, so leave those.
2. **FUSE's failure quip by cause.** Today the quip is picked by outcome only, so on an empty-socket fizzle he can say "set a Bend facing a wall". Pick the quip by the same root fizzle that `nextStep()` uses, and fall back to a generic line. Write any new lines in FUSE's dry voice and add them to script.md.
3. **Verdict vs. the top row at 1280×720 with 150% text.** The headline wraps to two lines and the box covers the altar's top row, which can hide the red mark. Make a design call. Options:
   - shrink the verdict headline at that size;
   - move the verdict into the title band or to the side;
   - when the root mark is on a covered row, shift the verdict.
   Whatever you choose, the root red mark is never hidden. Add a layout-fit test.
4. **Tray chip "1 ×6"** can read as "16". Separate the hotkey from the count clearly (for example, a key-cap style hotkey and "×6" apart from it).
5. **Hall hover on the intake desk** plays its altar line ("Step one: gem from the tray") before the player is at the altar. Give it a hall-appropriate line.
6. **Live socket rings are never explained.** Add one short line to the first altar's teaching (hint or info card) that says what a lit ring means.
7. **Amplify's ">>" chevrons** suggest a direction, but Amplify ignores rotation (D-031). Use a symmetric mark that still reads as "doubles". Keep it procedural, and update the Codex if it shows the glyph.

Out of scope:
- Puzzle layouts.
- Lighting.
- Engine internals.

## Done when
- Before/after screenshots in `docs/design/screens/local/newcomer-3/`. Don't commit them.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
