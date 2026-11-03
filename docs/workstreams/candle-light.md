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
