# Art direction: palette, light and materials

The shared visual reference for every art and scene workstream. The pitch sets the intent
("Alive, painterly, jewel-toned"; "Nothing is a flat line. Every surface has a material,
every light source has a colour"). This file turns it into numbers.

**Code is the source of truth for values:** `games/last-rune/art/materials/palette.ts`
(`PALETTE_HEX`, `LINEAR`, `gemColor(kind)`). If this table and the code disagree, the code
wins and this table is stale. Change both together.

## 1. Palette

Hex is sRGB (author with it). Linear is what shaders see (`hex()` / `LINEAR`). HDR
multipliers above 1 are for emissive use only.

### Gems (colour is the rune's identity)

| Gem | Name | Hex | Linear | Cut (silhouette) |
|---|---|---|---|---|
| Channel | cyan | `#3fe0ff` | 0.050, 0.745, 1.000 | long hexagon (step cut, long axis = flow) |
| Bend | amethyst | `#9b5cff` | 0.328, 0.107, 1.000 | square cushion |
| Split | magenta | `#ff3fb4` | 1.000, 0.050, 0.456 | trillion (triangle) |
| Amplify | amber | `#ffb03f` | 1.000, 0.434, 0.050 | round brilliant (12 facets) |
| Gate | emerald | `#2fe58a` | 0.028, 0.784, 0.254 | shield (pentagon) |
| Capacitor | ice | `#cfeaff` | 0.624, 0.823, 1.000 | flat hexagon, frosted |

Each gem has its own cut and its own inner glyph, so kinds stay readable without colour
(colour-blind players, dim states). Cyan and ice are told apart by value (ice is pale, near
white), cut and frost, not hue alone.

### Environment

| Name | Hex | Linear | Use |
|---|---|---|---|
| stone dark | `#1b1f28` | 0.011, 0.014, 0.021 | mortar, deep recesses, floor far from light |
| stone (slate) | `#3a4150` | 0.042, 0.053, 0.080 | wall and slab mid-tone |
| stone light | `#646d7e` | 0.127, 0.153, 0.209 | chipped edges, worn tops |
| moss | `#3f5a2c` | 0.050, 0.102, 0.025 | lower edges of blocks, slab corners, damp |
| ink (shadow) | `#0a0c13` | 0.003, 0.004, 0.007 | shadows: never pure black, always blue-ink |
| mist | `#8fa3c7` | 0.275, 0.366, 0.571 | floor mist (post fog colour is this × ~0.4) |

### Warm light, metal, paper

| Name | Hex | Linear | Use |
|---|---|---|---|
| candle | `#ffb35c` | 1.000, 0.451, 0.107 | candle/torch light colour, warm rims |
| flame core | `#fff1c9` | 1.000, 0.880, 0.584 | flame centre (emissive ×3–6) |
| flame base | `#4a7dff` | 0.068, 0.205, 1.000 | thin blue at the root of a flame |
| gold | `#e8b64a` | 0.807, 0.468, 0.068 | embossed lettering, plates, Play button |
| gold light | `#fff0b8` | 1.000, 0.871, 0.479 | emboss highlight / specular |
| gold deep | `#7a4c10` | 0.195, 0.072, 0.005 | emboss shadow side |
| amethyst shadow | `#3b1f66` | 0.044, 0.014, 0.133 | drop shadow under gold titles |
| parchment | `#e9d9b4` | 0.815, 0.694, 0.456 | journal pages |
| parchment dark | `#b89d68` | 0.479, 0.337, 0.138 | page edges, stains |
| wood | `#5a3820` | 0.102, 0.040, 0.014 | journal desk, tome boards |
| brass | `#c8963e` | 0.578, 0.305, 0.048 | storm-cell rings, tome corners, FUSE |
| iron | `#4a4d55` | 0.068, 0.074, 0.091 | machines, padlocks |

## 2. Lighting rules

1. **Two light families, always both present.** Warm (candle, torch, FUSE's eye, potions)
   and cool (gems, storm). A screen with only one family is wrong.
2. **Warm from the edges, cool from the centre.** Candles sit at the frame edges and low;
   gems and the storm sit in the middle. Where they overlap, stone picks up both: warm
   rims on one side of a chip, cyan on the other.
3. **Every light source has a colour.** No white lights. Ambient is a dim slate-blue
   (linear `0.06, 0.062, 0.085`), never grey. A wide, soft cool light from above the
   centre (`[0.5, 0.62, 0.95]`, intensity ~0.45) stands in for the storm through the roof.
   Pushing it harder turns the stone cartoon-blue.
4. **Shadows are ink, not black.** Darkest values sit around `#0a0c13`. The vignette and
   the floor take the scene down to ink, never to `#000`.
5. **Emissive is explicit.** Only flames, gem cores/glyphs, gold highlights, sparks and the
   bolt write to the emissive target (and so bloom). Stone never glows by itself; it only
   reflects lights.
6. **Gems glint warm.** A gem's body glows its own colour from inside, but the specular
   glints on its facets come from the nearest candles, so warm light lands on cool stones.
7. **Mist pools at the feet.** Floor mist sits in the bottom ~40% of the frame and is lit by
   whatever glows near it (post `fog.lightScatter`).
8. **Saturated on purpose.** Grade saturation 1.1–1.25. Gem colours are not toned down to
   match the stone; the stone is toned down to make room for them.

**Reference rig** (`?demo=art`, altar view): ambient as above, 4–6 candles at the frame
edges (intensity 1.6, radius 650–720), the cool roof light, then gems: energised first at
full strength, then the rest at 0.7, until the 16 slots are full. Pale gems (capacitor)
have their bloom normalised by luminance so they don't out-glow the saturated ones.

The game-side light set (`art/materials/lights.ts`, `LightSet`) carries up to 16 coloured
point lights per scene. Every lit material reads the same set: stone, sockets, gems (for
glints) and gold.

## 3. Materials (summary; API in `games/last-rune/art/materials/README.md`)

| Material | Look |
|---|---|
| Gem | Faceted crystal from above: flat table, crown facets, girdle rim. Inner glyph lit from inside, refracted through each facet with RGB dispersion; cloudy inclusions; warm glints from candles. States: idle, hover-lift, placed, energised, dim-locked. |
| Stone wall / floor | Rough-hewn blocks / flags: grain, chipped edges, tool marks, moss low on blocks. Normal-mapped and lit by the light set. |
| Altar slab | One carved slab with chipped bevelled edges, a carved border groove, worn centre. Round carved sockets (bowls): empty, blocked (rubble plug), highlighted (gold or gem-coloured ring). |
| Candle | Wax body lit by its own flame (warm translucency at the top, drips), brass dish, teardrop flame (blue root, white core, orange tip) with flicker and sway. Adds itself to the light set. |
| Gold emboss | Text or plates rendered to a mask, bevelled into metal: gold body, light-gold highlights, deep-gold shade, amethyst drop shadow, lit by the light set. |

## 4. Post presets per scene

Defined in `games/last-rune/art/materials/post-presets.ts` (`POST_PRESETS.<scene>`), applied
with `post.set(POST_PRESETS.altar)`. Summary of intent:

| Scene | Bloom | Fog (mist) | God rays | Vignette | Grade |
|---|---|---|---|---|---|
| title | strong (1.1), wide | thick, curls through the gem heap | soft, from above | heavy | sat 1.2, warm gain |
| hall | medium (0.9) | pools under everything, low | storm from the roof, cool | medium | sat 1.15, cool lift |
| altar (puzzle) | medium (0.9) | thin, at the feet only (keeps sockets readable) | faint | medium | sat 1.15 |
| codex | low (0.7) | off | off | heavy (frames the tome) | sat 1.05, dimmer exposure |
| journal | low (0.6), warm | off | off | heavy, warm-brown | warmest: warm gain, low sat |
| ending | very strong (1.4) | gold-lit mist | gold rays from the centre disc | light | warm gain, sat 1.25 |

## 5. Do and don't

- Do give every surface texture: grain, noise, a bevel, a chip. No flat fills.
- Do use the palette constants. Don't invent a new hex in a scene; add it here and to
  `palette.ts` first.
- Don't make stone emissive. Don't put pure white or pure black in the frame.
- Don't rotate gem quads to show orientation (it spins the lighting). Pass the rotation to
  the gem material; the glyph and cut rotate, the light stays put.
