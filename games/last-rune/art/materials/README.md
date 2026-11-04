# Materials (art-materials)

Procedural materials for The Last Rune. Look and rules: `docs/design/art-direction.md`.
Live showcase (dev only): `?demo=art` (views: `&view=altar|sheet|stress|title`, keys 1–4, H hud).

All lit materials read one **LightSet** (16 point lights, uploaded per material per frame).
Every draw helper reuses its own `DrawParams`. Keep your instance objects around and mutate
them, so nothing allocates per frame. Draw order = submission order, and same-material draws
batch, so call the helpers in this order each frame:

```ts
lights.begin();                        // ambient + floor darkening
candles.addLights(lights, candleList); // warm first: they matter most
for (const g of gems) if (g.state === 'energised') addGemLight(lights, g);
wall.light(lights); floor.light(lights); altar.light(lights);
candles.light(lights); gemR.light(lights); emboss.light(lights);

wall.draw(frame, 960, 540);
floor.draw(frame, 960, 930, 1920, 300);
altar.draw(frame);                     // then all socket overlays
altar.drawSocket(frame, c, r, 'highlighted', GOLD, pulse);
candles.drawBodies(frame, candleList);
gemR.drawUnder(frame, gems);           // shadows + coloured pools (2 batches)
gemR.drawGems(frame, gems);            // 1 batch for any number of gems
candles.drawFlames(frame, candleList); // halos + flames (2 batches)
emboss.draw(frame, label, x, y);
```

## `lights.ts`: `LightSet`
- `begin(ambR?, ambG?, ambB?, floorDark?, floorStart?)`: reset. Ambient is linear rgb.
  `floorDark` darkens the frame below `floorStart` (0..1 of the height).
- `add(x, y, radius, color, intensity, height = 55)` → `false` when full (16).
- `addCandle(x, y, intensity?, radius?)`.
- `apply(material)`: upload to one material (needs `uniformBytes: LIGHT_SET_FLOATS * 4`).
- `LIGHT_HEIGHT = { candle: 140, gem: 55, storm: 400 }`. Height sets how grazing the light is.
- WGSL side: `shaders/lights-wgsl.ts` → `lights_shade(world, h, n, shininess)`,
  `lights_floor(world)`. To light a new material, include `LIGHTS_WGSL`. It owns `@group(1) @binding(0)`.

## `gems.ts`: `GemRenderer`, `GemInstance`, `addGemLight`
`GemInstance { kind, x, y, size, state, rot?, glow?, lift?, seed? }`
- `state`: `'idle' | 'hover' | 'placed' | 'energised' | 'dim' | 'spent'` (`spent`: a tray gem with none left, a dimmed copy of itself).
- `rot`: quarter turns clockwise (fractional animates). 0 = output north. The glyph rotates and
  the lighting stays fixed.
- `lift` 0..1 lifts by `GEM_LIFT_PX` (16), grows 7% and spreads the shadow (animate on hover).
- `glow` multiplies the state's emissive (pulses, win flash).
- `drawUnder(frame, list)`, `drawGems(frame, list)`, `draw(frame, g)` (single, unbatched).
- `addGemLight(lights, g, intensity?)` adds the gem's coloured light to the stone and to neighbouring facets.
- Cuts: channel long hexagon, bend cushion square, split wide hexagon (points on its two outs), amplify round 12, gate
  shield pentagon, capacitor frosted squat bar across its run (glyph-truth-4). Glyph flow enters at the bottom and leaves at the top.

## `stone.ts`: walls, floor, altar
- `createStoneWall(renderer, { width?, height?, seed? })` and `createStoneFloor(...)` return a
  `StoneSurface`, baked once on the GPU (albedo + normal/height/AO).
  `draw(frame, x, y, w?, h?, tint?, normalStrength = 1, specular = 0.08)`.
- `new AltarSlab(renderer, { cols, rows, pitch = 118, margin?, seed? })`:
  `place(x, y)` (centre of the top face), `socketCenter(col, row, out)`, `draw(frame, tint?)`,
  `drawSocket(frame, col, row, state, color, intensity = 1)` with
  `SocketState = 'empty' | 'blocked' | 'highlighted' | 'wanted'` (empty draws nothing; the bowl
  is baked). Read-only geometry: `width`, `topHeight`, `frontHeight`, `socketRadius`, `pitch`.
  Re-create the slab when the grid size changes (one bake, a few ms).

## `candles.ts`: `CandleRenderer`, `CandleInstance`
`CandleInstance { x, y (base), height, width?, seed?, melt?, radius?, flicker? }`
- `update(list, time)` sets `flicker` from `candleBreath` (a slow warm swell plus a small smooth
  flutter, ≈0.7..1, no pops). `reducedMotion = true` (scenes also set it for Reduce flashes) holds
  a steady level with a very slow swell.
- `CANDLE_LIGHT` holds the brightness knobs (light, radius, halo, wax, flame bloom). Candles are
  mood, never focus: keep them below every selectable highlight (D-027).
- `addLights`, `light`, `drawBodies`, `drawFlames`, `flamePos(c, out)`.

## `emboss.ts`: gold embossed text and plates
- `new EmbossLabel(renderer, { text, font, width, height, plate?, radius?, tracking?, scale? })`:
  bakes a mask on a canvas (once). `setText()` re-bakes, so don't call it every frame.
- `new EmbossRenderer()`: `light(lights)`, then
  `draw(frame, label, x, y, { color?, alpha?, shine?, glow?, scale? })`.
- Each label is its own material, so labels don't batch. Fine for the handful on a screen.
- Text that must be readable by assistive tech stays in the DOM (D-009). Use this for hero
  lettering and mirror it with an accessible DOM label.

## Other
- `palette.ts`: `PALETTE_HEX`, `LINEAR`, `gemColor(kind)`, `GEM_INDEX`.
- `post-presets.ts`: `POST_PRESETS.{title,hall,altar,codex,journal,ending}`, applied with `post.set(...)`.
- `shaders/candle-wgsl.ts` also exports `GLOW_WGSL` (additive radial; `params.y = 1` lights
  the colour target only, without bloom) and `SHADOW_WGSL` (soft ellipse). Reuse them for pools and contact shadows.

## Cost (Apple M-series, headless Chrome, 1920×1080)
`?demo=art&view=stress`: 80 gems + 10×8 altar + 4 candles + wall + floor + 16 lights + full
post stack = 9 draw calls, 255 instances, steady 60 fps. Gem fragment cost is the main term
(16-light loop + 3 glyph samples per pixel). If an integrated GPU struggles, lower the light count
first (`begin` + fewer `addGemLight`), since each light is a loop iteration in every lit pixel.
