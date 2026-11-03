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

## Log (2026-11-02, codex-2 agent)

### Done
- **Real gem pictures.**
  - `art/gem-portraits.ts` bakes all six gems once, on first Codex open. It uses the real altar gem material (`GemRenderer`, state `placed`, rot 0) with the altar's bloom and grade, on dark stone, lit by a candle and the gem's own light.
  - The bake is one offscreen frame on the game's GPU device. Each page copies its cell into a 2D canvas.
  - If there is no GPU, a CSS gem stands in.
- **Bolt diagrams on every gem page** (`ui/codex-diagram.ts`, pure data).
  - SVG arrows show where a bolt of 4 goes in and comes out, with the altar's own charge chips (4 / 2 + 2 / 8 / "0, then 8") and red ✕ marks on the sides that fizzle.
  - The plate is `role="img"` with an `aria-label` that describes the picture.
  - `codex-diagram.test.ts` checks every side against the simulator's `acceptMask`.
- **Unlock on sight.**
  - `GameFlow.openPuzzle` records every gem at the altar, fixed or in the tray, in `codex.met`. This needs no altar-scene change.
  - `codexPages(state, opened, met)` now returns `status: 'unknown' | 'seen' | 'yours'`.
  - Pages show a chip: **Yours** (filled), **Seen** (dashed) or **Not met yet**, plus one line: "In your tray. Earned at the X." / "Seen at an altar. Restore the X to earn it." / "Opens when you first see this gem at an altar."
  - Nav tabs: a filled dot means yours, a ring means seen, and "?" means not met. Screen-reader names say the status.
  - The altar's caller, `codexPages(progressOf(save), [])`, is unchanged (it only reads `.rule`).
- **150% text at 1280×720.** The plate keeps its size, and FUSE's note takes the rest of the row so every page fits. Pages still scroll if a longer text ever overflows.
- **Tests.**
  - Unit tests: codex-data, codex-diagram, save `met`, and flow sightings.
  - e2e `tests/e2e/codex.spec.ts`: Amplify is "?" before, then after opening the Furnace altar (unsolved) its page is readable and marked Seen, with the real picture. axe runs on the book.
  - Playtest screenshots: `scripts/playtest/codex-2.spec.ts`.

### Proposed save change (PM)
- `codex.met?: GemKind[]` is a new **optional** field (max 16 entries). It lists the gems the player has met at an altar. `SAVE_VERSION` stays 1, so there is no migration entry.
- **Backfill for old saves:** `repairSave` runs at load and import. If `met` is missing, it is filled from every altar already solved or started (`progress.solved` ∪ `puzzles` keys), so returning players don't lose pages.
- A new game resets `met` to `[]`.
- `codex.seen` keeps its meaning: pages opened, which drives the NEW ribbon.

### Decisions for the PM
1. **New engine API:** `SnapshotRenderer` (`engine/render/snapshot.ts`). It is a second `Renderer` on the same device that draws to an `OffscreenCanvas` and returns an `ImageBitmap`. It is generic and has no game nouns.
2. **`installGpuErrorLogging` is now idempotent per device**, so a second renderer does not double-log.
3. **Pages for gems not met yet still hide the gem's name** ("— — —"). The tab shows "?".
4. **The diagrams count charge in sparks (4 = 1 bolt)**, as the altar chips do.
