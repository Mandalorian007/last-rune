# Workstream: story-scenes (wave 3)

**Goal:** the story lands. The Builder's journal is a place you *want* to visit, and the ending is the emotional payoff the pitch promises: FUSE's arc, the reveal, the Discord door.

**Owns:** `games/last-rune/scenes/journal/`, `games/last-rune/scenes/ending/`, `games/last-rune/content/codex.ts` (new: gem rule and maths text, moved out of `ui/codex-data.ts`), the `SceneFactories` additions `journal()` and `ending()` and the flow hook for the ending (`game/flow.ts` `finishSolve` when `complete`), `docs/design/ending.md`.
**Don't touch:** `scenes/altar/`, `scenes/solve/` (altar-scene), `scenes/hall/` + `art/hall` + `art/title` + `art/props/palette.ts` (hall-art), `audio/` (use `ctx.sound`), puzzle content (difficulty-fun). In `main.ts` only add the new scene factory entries.

## Deliver
1. **Journal desk scene:** reachable from the hall (a HUD button and key J; coordinate the hall entry point as a small, additive hook. Keep hall-scene edits minimal and tell the PM). A candlelit desk with parchment pages (procedural parchment, ink, the Builder's hand); found pages readable in order, unfound pages as blank slots with a hint of which tier they belong to. New pages are highlighted. Mood `journal`. Pages come from `content/journal.ts` (verbatim, never rewrite story text).
2. **Ending sequence:** follows the solve moment of the final machine. Beats come from `content/lines.ts` / `content/ending.ts` and the pitch (follow the pitch's ending section exactly: FUSE's lines, the clipboard drop, the reveal, safety record via `safetyRecordLine()`, credits). Then the end card with `endingButtons()`: the Discord door opens `DISCORD_INVITE_URL` in a new tab (`rel="noopener noreferrer"`, user click only), the tip jar is hidden while `TIP_JAR_URL` is blank, "Back to the hall" keeps the save (post-game state). Mood `ending`, `endingSwell`, `clipboardDrop` sounds. Skippable after first viewing; reduced-motion aware.
3. **Codex content:** create `content/codex.ts` as the single source for codex text (gem rules, charge maths) consistent with `docs/design/rules.md` (1 bolt = 4 sparks? present it the way the player sees it). The codex UI reads from it. Tests: every GemKind has an entry; text ≤ the card limits.
4. **Tests:** unit tests for journal ordering/visibility and ending button logic; a Playwright e2e that seeds a nearly-complete save, triggers completion via the dev handle, runs the ending through to the end card, and asserts the Discord button href and that nothing navigates without a click.
5. Screenshots `docs/design/screens/journal-*.png`, `ending-*.png` (each under ~400 KB). Iterate critically.

## Log
