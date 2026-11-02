# Workstream: caption-layout (wave 4, pre-alpha)

**Goal:** FUSE's caption card never hides anything the player needs, and never cuts its own text, at any size from 960×540 up to 1920×1080. The HUD hints read correctly.

**Owns:** `games/last-rune/ui/fuse.ts`, `games/last-rune/ui/styles.ts`, `games/last-rune/ui/settings-panel.ts`, `games/last-rune/scenes/views.ts` (caption parts only), the solve card's caption placement, `engine/ui/` caption card (generic changes only, with no game nouns). In `games/last-rune/ui/hud.ts`, only the key-hint labels: engine-adoption is also editing hud.ts for input, so keep your hunk small.
**Don't touch:** `scenes/altar/` (altar-polish owns the altar caption overlap), `scenes/hall/` and `art/`, `content/`, `engine/` outside `engine/ui/`.

## Deliver
Fix these findings from `docs/design/playtest-report.md` (screenshots in `docs/design/screens/playtest/`):
1. **S2: text cut mid-word.** At 960×540 the caption cuts "...runs hot en" on the archive solve card. Long lines must wrap or paginate, and never clip. Test the longest lines in `content/lines.ts`.
2. **S2: hall.** The caption covers the right-hand alcoves. Give the caption a home that doesn't hide machines, for example docked low beside FUSE's portrait, with a size that adapts.
3. **S2: settings.** The settings dialog opens with the caption on top of it. Modal panels must sit above the caption, or the caption hides while a panel is open.
4. **S3: key hint.** The Settings hint "O" reads as "0" in the HUD font. Make keycaps unambiguous (for example a keycap style, or a font where O ≠ 0).
5. **Contract for scenes.** Give scenes a small, clear way to keep the caption out of a screen region (for example `fuse.avoid(rect | null)` or a dock option). Document it in your log so altar-polish can adopt it in a follow-up. Don't wire it into the altar yourself.

Before/after screenshots at 960×540 and 1280×720: hall first entry, hall with caption, settings open, archive solve card. `scripts/playtest/` can help. Keep reduced motion and a11y behaviour (live region, caption speed setting).
`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log

### 2026-11-02: caption layout pass

Captures: `scripts/playtest/caption.spec.ts` (hall first entry, a line with a right-hand alcove
focused, the longest card, settings open and closed, both archive solve cards, at 960×540 and
1280×720). It records each card's box, whether its text is clipped, whether it paints over a
dialog, and the tallest box any card in `content/lines.ts` can make. Before/after pairs at
960×540 are in `docs/design/screens/caption-layout/`.

```
PLAYTEST_OUT=<dir> E2E_SKIP_BUILD=1 pnpm exec playwright test -c scripts/playtest/playwright.config.ts caption
```

Findings:

1. **Archive text "cut mid-word" (S2): not a clip.** The playtest shot was taken mid-typewriter.
   The fully revealed card reads to the end at both sizes, and the card had no max height then
   either. To make sure it can't happen now: the card has no max height, long words wrap
   (`overflow-wrap: break-word`), and the spec checks `clipped` on every shot (all false). Longest
   card is 127 chars. At the new width the tallest card in the game is 3 lines (158 design px).
2. **Hall caption over the right alcoves (S2): fixed.** The card was 720 wide with the name above
   the text, so long lines ran 4 lines and reached y≈798, over FUSE and up to the alcove plaques.
   Now (game styles): max width 800, margin 24, tighter padding, and the speaker name sits under
   the portrait. Every card is at most 3 lines: top ≥ 898, left ≥ 1096. That keeps it below FUSE's
   wheel line (866) and the bottom alcove row (plaques ≈760), and right of the intake desk arch
   (x ≤ 1050). No hall code changed.
3. **Settings opens under the caption (S2): fixed.** Overlay layers are now `hud`, `captions`,
   `panels`, `toasts`, and the overlay suspends the caption while any modal is open: it is hidden,
   its typing and hold timers freeze, and it resumes the same line afterwards. The live region is
   untouched, and `say()` still queues while suspended.
4. **"Settings O" reads as "0" (S3): fixed.** HUD key hints are keycaps in the UI sans (with
   `slashed-zero` as a guard), bordered and raised. CSS only, in `ui/styles.ts`. `hud.ts` is unchanged.
5. **Avoid API for scenes: added** (engine `CaptionCard.avoid`, game `fuse.avoid`). Not wired
   into the altar.

#### Contract for scenes (altar-polish): `fuse.avoid(rects | null)`

Rects are in 1920×1080 design px, the same space as the overlay. The card stays bottom-right if it
clears every rect. If not, it narrows in ~15% steps down to 480px, then tries bottom-left, then
top-right, then top-left. It takes the first spot that touches nothing, or else the one that
covers least. Text never clips. The setting applies to the line on screen at once and to every
later line. It outlives the scene, so set it on enter/resume and clear it on exit/pause.

```ts
// scenes/altar: keep FUSE off the tray (and the board, if it reaches the bottom right).
enter() {
  const t = layout.trayRect();            // { x, y, width, height } in design px
  ctx.fuse.avoid([{ x: t.x - 16, y: t.y - 16, width: t.width + 32, height: t.height + 32 }]);
}
exit() {
  ctx.fuse.avoid(null);
}
```

A trade-off altar-polish should know: the card is now wider (800, left edge ≥ 1096 vs ≈1160
before) and docks lower (top ≥ 898). On 6-gem trays (slots at x≈404–1196, y≈926–1018) slot 6 was
already covered before this change, and the wider card covers more of it. Slot 5 (x ≤ 1056) stays
clear. Passing the tray rect fixes it: the card narrows or moves to the top-right.
(`layout.trayRect()` in the example stands for whatever rect the altar layout already has.)

#### For the PM

- `game/ctx.ts` has a stale comment saying the caption card sits above panels. It's not my file.
- Suggestion: clear avoid regions on every scene change (`flow.onChange → fuse.avoid(null)` in
  ctx.ts), so a scene that forgets to clear them can't leave them stuck.
- The hall's Esc → `ctx.openSettings()` path doesn't call `fuse.hush()` the way the codex and
  settings buttons do. That's fine now that modals suspend the card, and the line resumes after.
