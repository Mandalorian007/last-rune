# Plan

**Goal:** ship *The Last Rune*: free browser game, 16 machines, about 1 hour, WebGPU, itch.io with a tip jar. Built from [design/pitch-v0.3.md](design/pitch-v0.3.md).
**Target:** no fixed date (user direction, D-011). Milestones are sequential gates, finished when their exit criteria are met. Quality over speed.

## Hard constraints
- **WebGPU only.** Unsupported browsers get a styled "use Chrome / Edge / Safari" screen (D-002).
- **Procedural art.** All visuals come from code (shaders, SDF, generated textures); no external art (D-001). Audio is procedural too (WebAudio synthesis).
- **Browser-only storage.** Saves use `localStorage`. No backend, no Fly.io (D-004).
- **Public repo.** No secrets, tokens or personal data. Discord invite URL lives in one config constant.
- Must run as a static zip inside the itch.io iframe (see [shipping-itch.md](shipping-itch.md)).

## Milestones

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Scaffold | Repo, tooling, docs, CI, GitHub public ✅ |
| M1 | Foundations (wave 1) | WebGPU renderer and post stack demo; engine systems; charge sim, solver and 16 puzzles verified; progression and content data; itch pipeline and CI |
| M2 | Playable vertical (wave 2) | Title → Hall → Puzzle → Solve loop with real data and save/continue; Codex; procedural gem and stone art |
| M3 | Content complete (wave 3) | All 16 machines, Journal, FUSE lines, Ending and Discord door, audio, mist/candles/storm |
| M3α | **Alpha release: GitHub Pages** | First public release location. Actions workflow deploys `main` → `https://mandalorian007.github.io/last-rune/` on push; alpha label in-game; playtest link shared |
| M4 | Polish + playtest | Automated playtest (solver-driven full run), perf pass, a11y pass, bug bash |
| M5 | **Release: GitHub Pages v1.0** (PM's finish line) | Polished build live on Pages, GitHub Release + `v1.0.0` and `engine-v0.1` tags, itch zip + page copy + devlog draft prepared for the user |
| — | itch.io launch (manual, with user) | User uploads with PM's runbook; not an agent task (D-012) |

## Waves (max 5 parallel top-level agents)

**Wave 1 — Foundations** (independent, contract-first)
1. `engine-render`: core loop, platform mount/resize, WebGPU device, batch + materials, post stack, GPU particles
2. `engine-systems`: input action-map, audio buses + procedural SFX, UI overlay stack, versioned saves
3. `rules-puzzles`: charge sim, gems, solver, 16 puzzle definitions + tests
4. `progression-content`: machines, capability graph, FUSE lines, journal, validators
5. `ship-ops`: itch research, packaging script, GitHub Actions CI, Playwright WebGPU smoke harness

**Wave 2 — Playable vertical** (after wave 1 merges): scenes (title, hall, altar/puzzle, solve, codex), procedural art (gem refraction, stone, FUSE), game state/flow.

**Alpha release (after wave 3 content lands):** GitHub Pages deploy workflow + alpha build (D-010).

**Wave 3 — Complete + polish:** journal desk, ending sequence, storm fluid, mist/candles, audio pass, automated full-run playtest, perf/cleanup agents as needed.
