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

**2026-11-02, onboarding-2 agent.** All six items plus the two PM playtest items (D-027).

- **PM-1, gem helper cards.** The rule cards pinned over new fixed gems (`.lr-altar-teach`) are gone. There is one gem info card (`updateInfo` in `altar-scene.ts`), always over the tray band, never over sockets. It shows for a hovered or held tray gem, for a board gem under the pointer or keyboard cursor, and on arrival for this altar's new gems (7 s, cut to a 0.5 s fade by the first placement; no fade under reduced motion). The briefing and keyboard focus read the same text through the announcer; taking a gem announces its rule.
- **PM-2, fixed vs turning.** Fixed and hint-locked gems wear iron corner brackets with a hex bolt head (DOM, procedural CSS) and a cold iron ring instead of gold. Their card is tagged "Fixed in place". On the altar that first puts a Bend (furnace) or Gate (foundry) in the tray, the held gem wears a turn arrow with "R / Scroll" until the first turn, and its card is tagged "Turns: R or scroll". Held over a socket it fits, the gem is tried in the route preview, so the preview swings as it turns (linking and Strike-ready ignore it). `teach.ts` gained `NewGems.turns`.
- **1.** "Gives N" on every altar, kept clear of the buttons like the needs. New playtest `scripts/playtest/altars.spec.ts` screenshots and audits all 16 altars at 1280/1920 × 100/150%: zero overlaps. New e2e guard `tests/e2e/altar-labels.spec.ts` (all 16 at 1280×720, 150%, about 30 s) using `tests/e2e/altar-audit.ts`.
- **2.** Strike-ready on every altar when the route reaches every machine over all strikes (so a Capacitor altar counts its release). Still not "exact".
- **3.** Nudges no longer fire on pickup. They queue on arrival and play one at a time when FUSE is free, skipped if the gem is already in use (route reaches the new fixed gem, or the tray gem is on the board). The five nudges now say "on the altar", not "in the tray" (same word counts; `script.md` synced; `pitch-v0.3.md` has no nudges).
- **4.** Tray gems rest as they will sit: Channel, Split, Amplify and Capacitor face the storm; Bend and Gate show rot 0, as they are held.
- **5.** Until the first strike, the route preview carries dashed charge chips into and out of each new gem it reaches (furnace reads `4 → Amplify → 8`). Fresh-eyes sequences: `scripts/playtest/new-gems.spec.ts` (intake-desk, furnace, conveyor-a, relay-tower, foundry, capacitor-bay).
- **6.** Not promoted. `glyphs.spec.ts` places gems and writes screenshots and crop boxes for a human to compare against `rules.md`; it asserts nothing about glyph shape, and a pixel check of bloomed GPU output would be flaky across Metal and SwiftShader. The cheap, stable guard is the label audit above, which is promoted.
