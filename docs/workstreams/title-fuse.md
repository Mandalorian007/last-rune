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
