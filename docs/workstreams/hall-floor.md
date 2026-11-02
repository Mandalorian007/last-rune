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
