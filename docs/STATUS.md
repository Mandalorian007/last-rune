# Status board

_Last updated: 2026-11-02 by PM_

**Current milestone:** M2 Playable vertical (wave 3)

| Workstream | Branch | State | Notes |
|---|---|---|---|
| scaffold | main | ✅ done | pnpm, TS7, Vite 8, Vitest, Biome, Playwright, docs |
| engine-render | ws/engine-render | ✅ merged | platform, loop, scene stack, HDR renderer, materials, post stack, GPU particles; demo at `?demo=render` (60fps, 20k sparks) |
| engine-systems | ws/engine-systems | ✅ merged | save (versioned, iframe-safe), input action map, audio buses + synth recipes, ui overlay/panels/caption card |
| rules-puzzles | ws/rules-puzzles | ✅ merged | sim + render trace, solver with metrics, 16 puzzles (~63 min est.), 404 tests. D-020 |
| progression-content | ws/progression-content | ✅ merged | 16-machine graph, 79 lines (31 new), 16 journal pages, ending data. D-014, D-015 |
| ship-ops | ws/ship-ops | ✅ merged | WebGPU works in the itch iframe (D-016); CI, itch zip packager, itch-sim, Playwright e2e (2 tests pending the Title scene) |
| game-shell | ws/game-shell | ✅ merged | GameCtx, save v1, settings, Title → Hall → puzzle stub → solve stub loop, codex shell. e2e 7/7 strict |
| art-materials | ws/art-materials | ✅ merged | light set, 6 gem cuts × 5 states, baked stone, altar slab, candles, gold emboss, post presets; `?demo=art` 60fps (stress 9 draws). Screens in docs/design/screens/ |
| audio-design | ws/audio-design | ✅ merged | 59 procedural sounds (0 problems, peak −1.5 dBFS), 13 moods by tier, FUSE voice; ~0.9 s pre-render after first click. PM wired `ctx.sound`, `ctx.setMood`, FUSE voice, codex/UI sounds |
| difficulty-fun | ws/difficulty-fun | ✅ phase 1 merged · ⏸ phase 2 after alpha | score model + novice bot, curve (D-022), 5 puzzles retuned, finale 72 → 4 solutions; `pnpm puzzle <id>` viewer |
| story-scenes | ws/story-scenes | 🟡 in progress | wave 3: journal desk, ending + Discord door, codex content |
| altar-scene | ws/altar-scene | 🟡 in progress | wave 3: playable altar puzzle + solve moment |
| art-props | ws/art-props | ✅ merged | FUSE (rig + caption portrait), storm cell (fluid sim), bolt ribbon (trace adapter, exact/over/under), machine gauge + breaker, alcove lock/unlock/restore; `?demo=props` |
| hall-art | ws/hall-art | 🟡 in progress | wave 3: the hall dressed with real props and lighting; title art; palette/light-rig unification |

## Blocked / needs user
- itch.io launch is manual with the user after M5 (D-012)
- (Planned) Enable GitHub Pages "Source: GitHub Actions" in repo settings at M3α. PM can do it via `gh api`.

## Risks
- Audio is only objectively checked (levels, clicks, loops). Needs a human listen; 52 MiB decoded audio may matter on low-memory devices.
- Photosensitivity: the breaker flash whites out most of the frame for ~0.3 s. hall-art adds a "Reduce flashes" setting (on with reduced motion).
- Perf not yet measured on an integrated PC GPU (only Apple M-series). Lights are the first knob.
- Difficulty curve is calibrated to designer estimates, not players (D-022). Risk: early/mid puzzles may still feel too easy. Phase 2 needs real playtest data; the novice bot can't plan gate merges (flat signal on gate puzzles). conveyor-a / press-unit-4 / capacitor-bay are still loose (8–11 solutions).
- Firefox + WebGPU in the itch iframe untested (manual check at launch).
- Puzzle quality: 16 puzzles must be interesting, not just solvable. The solver gives difficulty metrics, and the PM reviews.
- Procedural art reaching "painterly" quality: art R&D is front-loaded in wave 2.
