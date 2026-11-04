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

### 2026-11-04: eight covers at /cover-image/

**Page.** `games/last-rune/cover/` (index.html, main.ts, stage.ts, covers.ts), built by its own
`vite.cover.config.ts` into `dist/cover-image/`. `pnpm build` now runs `vite build && vite build -c
vite.cover.config.ts`, so the game bundle is unchanged and Pages serves the page at `/cover-image/`.
`scripts/package-itch.mjs` skips `dist/cover-image/`, so the page stays out of the itch zip. The
desktop build still packages all of `dist/`, so it would carry about 370 kB of unused page.

**How a cover renders.** Each cover gets its own engine `SnapshotRenderer` at 1260×1000 (2× of
630×500), with the game's PostStack preset and a ParticleSystem. It draws one of the game's own
views or props in 1920×1080 design space. The camera is set after the view renders, to frame the
shot. On top goes the title screen's embossed gold name (EmbossLabel/EmbossRenderer) over a soft dark
halo. Each frame is downscaled into the 630×500 canvas, which is exactly what Download PNG saves,
and then redrawn into a 315×250 thumbnail. The covers animate round-robin, two per frame. The
taglines are drawn in 2D. There are no engine changes and no game scene changes. AltarView gets a
stub ctx (renderer, particles, desktop device, no chrome).

**The eight (one-line pitches):**
1. **title-wall**: The title wall: the gold name over the storm cell, FUSE and the candles (+ "A gem-circuit puzzle").
2. **altar-bolt**: Mid-solve: the bolt runs from the storm cell through lit gems to every gauge (Storm Cell II, intended solution, struck).
3. **fuse-storm**: FUSE squares up to the storm cell: a little robot, a caged bolt, cold blue light.
4. **restored-hall**: The hall restored: every door lit and the rune seal whole, in gold candlelight.
5. **last-altar**: The last altar: the biggest board, wired end to end and struck.
6. **one-gem**: One rune gem: an amber Amplify takes the bolt in and throws it out doubled.
7. **storm-chain**: The storm cell fires: the bolt runs a Channel, then two Bends, in storm blue.
8. **fuse-portrait**: FUSE by candlelight, eye on a glowing gem (+ "A gem-circuit puzzle").

**Iteration notes.**
- The game's struck altar blooms the gems to white at cover size. Gems keep their placed look
  under a dimmer bolt (0.35), and the gold route preview is on.
- Still-life gems are drawn 'placed', not 'energised', so the glyph reads.
- Cover 7's third gem was a Split with one output, which breaks the rules. It is now a Bend (N→E),
  and every turn matches its rotation.
- The hall's floor mist was thinned (fog 0.3) so the bottom title stays crisp.
- FUSE is sent off-stage on the last altar so he doesn't sit under the title.

**Ranking.**
- 1: fuse-portrait. The face sells it, it is warm gold and the title is huge.
- 2: one-gem. It has a single focal point and reads as "bolt through a gem" at a glance.
- 3: altar-bolt. It shows the actual puzzle best.
- The weakest is title-wall: the right half is empty at 630:500.

**Tests.** `tests/e2e/cover-image.spec.ts` checks three things:
- 8 covers paint.
- Each canvas is 630×500 with real picture.
- Download saves 630×500 PNGs (covers 1 and 8).

Screenshots are in `docs/design/screens/local/cover-art/` (git-ignored): per-cover full and thumb,
plus `sheet-full.png` and `sheet-thumb.png`.
