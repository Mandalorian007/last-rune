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

### 2026-11-02: delivered (branch `worktree-agent-a1609adc0f245346a`)

**1. Text size 100 / 125 / 150%.** Settings → Comfort → "Text size". Stored as an optional
`textScale` in settings and save (missing or bad values mean 100%; old saves load). `ui/text-scale.ts`
sets `--lr-text-scale` and `data-text-scale` on the overlay root and rewrites `font-size` in the
game stylesheets (HUD, panels, codex, journal, altar, end card; captions through the engine theme).
Small text grows fully, display text over 30px grows by the same number of pixels, so titles don't
balloon. Layout fixes at >100%: altar title and verdict sit in the band between the HUD and the
action buttons (`fitTop`), "Needs" chips step below the action row if they would touch it, compact
action buttons, narrower solve column, codex page reflows, wider end-card safety line, settings
save box grows. Audit (`scripts/playtest/polish.spec.ts`, `PT_ALL=1` for all 16 altars) at
1280×720, 1600×900 and 1920×1080 × 100/125/150: no clipped or overlapping text. The only notes
are the settings and codex panels scrolling, which they already did at 100%.

**2. Caption vs key-hint line.** The altar hint line has its own lane above the floor, and the
altar passes the hint, tray, need chips, actions and HUD to the caption's `avoid()`, so FUSE moves or
narrows instead of covering them. At >100% the bottom caption lifts 50px. The hint is now shorter
and has three modes (mouse / keys / strike). Checked with and without a caption at 1280, 1600 and 1920.

**3. Keyboard cost.** Arrows slide over carved stone instead of stopping on it. New **G** key (pad
R3) jumps the cursor to the wire's open end and cycles through open ends. The keys hint reads
"1–6 take · Arrows move · G wire's end · Enter place / pick up · R turn". Full-run (keyboard only,
all 16 altars, hall walking included):

| | All 16 | Archive |
|---|---|---|
| Before (brief baseline) | 808 | 109 |
| After (`full-run`, this branch) | 564 | 55 |

The full-run harness now plans each placement with `tests/e2e/altar-keys.ts` (fewest presses, and
places gems in the order the wire reaches them, like a player would). On the old intended order
the model gives about 714 / 83, so the new keys alone save about 12% (24% on archive). Placing
along the wire gives the rest.

Screens: `docs/design/screens/polish-1-*.png` (before/after archive caption at 1280, after at 1600,
150% at 1280 and 1920, settings, codex, journal, solve and end card at 150%).

`pnpm check`, `pnpm build` and `pnpm test:e2e` (18/18 including full-run and a11y) pass.
