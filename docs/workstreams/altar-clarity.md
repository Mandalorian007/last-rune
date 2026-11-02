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

- **Wave 4 (altar-clarity).** Before shots were critiqued as a first-time player. Problems found:
  - A held gem lit every legal socket, so the board read as a grid of holes.
  - Machines were small and sat off to the side, with tiny `Needs` labels.
  - Under and over results had no explanation on the board.
  - Fizzle tags overlapped on the finale.
  - The finale verdict wrapped to three lines.
- **Changes** (all in `scenes/altar/`):
  - `circuit-model.ts` (pure, tested): the live-socket mask, the route preview and charge chips.
  - `circuit-overlay.ts`: one premultiplied material for veils and brass conduits.
  - Machines are larger (180–230 px). Need labels are larger and sit against the cabinet.
  - Charge chips show on the board, conduits light up by outcome, and multi-strike labels get per-strike pips.
  - Fizzle tags no longer overlap.
  - Verdicts are shorter (no ordinal), with a narrow mode for tight title gaps.
  - `teach.ts`: new-gem detection for first appearances, fixed-gem rule cards, a tray bob and FUSE nudges.
- **Merged main** (story-scenes):
  - On exact, the verdict now shows `exactLine(tier)`.
  - New gems use `gemNudge(gem)`. The placeholder line ids are gone.
  - `TEACH_NUDGE` comes from content.
- **For the PM to decide:**
  1. `PREVIEW_PATH` (on): the edit-time route preview and open-end glow show which way the bolt goes. This makes puzzles a little easier because of the direction hints, but no charge is shown.
  2. The veil is cosmetic only. Quiet sockets still accept gems.
  3. Channel has no `nudge.channel` line. Its first appearance gets the tray bob and tooltip only. Add a line if wanted.
- **Known issue:** on splitter-mill the storm's stand overlaps the roof of the west machine's cabinet (they are one row apart on the same side). This was already true before; the bigger cabinets make it more visible. The fix would be a layout offset for stacked props on one side. It is not done.
- `ParticleSystem.clear()` is not used yet: engine-cleanup has not landed on main.

