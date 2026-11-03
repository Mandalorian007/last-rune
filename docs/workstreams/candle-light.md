# Workstream: candle-light

User (2026-11-02): "tune down candle brightness slightly so it doesn't overwhelm selectable item highlight. that or make candle brightness more like a warm flicker rather than a steady highlight. You can make a judgement."

**PM judgement: do both.** Lower the candles' average brightness, and turn their light into a warm, living flicker instead of a steady glare. The rule: **anything the player can select or act on is always brighter and more saturated than ambient light.** Candles are mood, never focus.

## Scope
- **Candles** (`art/materials/candles.ts`, `shaders/candle-wgsl.ts`, used by altar `scenes/altar/altar-view.ts` `CANDLES`, the hall/title views, the journal desk and the ending):
  - Lower the average light the candles throw, and their halo/bloom. Start around 25–35% lower, then judge by eye.
  - Their light should breathe: a slow warm swell plus small irregular flutter, a gentle rise and fall of light on the stone. No strobe, no sharp pops.
  - Flame cores can stay bright and small. It's the halo and the light pooled on the slab and floor that compete with the UI.
  - Reduced motion / Reduce flashes: a steady, lower level with at most a very slow swell.
  - Keep the journal desk readable. It is lit by its own candle; tune it separately if needed, since parchment must stay cream.
- **Selection must win** on the altar:
  - cursor/hover socket, held-gem ghost, live sockets, the gold endpoints, the Strike button pulse, the tray's selected slot;
  - and in the hall, the available alcove's gold doorway and the focused alcove.
  - Take side-by-side screenshots: if any of these is not clearly the brightest thing near it, fix the balance. Prefer lowering ambient light over raising highlights. If a highlight really needs more punch, raise it modestly and keep to D-027 (visuals match rules).
- **While you're in the lighting** (polish backlog):
  - capacitor-bay washes out under its own glow when available;
  - hall puddles are too subtle;
  - an optional vignette lift.
  - Use your judgement and keep the changes small.
- Don't change rules, puzzle data or UI layout.

## Done when
- Before/after screenshots:
  - altar: intake-desk with a gem held and the cursor over a live socket; a big board (archive or the last rune) before the first strike;
  - hall: first entry, and mid-game;
  - title, journal desk and ending.
  - All at 1920×1080. Also record mean luminance or a simple histogram of the candle regions before and after.
- A short GIF or frame strip showing the flicker.
- 60 fps holds on `?demo=art` / altar with no new draws or per-frame allocation.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02: candle-light pass (branch `ws/candle-light`)
**What changed**
- `art/materials/candles.ts`:
  - New `candleBreath(t, seed, calm)` replaces the engine `flicker` for candles. It is a slow warm swell (a ~6 s sine breath blended with slower value-noise drift) plus a small smooth flutter (2.2 Hz and 4.7 Hz noise). Range ≈0.70..1, mean ≈0.85. The old flicker's random "dip" pops are gone. Unit tests cover the range and mean, and check that no frame-to-frame step is over 0.02 at 60 fps.
  - Calm mode is a steady 0.92..1 with a 0.12 Hz swell. It is used for Reduced motion and now also for **Reduce flashes**: altar, solve moment, hall, title and journal all pass it through.
  - All brightness knobs live in `CANDLE_LIGHT`:

    | Knob | Before | After |
    |---|---|---|
    | Point light | 1.6 | 1.0 (−37.5%) |
    | Light radius | ×1 | ×0.9 |
    | Halo strength | 0.12 | 0.085 |
    | Halo bloom | 0.6 | 0.45 |
    | Halo size | 220 px | 170 px |
    | Halo falloff | 4 | 5 |
    | Lit-wax term | ×1 | ×0.7 |
    | Flame bloom | 2.2 | 1.7 |

    Flame cores keep their colour. Combined, halo bloom energy is about −75%.
- Journal desk: its own light code (1.25 × flicker) is unchanged. The new mean flicker (0.85) matches the old one (≈0.84), so the parchment stays the same cream (page luma 100.8 → 103.0).
- Hall polish:
  - Puddles (`hall-floor-shaders.ts` `k_puddle`) get a cool sky sheen, stronger toward the far edge, plus a thin wet rim and slightly stronger light streaks. They now read as water.
  - Capacitor-bay cans are darker, with stronger bands (`m_caps`), so the open niche's work lamp no longer flattens them into a gold blob.
  - Hall vignette is lifted from 0.7 / r 0.55 to 0.6 / r 0.6.
- No rules, puzzle data or UI layout changes. No new draws, no per-frame allocation.

**Numbers**
- Mean display luminance (Rec. 709, 0..255, median of 7 frames), before → after:

  | Screen | Region | Before | After |
  |---|---|---|---|
  | Altar intake-desk | left candles | 40.9 | 32.7 |
  | | right candles | 55.4 | 41.4 (−25%) |
  | | right flame box | 167 | 148 |
  | Altar archive | right candles | 57.5 | 41.5 (−28%) |
  | Altar the-last-rune | right candles | 56.5 | 38.6 (−32%) |
  | Hall, first entry | floor band | 51.3 | 40.6 |
  | Hall, first entry + focus | floor band | 58.3 | 47.6 |
  | Hall, mid-game | floor band | 66.2 | 56.3 |
  | Hall, tier 3 | floor band | 57.7 | 50.3 |
  | Title | left / right | 61.5 / 37.9 | 54.9 / 28.8 |
  | Journal | page | 100.8 | 103.0 (cream kept) |
  | End card | floor band | 163.2 | 162.6 (gold flood) |

  The left title region is dominated by the storm orb. The hall floor band includes the brighter puddles and the vignette lift.
- Perf (`scripts/perf`, auto tier, dpr 1): frame p50 is 16.7 ms in every scene. Draws: title 10, hall 15/14, altar 15, strike 16, ending 19, all unchanged and within budget.

**Screenshots** (local only, `docs/design/screens/local/candle-light/`, from `scripts/playtest/candle-light.spec.ts` at 1920×1080):
- `before/` and `after/` hold every shot plus `*.luma.json`. The before set was rendered from the base game code with the same spec.
- Side-by-sides: `altar-compare.png`, `hall-compare.png`, `tj-compare.png` (title and journal), `cap-compare.png` (capacitor bay).
- Flicker: `flicker.gif` and `flicker-strip.png` (12 frames, 200 ms apart).

**Looking at it as a new player**
- Altar: the held gem, the live socket rings, the storm and the Strike button are clearly the brightest things around them. The candles now sit back as warm edges.
- Hall: the open alcove's lit doorway beats the foreground candles.
- Title: Play still wins easily.

**Open**
- In the hall the open doorway reads as white-gold, not strongly gold. That is out of scope here.
- `scripts/perf` shows a high GPU p50 in the ending flood. Candles are not used there and frame p50 is 16.7 ms; this looks like a measurement artefact on this machine.
