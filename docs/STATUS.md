# Status board

_Last updated: 2026-11-02 by PM_

**Current milestone:** M1 Foundations (wave 1)

| Workstream | Branch | State | Notes |
|---|---|---|---|
| scaffold | main | ✅ done | pnpm, TS7, Vite 8, Vitest, Biome, Playwright, docs |
| engine-render | ws/engine-render | ✅ merged | platform, loop, scene stack, HDR renderer, materials, post stack, GPU particles; demo at `?demo=render` (60fps, 20k sparks) |
| engine-systems | ws/engine-systems | 🟡 in progress | |
| rules-puzzles | ws/rules-puzzles | 🟡 in progress | |
| progression-content | ws/progression-content | ✅ merged | 16-machine graph, 79 lines (31 new), 16 journal pages, ending data. D-014, D-015 |
| ship-ops | ws/ship-ops | 🟡 in progress | |

## Blocked / needs user
- itch.io launch is manual with the user after M5 (D-012)
- (Planned) Enable GitHub Pages "Source: GitHub Actions" in repo settings at M3α. PM can do it via `gh api`.

## Risks
- WebGPU inside the itch iframe (permissions policy). ship-ops is verifying.
- Puzzle quality: 16 puzzles must be interesting, not just solvable. The solver gives difficulty metrics, and the PM reviews.
- Procedural art reaching "painterly" quality: art R&D is front-loaded in wave 2.
