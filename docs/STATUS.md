# Status board

_Last updated: 2026-11-02 by PM_

**Current milestone:** M1 Foundations (wave 1)

| Workstream | Branch | State | Notes |
|---|---|---|---|
| scaffold | main | ✅ done | pnpm, TS7, Vite 8, Vitest, Biome, Playwright, docs |
| engine-render | ws/engine-render | ✅ merged | platform, loop, scene stack, HDR renderer, materials, post stack, GPU particles; demo at `?demo=render` (60fps, 20k sparks) |
| engine-systems | ws/engine-systems | ✅ merged | save (versioned, iframe-safe), input action map, audio buses + synth recipes, ui overlay/panels/caption card |
| rules-puzzles | ws/rules-puzzles | 🟡 in progress | |
| progression-content | ws/progression-content | ✅ merged | 16-machine graph, 79 lines (31 new), 16 journal pages, ending data. D-014, D-015 |
| ship-ops | ws/ship-ops | ✅ merged | WebGPU works in the itch iframe (D-016); CI, itch zip packager, itch-sim, Playwright e2e (2 tests pending the Title scene) |
| art-materials | ws/art-materials | 🟡 in progress | wave 2 early start: gems, stone, altar, lighting |
| art-props | ws/art-props | 🟡 in progress | wave 2 early start: FUSE, storm cell, bolt ribbon, machine, locked alcove |

## Blocked / needs user
- itch.io launch is manual with the user after M5 (D-012)
- (Planned) Enable GitHub Pages "Source: GitHub Actions" in repo settings at M3α. PM can do it via `gh api`.

## Risks
- Firefox + WebGPU in the itch iframe untested (manual check at launch).
- Puzzle quality: 16 puzzles must be interesting, not just solvable. The solver gives difficulty metrics, and the PM reviews.
- Procedural art reaching "painterly" quality: art R&D is front-loaded in wave 2.
