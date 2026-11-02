# Workstream: altar-polish (wave 4, pre-alpha)

**Goal:** the altar is clear and comfortable on every board, including the big late ones, and FUSE never covers puzzle information. Fixes the altar findings from the full-run playtest.

**Owns:** `games/last-rune/scenes/altar/`, `games/last-rune/shaders/` used only by the altar, `tests/e2e/altar.spec.ts`. In `content/lines.ts`, only a new `nudge.channel` line (FUSE voice: dry, bureaucratic, no "I" in Tier 1; see `docs/design/script.md`). Add it to the script too.
**Don't touch:** `ui/` (caption-layout is changing the caption card), `scenes/hall/`, `art/hall/`, `scenes/ending/`, `art/props/` (engine-adoption), `engine/`, puzzle rules and content apart from the line above.

## Deliver
Fix these findings from `docs/design/playtest-report.md` (screenshots in `docs/design/screens/playtest/`):
1. **S1: caption covers puzzle info.** FUSE's caption covers tray slot 6 and its count on control-booth, and touches the "Needs 4 · got 0" label on intake-desk. Make the altar layout reserve room for the caption, or move the caption on the altar through whatever the caption currently exposes (CSS in `altar-styles.ts` is fine). Check every altar at 960×540 and 1280×720.
2. **S2: big boards.** Blocked sockets are hard to tell from open ones, and the whole board is very dark before the first strike (last-rune, capacitor-bay). Blocked must read as "nothing goes here" at a glance, and the board needs enough ambient light to read before any strike.
3. **S2: last rune labels.** The "Needs N" labels float far from the board, so it's unclear which requirement belongs to which machine. Tie each label visibly to its exit and machine.
4. **S3: Enter on a placed gem** rotates some gems and picks up others. Make it consistent with `docs/design/altar-ux.md` (or update the doc if a better rule is clearer), and show the rule in the key hints.
5. **S3: polish.**
   - The fizzle tag is drawn over the board.
   - The gem tooltip appears over FUSE.
   - The input cost on large boards (114 presses for 20 gems on archive): consider faster cursor travel, such as jumping to the next live socket or remembering the last cell per gem.
6. **Splitter-mill:** the storm's stand overlaps the west machine's roof. Offset the layout when two props share a side.
7. **Channel:** add `nudge.channel` so Channel gets a first-appearance FUSE line like the other gems.
8. **Engine adoption:** use `ParticleSystem.clear()` where the altar resets particles. Check the bolt against the engine's default trace timing: keep the current look via `duration`/`timeScale` if the default reads worse.

Keep the board-as-circuit look and the route preview (PM decision). Before/after screenshots of intake-desk, control-booth, splitter-mill, capacitor-bay, archive and the last rune at 960×540 and 1280×720.
`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass (including `full-run.spec.ts`).

## Log
