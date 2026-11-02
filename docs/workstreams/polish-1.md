# Workstream: polish-1 (wave 5)

**Goal:** clear three known polish items that don't wait on player data.

**Owns:** `games/last-rune/ui/` (settings panel, styles), `games/last-rune/game/settings.ts` and `save.ts` (an optional `textScale` field only; missing means 100%), `games/last-rune/scenes/altar/` (input and layout), `tests/e2e/` for what you change.
**Don't touch:** puzzle rules and data, story copy, `engine/render`, `engine/post`, art.

## Deliver
1. **Text size setting** (a11y S2, finding 14): "Text size: 100 / 125 / 150%" in Settings, saved in `localStorage` through settings. It scales all DOM overlay text: HUD, captions, panels, codex, journal, altar labels and verdicts, and the end card. Nothing may clip or overlap at 150% at 1280×720 or at 1920×1080. Check the caption's `avoid` layout still works.
2. **Caption vs altar key-hint line:** FUSE's caption covers the tail of the altar key-hint line. Fix the layout so both are fully readable at 1280×720, 1600×900 and 1920×1080, with and without a caption.
3. **Altar keyboard cost on big boards:** archive takes ~109 presses by keyboard (808 across all 16 by the full-run count). Cut it substantially without making the keys harder to learn. Options:
   - a jump-to-next-open-socket key (Tab or Shift+arrows);
   - smarter cursor placement after a pick;
   - other.
   Pick one, keep the key-hint line short, and report the new counts from `scripts/playtest/`.

Screenshots before and after for each item. `pnpm check`, `pnpm build` and `pnpm test:e2e` must pass, including `full-run.spec` and `a11y.spec`.

## Log
