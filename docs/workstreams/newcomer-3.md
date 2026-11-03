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

**2026-11-02, newcomer-3 agent (branch `ws/newcomer-3`).** All seven items are done. Screenshots: `docs/design/screens/local/newcomer-3/{before,after}/` (gitignored; capture script `scripts/playtest/newcomer-3.spec.ts`).

1. **"gem" wording.** Pitch, lines.ts and script.md now say "Amber gem doubles", "Needs two signals at once to pass one" (and the same in progression.md), and "Ice gem. The last one". The roof line is now "Wants the ice gem first". *PM note:* the capacitor-bay solve line in the pitch ("Ice rune") was changed too, as part of the sweep. Two things were left as they are: the README tagline "Runes are gemstones", and the pitch's intake line "Take a rune". That intake line is unused, because lines.ts has its own.
2. **FUSE's failure quip follows the root fizzle.**
   - Reaction lines now carry a `cause` (`FizzleCause`), and Bend lines also carry `atGem`. `reactionLine(outcome, tier, root?, pick)` uses a line for that cause if one exists, or else a generic line for the outcome. It never uses a line about a different cause.
   - New tier-1 lines: one each for empty, blocked, ground, odd-split, gate-alone and spent, plus a generic "facing". The Bend pitch line now needs `facing` at a Bend.
   - The altar gets the root from `rootFizzle()` in strike.ts. It uses the same order as the Try line.
   - Tests: content.test.ts and strike.test.ts.
3. **The verdict never hides the root red mark.**
   - What changed: if the verdict box would cover the socket that the Try line points at (`rootCell()`), it first slides sideways within the title band. If that doesn't clear the socket, it docks under the board's last row, above the tray. Docked, it is wider, so the headline and the Try line take one line each.
   - If there is no room under the board either, the verdict stays where it was.
   - FUSE's caption now avoids the verdict too.
   - Why: at 1280×720 with 150% text, the box reaches the top row, and no top-band layout clears it.
   - Test: e2e `layout-fit.spec.ts` › "relay top-row root…" runs at 1280/150, 1280/100 and 1920/150. It checks that the verdict doesn't cover the red-mark socket, that no tag sits on the verdict, and that the verdict doesn't overlap the tray chips.
4. **Tray chip.** The hotkey is now a small keycap (`kbd.lr-k`, the same look as the HUD's C/O keys), with the `×N` count set apart from it, so "1 ×6" no longer reads as "16".
5. **Hall intake hover.** There is a new `door` line kind, `intake-desk.door`: "The intake desk. All visitors start here. The form is inside. It has been waiting a while." The hall shows it while intake is the only open door. Other open doors keep their `arrive` line.
6. **Gold rings.**
   - On the first altar, the arrival card now has a row: "**Gold ring** A socket the bolt's route must reach. Set a gem there." The briefing for screen readers says the same.
   - Why that wording: the rings mark the teach socket, the machine's exit and, later, open route ends, and it is true of all three.
   - On the first altar only, the card stays until the first placement instead of fading after 7 s.
7. **Amplify mark.** The ">>" chevrons are replaced by a Channel conduit whose diamond node is doubled (a diamond inside a diamond): "a Channel, twice". It is symmetric end to end and points neither way. The mark is the procedural SDF in `shaders/gem-wgsl.ts`. The Codex portrait uses the same shader, so it updated by itself.
