# Workstream: title-fuse (wave 5)

**Why:** user request, 2026-11-02: "make our cute robot on the home page wander around a bit and say random stuff just for immersion."

**Owns:** `games/last-rune/scenes/title/`, FUSE's movement on the title (`art/props` FUSE rig, used as is or with small generic additions), new title idle lines in `games/last-rune/content/lines.ts` (and `docs/design/script.md`, kept in sync; tests enforce the rules), and `tests/e2e` for the title.
**Don't touch:** the altar (onboarding-2 is working there), the hall, the ending, puzzle rules and data.

## Deliver
1. **Wandering:** on the title screen FUSE wanders a bit.
   - Short, unhurried walks between a few believable spots: pausing, looking at the gem or the candles, a little idle animation.
   - Never under the menu buttons or the release label.
   - Never distracting from Continue / New game.
   - Under reduced motion: little or no walking, with gentle idle only.
2. **Random chatter:** FUSE says random things for immersion.
   - A pool of ~15–25 short, dry, funny lines in FUSE's voice (see `docs/design/pitch-v0.3.md`, `script.md`).
   - Lines are lore-flavoured: the facility, Day 14,610, paperwork, Management, the storm.
   - No spoilers for the ending.
   - No Discord mention (Discord is ending-only).
   - Ambient pacing, every ~12–20 s, never repeating until the pool is spent. The existing `title-knock` beat keeps priority.
   - Captions stay clear of the menu (use `fuse.avoid`).
   - Mute and voice settings are honoured.
   - Lines stop the moment the player starts or continues.
   - Respect the tier rules in tests (e.g. Tier 1 lines have no "I", if the title counts as Tier 1; check `content` tests).
3. Fresh-eyes screenshots over ~60 s of idling at 1280×720 and 1920×1080, with a short list of the lines.

`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log

### 2026-11-02: wandering and chatter (done)
- **Wandering** (`art/props/fuse-stroll.ts`, pure, unit-tested; driven by `art/hall/title-view.ts`):
  three spots, all left of the menu (x 700 by the menu's edge, 560 at the storm cell, 390 by
  the left window and candles). He stands 7–13 s, glancing every 2.5–5 s between what is worth
  looking at from there (storm cell, the gold name, window, candle flames, or out at the
  player), then rolls to another spot at 1.4 units/s (~130 px/s, a stroll). He never crosses
  x 720, so he is never under Play / Continue, New game, Settings or the release label.
  He doesn't start a walk while talking, turns to the player when he talks, and stares at the
  storm cell for 6 s after the knock. Reduced motion: no walking, slower glances, the rig's
  usual idle (bob, blink, sway).
- **Rig addition** (`art/props/fuse.ts`): `maxSpeed` (units/s, default `DEFAULT_FUSE_SPEED` = 9,
  unchanged behaviour). The title sets 1.4 and hands the shared rig back at 9 in `dispose()`.
- **Chatter** (`scenes/title/chatter.ts`, unit-tested; `title-scene.ts`): 22 new Tier 1 lines
  (`kind: 'title'`, ids `title.1`–`title.22`, `titleLines()`), from a session-wide shuffle bag
  (no repeats until the pool is spent, no back-to-back across rounds). First line 8–11 s in,
  then one every 12–20 s start to start, never over another line and never within 4 s of one
  ending. The clock waits for the first-visit knock and stops while a panel (Settings, New-game
  confirm) is open. Before each line the scene measures the menu and release label and passes
  them to `fuse.avoid` (24 px padding). Play / Continue / Start over hush him at once; `exit()`
  hushes and clears the avoid. Voice and mute go through the usual caption voice.
- **Tests**: content tests (15–25 lines, Tier 1, new, ≤ 16 words, zero "I", no spoiler words);
  `script.md` lists every line under Tier 1 › Hall; Regulation 6 added to the regulations
  table. e2e `tests/e2e/title.spec.ts`: a title line appears, the card misses the menu, Play
  silences it.
- **Screens**: ~60 s idle at 1280×720 and 1920×1080 looked fine; the card sits bottom-right,
  FUSE potters bottom-left, nothing overlaps the menu.

**For the PM:** new line kind `title` in `content/lines.ts` (content, not `rules/types.ts`).
Regulation 6 ("candles are lighting, not decoration") is new canon.
