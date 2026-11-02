# Workstream: onboarding-2 (wave 5)

**Why:** this follows first-altar (merged 5dd7d18), under D-027 (intuitiveness matters). The intake desk now teaches well. Carry the same clarity to every altar, and fix what the PM saw in the fresh-eyes screenshots.

**Owns:** `games/last-rune/scenes/altar/`, the altar parts of `ui/`, the altar FUSE line triggers (when lines fire; any wording change must keep `script.md` and `pitch-v0.3.md` in sync), `scripts/playtest/first-altar.spec.ts` and `glyphs.spec.ts`, and `tests/e2e/` for what you change.
**Don't touch:** puzzle rules or data, the hall, perf and post, the ending.

## Deliver
1. **"Gives N" storm card on every altar,** opposite each "Needs N". It must not collide with other labels, the tray, the caption or the buttons on any of the 16 altars, at 1280×720 and 1920×1080 and at 100% and 150% text. That covers storms on any side and boards with several machines.
2. **The Strike-ready pulse on every altar:** Strike glows or pulses only when every machine's route reaches it, and stays steady under reduced motion. Keep it honest: "reaches" doesn't mean "exact".
3. **New-gem line timing:** on intake-desk, "New gem in the tray. It has opinions about straight lines." fires after the player has already placed three Channels. New-gem introductions must fire when the gem is first seen, before it's used, or be skipped if the player has already used it. Audit this on every altar.
4. **Tray and board orientation:** the Channel in the tray is vertical while placed Channels lie along the flow. Make the tray and the held gem agree with how the gem will sit, or make the difference read as intentional.
5. **Each new gem's first altar** (Split, Amplify, Gate, Capacitor and the first rotatable Bend) has to make the gem's effect visible before the first strike, the way the Bend stubs do: the live route, charge labels on the preview, and so on. Screenshot each, fresh-eyes.
6. Promote `scripts/playtest/glyphs.spec.ts`, or a light version of it, into `pnpm test:e2e` as a glyph-vs-rules guard if it runs fast and stable. Otherwise explain why not.

`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass, including `full-run`, `a11y` and `altar`. Report with fresh-eyes screenshot sequences.

## Log
