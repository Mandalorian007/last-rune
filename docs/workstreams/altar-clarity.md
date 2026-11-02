# Workstream: altar-clarity (wave 4)

**Goal:** the altar is clear, clean and intuitive for someone who has never seen the rules (user feedback, 2026-11-02). altar-scene shipped a playable altar for all 16 puzzles (`docs/design/altar-ux.md`); this pass removes the friction.

**Owns:** `games/last-rune/scenes/altar/`, `docs/design/altar-ux.md`, `docs/design/screens/altar-*.png`, `tests/e2e/altar.spec.ts`.
**Don't touch:** `scenes/hall/` and `art/hall/` (hall-floor), `engine/` (engine-cleanup; ask the PM), `content/lines.ts` (story-scenes owns FUSE lines; use the placeholder hooks), puzzle definitions (propose changes to the PM).

## Deliver
1. **Board noise:** intake-desk shows a 6×4 grid of 24 empty sockets for a 5-gem puzzle (`altar-intake-held.png`). Make the board read as a circuit, not a spreadsheet. Options include fading or hiding unused sockets, drawing faint wire channels between sockets, and sizing the board to the puzzle. Pick what reads best, check it on early, mid and finale puzzles, and keep the rules unchanged.
2. **Machine connection:** the gauge sits small and away from the board. Make the board's output visibly feed the machine: the machine sits where the charge exits, and the "Needs N · got M" label is large and next to it.
3. **Strike readability:** check that a first-time player can follow the strike playback (`altar-strike.png`, under, over and multi-strike). What went wrong on an under or over result should be visible on the board, not only in text.
4. **Onboarding across the first three puzzles:** each new gem's first appearance gets the same no-reading treatment intake-desk has (a pulse and a one-line hint hook). Leave the line text as named placeholders and list them for the PM, because story-scenes writes FUSE lines.
5. **Bug:** `ParticleSystem.clear()` is fixed by engine-cleanup. Once it lands on main, use it if you need it; otherwise leave it alone.
6. Keep `tests/e2e/altar.spec.ts` green and update the screenshots. `pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log
