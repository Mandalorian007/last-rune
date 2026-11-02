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
