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

| # | Milestone | State | Exit criteria |
|---|---|---|---|
| M0 | Scaffold | ✅ done | Repo, tooling, docs, CI, GitHub public |
| M1 | Foundations (wave 1) | ✅ done | WebGPU renderer and post stack demo; engine systems; charge sim, solver and 16 puzzles verified; progression and content data; itch pipeline and CI |
| M2 | Playable vertical (wave 2) | ✅ done | Title → Hall → Puzzle → Solve loop with real data and save/continue; Codex; procedural gem and stone art |
| M3 | Content complete (wave 3) | 🟡 in progress | All 16 machines playable at the altar; dressed hall with distinct machine silhouettes; Journal, FUSE lines, Ending and Discord door; audio; storm/mist/candles |
| M3α | **Alpha release: GitHub Pages** | ⏳ after M3 | Pages already deploys on every push (D-023). Alpha = labelled run (`alpha-1`), `VITE_RELEASE_LABEL` on the title, GitHub pre-release, playtest link to the user |
| M4 | Polish + playtest | ⏳ | Solver-driven full-run playtest, perf pass (incl. integrated GPU), a11y pass, difficulty-fun phase 2, bug bash, user feedback items closed |
| M5 | **Release: GitHub Pages v1.0** (PM's finish line) | ⏳ | Polished build live on Pages, GitHub Release + `v1.0.0` and `engine-v0.1` tags, itch zip + page copy + devlog draft prepared for the user |
| — | itch.io launch (manual, with user) | ⏳ | User uploads with PM's runbook; not an agent task (D-012) |

## Fun and difficulty (continuous, D-021)
A standing **difficulty-fun** workstream owns the difficulty curve from wave 2 through M4: a difficulty model and novice bot, a target curve, puzzle retunes, a dev puzzle viewer, then a playtest loop (local-only metrics, FUSE hint ladder) after the alpha. Exit criteria for M4 include: user playtest confirms the curve feels right, no puzzle is an outlier against its target, and the finale is the hardest and most satisfying.

## Waves (max 5 parallel top-level agents)

| Wave | Workstreams | State |
|---|---|---|
| 1 Foundations | engine-render, engine-systems, rules-puzzles, progression-content, ship-ops | ✅ merged |
| 2 Playable vertical | game-shell, art-materials, audio-design, difficulty-fun (phase 1), art-props | ✅ merged |
| 3 Content complete | altar-scene ✅, hall-art ✅, story-scenes (journal, ending + Discord door, codex) 🟡 | 🟡 story-scenes running |
| 4 Alpha + verify | hall-floor, altar-clarity, full-run (real-input e2e through all 16 + playtest report), engine-cleanup; then the ending e2e, release label and M3α pre-release | 🟡 running |
| 5 Polish | fixes from the playtest report, perf on integrated GPU, a11y, difficulty-fun phase 2 from alpha feedback, bug bash | ⏳ |
| 6 Ship | v1.0.0 release, tags, itch kit | ⏳ |

## User feedback backlog
Each item stays here until it is verified in a merged build. The owning workstream is in brackets.

| Date | Feedback | Owner | State |
|---|---|---|---|
| 2026-11-02 | Get the real puzzles in (the live build still has stubs) | altar-scene | ✅ all 16 playable (cebe8a7) |
| 2026-11-02 | Machines are plain boxes; make them machines/buildings with more flavour on the factory floor | hall-art ✅ silhouettes; hall-floor 🟡 floor dressing | 🟡 half done |
| 2026-11-02 | UI/UX must be clear, clean and intuitive (hall and altar) | first pass ✅ (altar-scene, hall-art); altar-clarity, hall-floor, full-run report 🟡 | 🟡 |
| 2026-11-02 | Auto-formatting on | PM | ✅ D-024 |

## Known engine gaps (engine-cleanup, wave 4)
Per-draw uniforms; linear texture upload; ping-pong render-target helper; global keys in Input; master limiter/reverb; export `OfflineContextFactory`. Bugs: `ParticleSystem.clear()` lacks COPY_DST; `boltSegmentsFromTrace` timing differs from the sim trace; `Fuse` has no `destroy()`.
