# Workstream: hall-floor (wave 4)

**Goal:** the factory floor has flavour, and every alcove's state reads at a glance. User feedback (2026-11-02): "the boxes should be more machines, buildings… we need more flavor on the factory floor. The UI/UX should be clear, clean and intuitive." hall-art delivered the machine silhouettes; this finishes the job.

**Owns:** `games/last-rune/scenes/hall/`, `games/last-rune/art/hall/`, `games/last-rune/shaders/hall-*.ts`, `docs/design/screens/hall-*.png`.
**Don't touch:** `scenes/altar/` (altar-clarity), `engine/` (engine-cleanup; ask the PM if you need an engine change), `scenes/journal/` and `scenes/ending/` (story-scenes), `content/` (propose changes to the PM).

## Deliver
1. **Floor dressing:** one batched floor-props material (about one draw call): pipes and cable runs along the floor and walls between machines, crates, rails, steam vents (puffs off in reduced motion), hanging lamps, and puddles that catch the lightning and the restored machines' glow. Don't block alcoves, the HUD, the FUSE caption or the intake desk.
2. **Locked readability:** in `docs/design/screens/hall-mid.png` the two top-right locked alcoves read as empty black holes. Every locked alcove must show a faint silhouette of its machine behind the grate and padlock, so the player can see what's coming.
3. **Available:** add a faint lit interior instead of a flat gold silhouette. The available machine must be the most inviting thing on screen.
4. **Restored life:** each restored machine gets one small ambient tell (steam, a blinking light, a turning gear). Keep it cheap.
5. **Perf:** keep 60 fps. Report draw calls and p95 frame time before and after; hall-art's baseline is 11–12 draws and p95 16.8 ms.
6. Screenshots: start, mid and end states, plus hover. Each under 400 KB. Iterate critically against the pitch.

## Log

- **2026-11-02 (hall-floor agent):** delivered.
  - **Floor dressing:** new `art/hall/hall-floor.ts` + `shaders/hall-floor-shaders.ts`. One material, drawn as two batches so depth reads right: a wall layer before the alcoves (iron and copper pipe mains, four risers with valve wheel and gauge, ceiling cable swags, a low cable run, two blinking junction boxes, rails, an ore cart, four hanging lamps) and a floor layer after the machines (crates, barrels, two steam vents, three puddles). All lit by the hall's light set. The lamps brighten with progress and dip on lightning. The hall adds two warm wing-lamp lights, and the puddles show streaks from every light in the set (lightning, candles, restored machines). Steam, lamp sway and all machine animation stop under reduced motion. Nothing covers the alcoves, HUD, FUSE card or intake desk.
  - **Locked:** a cool backlight behind the grate, with the material desaturated and a cool rim, so every locked machine (top-right included) reads as a silhouette.
  - **Available:** a warm key light from the niche top lights the machine's real materials, plus a breathing gold doorway edge, a faint light beam and dust motes. Fills are kept out of bloom so the niche doesn't wash out.
  - **Restored:** a calmer warm fill and a pilot lamp at the niche corner with a heartbeat blink, tinted to the machine's accent.
  - **Perf** (headless Chromium, vsync-capped, same machine A/B against base 28bf494 at 1920x1080): draws went from 12/12/11 to 14/14/13 (start/mid/end) and instances from about 117 to about 147. p95 was 16.7 ms both before and after in a clean run. In a second run, while other agents loaded the machine, both builds showed occasional 33 ms p95s. At 1120x630 every state is p95 16.7–16.8.
  - **Screens:** `docs/design/screens/hall-{start,mid,end,hover}.png` (217–269 KB, 256-colour). Before: `hall-floor-before-{start,mid}.png`.
  - **For the PM:** I don't own `shaders/alcove-shaders.ts`, so all state-readability work is in the machine shader. The 2 wing-lamp lights take 2 of the 16 light slots, which cuts restored-machine warm lights from 5 to 3.
