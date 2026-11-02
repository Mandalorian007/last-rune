# Workstream: codex-2 (wave 5, D-027)

## User feedback (verbatim, 2026-11-02)
> codex should use proper images, it should also unlock the entry when you see it not after you unlock it. We can show it's locked or not that is fine.

## Goal
1. **Real images.** Each Codex gem page shows the gem exactly as it looks on the altar: the same cut, colour and glyph from `shaders/gem-wgsl.ts`.
   - For Bend, Gate and Split, show a small diagram of the bolt going in and out, so the picture teaches the rule.
   - Same for machines, the storm and any other entries, if the Codex has them.
   - Options: render gem thumbnails with the real WebGPU gem pipeline into an offscreen target and blit to the DOM (canvas or ImageBitmap). This must stay procedural, with no asset files (CLAUDE.md).
   - Keep engine code free of game nouns: a generic "render to thumbnail" helper may go in `engine/`.
2. **Unlock on sight.**
   - A Codex entry appears the first time the player *sees* that gem: at an altar, as a fixed gem or in the tray. Not when the gem is granted or the machine is solved.
   - Mark each entry as either "Seen" (met at an altar, not yours yet) or "Yours" (in your tray). That shows locked vs unlocked clearly.
   - Persist seen gems in the save (`localStorage` only), as an additive optional field with a save migration if needed. Propose the save change to the PM in your log. Check `codexPages(progressOf(save), …)` and every caller (the altar uses it for card rules).
3. Keyboard, gamepad and screen reader still work. Panels scroll at 1280×720 with 150% text.

## Done means
- `pnpm check`, `pnpm build` and `pnpm test:e2e` all green, plus an e2e test that a gem seen at an altar appears in the Codex before it's granted.
- Fresh-eyes screenshots of the Codex early (after intake-desk) and late (after foundry) at 1920 and at 1280 with 150% text, in your scratchpad.
