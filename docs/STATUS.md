# Status board

_Last updated: 2026-11-02 by PM_

**Current milestone:** M3α ✅ alpha-1 live (pre-release `alpha-1`). Wave 5 polish: perf-tiers ✅, a11y ✅, polish-1 ✅, altar input/Split rework ✅ (D-029–D-031), zoom fix ✅; capacitor-clarity ✅; codex-2 + ending-2 in review. Next: user playtest of alpha-1 feeds difficulty-fun phase 2 + polish backlog. Roadmap, wave plan and user feedback backlog: [PLAN.md](PLAN.md).

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
| hall-floor | ws/hall-floor | ✅ merged | pipes, risers, cables, lamps, ore cart, crates, steam, puddles; locked alcoves backlit, available most inviting (gold doorway), restored pilot lamp. 60fps, 13–14 draws |
| altar-clarity | ws/altar-clarity | ✅ merged | board reads as a circuit (live sockets bright, rest covered), bigger machines at the exits with Needs/got labels, charge badges on the bolt, shorter verdicts, first-appearance teaching, FUSE nudges + exact lines |
| full-run | ws/full-run | ✅ merged | keyboard-only e2e title → all 16 machines → ending (16/16 e2e, 3 runs no flakes); playtest report docs/design/playtest-report.md; `scripts/playtest/` |
| caption-layout | ws/caption-layout | ✅ merged | caption compact bottom-right, never clips, hides under modals and resumes; `fuse.avoid(rects)` API (altar uses it for the tray); keycap HUD hints (O ≠ 0) |
| altar-polish | ws/altar-polish | ✅ merged | caption lane; blocked sockets sealed with an X cap; lit boards before the first strike; labels notched to machines; Enter always picks up; fizzle tags fade; splitter-mill overlap fixed; Channel line; cursor jumps to the route's open end |
| engine-adoption | ws/engine-adoption | ✅ merged | ending eases with post.blendTo; Builder's mark readable through the door; credits backed over the gold; storm on PingPong; linear emboss mask; global C/O/J; ending Fuse leak fixed. 60fps, draws unchanged |
| title-fuse | ws/title-fuse | ✅ merged | FUSE strolls between 3 spots left of the menu (still under reduced motion), 22 Tier-1 title lines every 12–20 s, no repeats, caption avoids the menu, silenced on Play |
| codex-2 | ws/codex-2 | 🟡 running | Codex shows real gem images (+ in/out diagrams for Bend/Gate/Split); entries unlock on first sight, marked Seen vs Yours |
| ending-2 | ws/ending-2 | 🟡 running | D-032: no Discord details; FUSE "went to ThunderClap Gaming" and made friends; chat mock removed; credits name ThunderSoap |
| capacitor-clarity | ws/capacitor-clarity | ✅ merged | strike pips + "Strike 1 of 2" on Gives card and Strike button; "in one strike" on Needs; Capacitor plan label ("Strike 1: keeps 8 / Strike 2: 8 + 8 → 16") from the sim trace; 1.4 s between strikes; verdict names the strike + plain story; full Capacitor rule on its card. D-033 |
| onboarding-2 | ws/onboarding-2 | ✅ merged | gem info card lives over the tray band (hover/focus/held; arrival card fades), fixed gems get iron brackets + "Fixed in place", first turnable Bend/Gate shows a turn badge and the preview swings as it turns; Gives N + strike-ready on all 16; new-gem lines before use; tray matches board; charge chips on new gems; `altar-labels.spec` e2e |
| split-rotate | ws/split-rotate | ✅ merged | D-031: Split has one input (stem) and turns; octagon cut + bold T glyph with outward arrows; red ✕ where the preview stops at a wrong-facing Bend/Gate/Split; 14 Split puzzles keep their routes (conveyor-a 8→4 solutions); solver ignores turn choice in scoring (follow-up) |
| turn-2 | ws/turn-2 | ✅ merged | R/Q/scroll over a placed gem turns it in place and saves at once, even with a gem in hand; held-gem ghost only over empty sockets; drag-turn kept on drop; plainer hint/tag/card text; 2 new e2e |
| turn-clarity | ws/turn-clarity | ✅ merged | one input rule: click picks up/sets down, R/Q/scroll/RB turn the gem under the cursor (held gem drawn as a ghost in its socket); gems that can't turn say so in place; Split shows an "in" marker; splitter-mill storm moved to the North edge (1 solution before and after, score 2.4) |
| first-altar | ws/first-altar | ✅ merged | storm "Gives N" card opposite "Needs N", pulsing storm/machine conduits + gold endpoints, live route preview from the first gem, Bend side stubs, Strike pulses only when the wire reaches the machine; glyphs thicker with halos, Split/facing fixes (gems face the real flow) |
| polish-1 | ws/polish-1 | ✅ merged | Text size 100/125/150% (no clipping at 1280×720); altar hint lane + caption avoids hint/tray/chips/buttons; G jumps to the wire's end, arrows slide over stone; keyboard presses 808 → 564 all 16, archive 109 → 55 (D-026) |
| perf-tiers | ws/perf-tiers | ✅ merged | fill-bound (CPU ≤1.2 ms p95 at 4× throttle); scene resolution decoupled from canvas, DynamicResolution with hysteresis, Auto/High/Low in Settings (High = today's image); bloom mip realloc bug fixed; budgets in engineering.md; `scripts/perf/` |
| a11y | ws/a11y | ✅ merged | audit (docs/design/a11y-audit.md); S1: title menu role, gamepad stuck in panels (engine PadNav); HUD focus restore fixed in engine (blur workaround gone); altar briefing + verdict announced; locked doors say what they need; contrast ≥ 4.5:1; axe e2e |
| engine-cleanup | ws/engine-cleanup | ✅ merged | particles clear, bolt timing from trace, Fuse.destroy, per-draw uniforms, texture uploads, PingPong, global keys, queued taps, master limiter + reverb, post.blendTo. 60fps, no new churn |

## Blocked / needs user
- itch.io launch is manual with the user after M5 (D-012)
- GitHub Pages enabled (source: GitHub Actions). Every push to main deploys to https://mandalorian007.github.io/last-rune/ (D-023); `gh workflow run pages.yml -f label=alpha-1` stamps a release label. At M3α, show `VITE_RELEASE_LABEL` on the title screen.

## Risks
- e2e flake (fixed twice over): repeat taps now queue in Input, and each worktree runs e2e on its own ports (tests/e2e/ports.ts).
- The master limiter is now on by default (above −1 dBFS only). Needs a human listen along with the rest of the audio.
- Audio is only objectively checked (levels, clicks, loops). Needs a human listen; 52 MiB decoded audio may matter on low-memory devices.
- Photosensitivity: the breaker flash whites out most of the frame for ~0.3 s. hall-art adds a "Reduce flashes" setting (on with reduced motion).
- Perf measured on Apple M4 only. The game is fill-bound; Auto scales resolution (floor 0.6) and drops to Low if needed. The ending flood at DPR 2 on High is over budget (~17–20 ms GPU); Auto/Low handle it. Still want a real integrated-PC-GPU check.
- Difficulty curve is calibrated to designer estimates, not players (D-022). Risk: early/mid puzzles may still feel too easy. Phase 2 needs real playtest data; the novice bot can't plan gate merges (flat signal on gate puzzles). conveyor-a / press-unit-4 / capacitor-bay are still loose (8–11 solutions).
- Firefox + WebGPU in the itch iframe untested (manual check at launch).
- docs/design/screens is 31 MB of PNGs in a public repo; prune or move to a release asset before v1.0.
- Puzzle quality: 16 puzzles must be interesting, not just solvable. The solver gives difficulty metrics, and the PM reviews.
- Procedural art reaching "painterly" quality: art R&D is front-loaded in wave 2.
