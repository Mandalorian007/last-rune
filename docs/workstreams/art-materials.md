# Workstream: art-materials (wave 2 early start)

**Owns:** `games/last-rune/art/materials/`, `games/last-rune/shaders/` (gem, stone, candle), `games/last-rune/scenes/_demo/art-demo.ts`, `docs/design/art-direction.md`.
**Depends on:** merged engine render API (`engine/render/README.md`, `engine/post/README.md`, template `scenes/_demo/render-demo.ts`).

## Goal
Hit the pitch's look ("Alive, painterly, jewel-toned", pitch Art direction + §5 Screens) with **procedural** materials only (D-001). This is the visual identity of the game.

## Deliver
1. `docs/design/art-direction.md`: the palette as exact hex/linear values (cyan Channel, amethyst Bend, magenta Split, amber Amplify, emerald Gate, ice Capacitor, slate stone, ink shadow, warm candle, gold emboss, parchment, mist), lighting rules (warm from the edges, cool from the centre), post-stack presets per scene (title, hall, altar, codex, journal, ending).
2. **Gem material** (WGSL): a faceted crystal look (fake facets via SDF/normal mapping, internal refraction/dispersion, specular glints, inner glyph lit from inside), one glyph per gem kind (Channel, Bend, Split, Amplify, Gate, Capacitor), params: colour, glow intensity, state (idle / hover-lift / placed / energised / dim-locked), rotation. Emissive into bloom.
3. **Stone**: generated textures/material for rough-hewn walls and floor (grain, chips, tool marks, moss), and the **carved altar slab** with round carved sockets (empty, blocked, highlighted states). Normal-ish shading reacting to 2D lights.
4. **Lighting helper** for the game: a 2D point-light set (candles warm, gems cool) that materials sample. Candle flame sprite with flicker.
5. Gold embossed text/plates material (for titles and badges).
6. `?demo=art` (dev only): altar slab with sockets, all 6 gems in all states, candles, stone wall, mist, bloom. Verify with Playwright screenshots (headless Chromium + `--enable-unsafe-webgpu` works on this Mac per engine-render's log) and iterate on looks until it reads as painterly and jewel-toned, not flat.

## Quality bar
60 fps with 80 gems + altar + lights on an integrated GPU. No per-frame allocations. Materials take parameters, so scenes don't need shader edits.

## Log
