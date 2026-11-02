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
| M3 | Content complete (wave 3) | ✅ done | All 16 machines playable at the altar; dressed hall with distinct machine silhouettes; Journal, FUSE lines, Ending and Discord door; audio; storm/mist/candles |
| M3α | **Alpha release: GitHub Pages** | ✅ alpha-1 (2026-11-02) | Pages already deploys on every push (D-023). Alpha = labelled run (`alpha-1`), `VITE_RELEASE_LABEL` on the title, GitHub pre-release, playtest link to the user |
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
| 3 Content complete | altar-scene, hall-art, story-scenes | ✅ merged |
| 4 Alpha + verify | hall-floor ✅, altar-clarity ✅, full-run ✅ (keyboard e2e through all 16 + playtest report), engine-cleanup ✅, engine-adoption ✅, then the playtest fixes before alpha: caption-layout ✅, altar-polish ✅; release label on title ✅; then the M3α pre-release | ✅ merged |
| 5 Polish | perf-tiers ✅, a11y ✅, polish-1 ✅; then difficulty-fun phase 2 from alpha-1 feedback, polish backlog, bug bash | 🟡 running |
| 6 Ship | v1.0.0 release, tags, itch kit | ⏳ |

## User feedback backlog
Each item stays here until it is verified in a merged build. The owning workstream is in brackets.

| Date | Feedback | Owner | State |
|---|---|---|---|
| 2026-11-02 | Get the real puzzles in (the live build still has stubs) | altar-scene | ✅ all 16 playable (cebe8a7) |
| 2026-11-02 | Machines are plain boxes; make them machines/buildings with more flavour on the factory floor | hall-art ✅ silhouettes; hall-floor ✅ pipes, cables, lamps, crates, puddles; readable alcove states | ✅ (4a0b76b) |
| 2026-11-02 | UI/UX must be clear, clean and intuitive (hall and altar) | ✅ altar-clarity, hall-floor, caption-layout, altar-polish; confirm with the user on alpha-1 | ✅ pending user check |
| 2026-11-02 | "Touch only that" leaves players unsure what to touch, and "touch nothing but that" makes them afraid of mistakes, now that many things glow | PM: hall first-entry, intake-desk arrive and teach nudge rewritten to name the gold doorway / tray / bright socket and say mistakes are free (77f61c5); pitch and script updated | ✅ |
| 2026-11-02 | Auto-formatting on | PM | ✅ D-024 |

## Playtest findings (full-run report, docs/design/playtest-report.md)
| Sev | Finding | Owner |
|---|---|---|
| S1 | FUSE's caption covers tray slot 6 (control-booth) and the machine label (intake-desk) | ✅ altar-polish lanes + altar `fuse.avoid(tray)` |
| S2 | Caption cuts text mid-word at 960×540 (was mid-typing, not clipped); covers right-hand hall alcoves; sits over the settings dialog | ✅ caption-layout |
| S2 | Big boards: blocked vs open sockets hard to tell; board very dark before first strike | ✅ altar-polish (X caps may be too loud on dense boards: alpha feedback) |
| S2 | Last rune: "Needs N" labels float far from the board | ✅ altar-polish |
| S2 | Hall first entry: nothing marked the intake desk; locked alcoves near black | ✅ hall-floor (gold doorway, backlit locked alcoves); recheck in alpha |
| S3 | Settings key hint "O" reads as "0" | ✅ caption-layout |
| S3 | Enter on a placed gem rotates some gems, picks up others | ✅ altar-polish |
| S3 | Fizzle tag over the board; gem tooltip over FUSE; 114 key presses for 20 gems on archive | ✅ tags, tooltip; ✅ presses 808→564 overall, archive 55 (polish-1: G jump, sliding cursor, route-ordered plan) |
| — | Splitter-mill: storm stand overlaps the west machine's roof | ✅ altar-polish |
| — | No first-appearance FUSE line for Channel | ✅ altar-polish |

**Decisions (PM):** altar route preview stays on (direction only, never charge), revisited in difficulty-fun phase 2 with alpha data. The exact line goes in the verdict banner, not FUSE's caption, so the solve moment doesn't cut him off.

## Polish backlog (wave 5 unless picked up earlier)
- Altar: FUSE's caption still covers the tail of the bottom key-hint line; move or shorten the hints.
- Intake-desk now has four FUSE lines on first visit (arrive, Bend, Channel, idle teach); check it doesn't feel chatty.
- Hall: capacitor-bay washes out under its own glow when available; puddles subtle; optional vignette lift. 16 light slots: two are used by the wing lamps.
- ✅ Ending credits backing, door bloom, eased post (engine-adoption).
- ✅ HUD focus restore fixed in engine (a11y): `focusHome` + `buttonKeys`.
- ✅ Text size setting 100/125/150% (polish-1, D-025).
- ✅ Caption no longer covers the altar key-hint line (polish-1).
- ✅ Archive key presses 109 → 55; all 16: 808 → 564 (polish-1, D-026). Refresh the Keys column in `docs/design/playtest-report.md` from this run.
- Settings and Codex panels scroll at every text size (pre-existing); revisit if players miss options.
- Prune `docs/design/screens` (31 MB) before v1.0.
- Perf follow-ups: timestamp-query GPU timing (engine/platform), composite at scene resolution on Low (softer, cuts the ~4 ms floor), DPR 2 ending flood on High is over budget.
- Optional altar board readout key for screen readers (a11y S3).
- Ending UI copy (credits, chat names) pending user confirmation.

## Engine adoption (✅ engine-adoption merged; remaining: altar item 7 → altar-polish)
1. Ending: use `post.blendTo` instead of washes hiding preset swaps.
2. `art/props/storm.ts`: use `createPingPong`, and destroy its material in `destroy()`.
3. ~~bolt/storm/fuse: share one `perDrawUniforms` material~~ skipped: different shaders and blend modes, one instance each, and per-draw uniforms stop bolt batching.
4. Emboss and mask textures: use `textureFromPixels` / `{ linear: true }`.
5. game-shell: `globalKeys: ['KeyC','KeyO','KeyJ']` ✅; the HUD blur stays (see polish backlog).
6. `audio/render.ts`: import `OfflineContextFactory` from `@engine/audio`.
7. Altar: use `particles.clear()` and the default bolt timing where it looks right (altar-polish).
8. Scenes that create a Fuse should call `fuse.destroy()` on exit.
9. e2e `press()` helpers can drop their frame waits (optional).

Engine gaps from waves 1–3: all closed by engine-cleanup (2026-11-02).
