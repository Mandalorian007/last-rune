# Status board

_Last updated: 2026-11-02 by PM_

**Current milestone:** M3 ✅ content complete (whole game playable title → 16 machines → ending). Wave 4 running; then M3α alpha. Roadmap, wave plan and user feedback backlog: [PLAN.md](PLAN.md).

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
| story-scenes | ws/story-scenes | ✅ merged | journal desk (J), full ending → #this-will-break chat → gold flood → safety record → credits → Discord door end card (click-only, noopener); codex content source; FUSE altar lines (exact by tier, teach + new-gem nudges); Reduce flashes honoured. e2e 10/10 |
| altar-scene | ws/altar-scene | ✅ merged | all 16 puzzles play at the real altar (stubs gone); first-time clarity pass, keyboard play, intake-desk teaches itself; e2e solves intake-desk + furnace. UX: docs/design/altar-ux.md |
| art-props | ws/art-props | ✅ merged | FUSE (rig + caption portrait), storm cell (fluid sim), bolt ribbon (trace adapter, exact/over/under), machine gauge + breaker, alcove lock/unlock/restore; `?demo=props` |
| hall-art | ws/hall-art | ✅ merged | 15 distinct machine silhouettes, locked/available/restored states, 3-tier hall + seal, storm windows, FUSE roams; title art; one palette + light rig; Reduce flashes setting. 60fps, 11–12 draws |
| hall-floor | ws/hall-floor | 🟡 in progress | wave 4: floor dressing, locked alcoves readable, available machine most inviting |
| altar-clarity | ws/altar-clarity | 🟡 in progress | wave 4: less board noise, output visibly feeds the machine, readable strikes, onboarding for the first 3 gems |
| full-run | ws/full-run | 🟡 in progress | wave 4: real-input e2e through all 16 puzzles + player-eye playtest report |
| engine-adoption | ws/engine-adoption | 🟡 in progress | wave 4: callers adopt engine-cleanup's APIs; ending eases with post.blendTo; credits backing; door bloom |
| engine-cleanup | ws/engine-cleanup | ✅ merged | particles clear, bolt timing from trace, Fuse.destroy, per-draw uniforms, texture uploads, PingPong, global keys, queued taps, master limiter + reverb, post.blendTo. 60fps, no new churn |

## Blocked / needs user
- itch.io launch is manual with the user after M5 (D-012)
- GitHub Pages enabled (source: GitHub Actions). Every push to main deploys to https://mandalorian007.github.io/last-rune/ (D-023); `gh workflow run pages.yml -f label=alpha-1` stamps a release label. At M3α, show `VITE_RELEASE_LABEL` on the title screen.

## Risks
- e2e flake (fixed twice over): repeat taps now queue in Input, and each worktree runs e2e on its own ports (tests/e2e/ports.ts).
- The master limiter is now on by default (above −1 dBFS only). Needs a human listen along with the rest of the audio.
- FUSE altar lines exist (`exactLine`, `TEACH_NUDGE`, `gemNudge`); altar-clarity wires `exactLine`/`gemNudge` (verdict still hard-coded).
- Invented UI copy in the ending (credits, chat server/channel, 6 reactor handles, labels) awaits user confirmation: `docs/design/ending.md`.
- Audio is only objectively checked (levels, clicks, loops). Needs a human listen; 52 MiB decoded audio may matter on low-memory devices.
- Photosensitivity: the breaker flash whites out most of the frame for ~0.3 s. hall-art adds a "Reduce flashes" setting (on with reduced motion).
- Perf not yet measured on an integrated PC GPU (only Apple M-series). Lights are the first knob.
- Difficulty curve is calibrated to designer estimates, not players (D-022). Risk: early/mid puzzles may still feel too easy. Phase 2 needs real playtest data; the novice bot can't plan gate merges (flat signal on gate puzzles). conveyor-a / press-unit-4 / capacitor-bay are still loose (8–11 solutions).
- Firefox + WebGPU in the itch iframe untested (manual check at launch).
- Puzzle quality: 16 puzzles must be interesting, not just solvable. The solver gives difficulty metrics, and the PM reviews.
- Procedural art reaching "painterly" quality: art R&D is front-loaded in wave 2.
