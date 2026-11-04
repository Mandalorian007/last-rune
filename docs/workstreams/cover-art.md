# Workstream: cover-art (8 itch cover candidates from the game itself)

Source: D-043. The user reviews 8 cover images at `https://mandalorian007.github.io/last-rune/cover-image/` and picks one for itch.io.

## Do
1. **A `/cover-image/` page in the Pages build** (a second Vite entry or equivalent; check `vite.config.ts`, base is `./`, Pages deploys `dist`). It renders 8 covers live with the game's own engine, art, palette and type: procedural scenes, no imported images, no outside image generator, no network calls.
2. **Each cover at 630×500** (itch's cover size), with a "Download PNG" button (canvas → PNG) and a 315×250 thumbnail beside it so the user can judge it at browse size. Label each with a one-line idea ("FUSE at the altar, bolt lit", ...).
3. **Market sense.** These must sell on the itch browse grid: title "The Last Rune" readable at thumbnail size, one strong focal point, high contrast against itch's dark UI, genre clear at a glance (a circuit/rune puzzle with a bolt), warmth from the gold and candle light. Vary the 8 meaningfully: focal subject (FUSE, the altar board mid-solve with a lit bolt, the storm cell, the restored hall, a single glowing rune gem), framing (close/wide), title placement, light (storm blue vs gold). No text beyond the title and at most a 3-word tagline on some.
4. Keep it out of the game bundle's boot path (don't slow the game), and don't touch game scenes beyond reusing their exports; if you need a hook in engine or game code, keep it small and say why.
5. Use only engine/game code already in the repo. If you need a reference look, take it from `docs/design/screens/v1.0/`.

## Done when
- `pnpm build` produces the page; `pnpm preview` (or the itch-sim) shows all 8 rendering and downloading in Chromium. Screenshot the page and each cover yourself, at full size and at thumbnail size, and judge them as a buyer would; iterate until each one would make you click.
- A small e2e smoke test: the page loads, 8 canvases render non-blank, downloads produce 630×500 PNGs.
- `pnpm check`, `pnpm build` green. Commit to `ws/cover-art`, never merge. Log here, including a one-line pitch per cover.

## Log
