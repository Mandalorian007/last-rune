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

### 2026-11-02 (art-materials agent)
- **Done:** palette + post presets + art-direction doc (committed first, shared with art-props);
  LightSet (16 lights, WGSL `lights_shade`); gem material (6 cuts/glyphs × 5 states, refraction
  with dispersion, flow pulse when energised, engraved glyph when dim); baked stone wall/floor
  and carved altar slab with socket overlays (blocked/highlighted/wanted); candle body, flame,
  halo; gold emboss labels/plates; `?demo=art` (altar, sheet, stress, title views).
  API: `games/last-rune/art/materials/README.md`. Screens: `docs/design/screens/art-*.png`.
- **Iteration passes (screenshots):** (1) everything too dark, energised gems bloomed white,
  neon socket rings → raised ambient + roof light, cut gem emissive, thinned rings. (2) cool roof
  light made stone cartoon-blue, moss read as mould, floor plaid, candles flat → neutral slate,
  sparser darker moss, larger flags with isotropic grain, cylinder shading on wax. (3) altar
  front face unlit (normal pointed away from the lights) → tilted toward viewer; coloured
  specular turned dim gems rainbow → spec desaturated and cut on dim; pale gems out-bloomed
  others → luminance-normalised emissive; candle halos too big → smaller.
- **Perf:** stress view (80 gems, 10×8 altar, 16 lights, full post) = 9 draws, 60 fps steady
  on Apple M-series (headless Chrome). Not measured on an integrated PC GPU. If it's short,
  cut lights first.
- **Decisions:** stone is baked once (GPU `textureFromShader`) and lit per frame; sockets are
  baked into the slab, so states are overlays; gem rotation is a shader param (lighting stays
  world-fixed); light set uploaded per lit material (see engine gaps).
- **Engine gaps (worked around game-side, engine untouched):** (a) no shared uniform buffer /
  bind group across materials, so the 544-byte light block is written to each lit material each frame;
  (b) `textureFromSource` is always `rgba8unorm-srgb`, so the emboss mask uses `createTexture`
  + `device.queue.writeTexture` for linear data; (c) no per-draw layer/depth, so callers must
  submit in order.
- **Open:** gem facets could use more depth (darker pavilion) at large sizes; the energised
  capacitor is still the brightest thing on screen; integrated-GPU perf to verify; emboss labels
  don't batch (one material each).
