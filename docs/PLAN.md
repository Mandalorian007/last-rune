# Plan

**Goal:** ship *The Last Rune*: free browser game, 16 machines, about 1 hour, WebGPU, itch.io with a tip jar. Built from [design/pitch-v0.3.md](design/pitch-v0.3.md).
**Target:** no fixed date (user direction, D-011). Milestones are sequential gates, finished when their exit criteria are met. Quality over speed.

## Hard constraints
- **Intuitiveness matters (D-027).** A new player must understand what to do, what the target is and what each piece does without a manual. Every visual must tell the truth about the rules. Any confusion in a playtest is a bug, and it goes to the top of the queue.
- **WebGPU only.** Unsupported browsers get a styled "use Chrome / Edge / Safari" screen (D-002).
- **Procedural art.** All visuals come from code (shaders, SDF, generated textures); no external art (D-001). Audio is procedural too (WebAudio synthesis).
- **Browser-only storage.** Saves use `localStorage`. No backend, no Fly.io (D-004).
- **Public repo.** No secrets, tokens or personal data. Discord invite URL lives in one config constant.
- Must run as a static zip inside the itch.io iframe (see [shipping-itch.md](shipping-itch.md)).

## Milestones

| # | Milestone | State | Exit criteria |
|---|---|---|---|
| 2026-11-02 | "Browser double tap zoom should be disabled, it messes with gameplay" | PM: viewport no-scale, touch-action, block dblclick/gesture/ctrl-wheel zoom (keyboard zoom kept) | ✅ merged; awaiting user check |
| 2026-11-02 | Ending: "don't give details about the discord, just note that he found friends there… he isn't a bot on the server. Just a game character." Author is ThunderSoap, owner of ThunderClap Gaming | ending-2 (D-032); new copy approved by user ("I love it") | ✅ merged |
| 2026-11-02 | "Codex should use proper images"; "unlock the entry when you see it, not after you unlock it" (showing locked/unlocked is fine) | codex-2 | ✅ merged (D-035) |
| 2026-11-02 | "make sure the discord link and kofi link have a copy option if pop ups are browser blocked" (+ "make sure our game engine logic can handle external links") | link-copy (D-036) | ✅ merged |
| 2026-11-02 | "put a fun donate/buy me a coffee thing on main menu and end screen with my kofi" | ending-2 (D-034) | ✅ merged |
| 2026-11-02 | "Smooth gameplay up to unlocking capacitor. How it works is not super clear with the double striking thing" | capacitor-clarity | ✅ merged (D-033) |
| 2026-11-02 | "Is storm cell 2 even winnable without being able to rotate splitters?" (it is: 1 solution, Splits take any side and fork perpendicular, so the player read Split as directional) | split-rotate: user chose "one input and rotate like everything else" (D-031) | ✅ merged; awaiting user check |
| 2026-11-02 | After turn-clarity: "rotate should save rotation without enter key and should be more intuitive on text" | turn-2 | ✅ merged; awaiting user check |
| 2026-11-02 | Re-check after onboarding-2: intake desk "great and clear and intuitive", but "maybe some bugs on rotating vs selecting". Second stage (splitter-mill, probably) "confusing as all hell with the layout and rotating desired… I thought I would rotate the splitter, but then the rotate looked like the piece I was placing" | turn-clarity | ✅ merged; awaiting user check |
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
| 5 Polish | perf-tiers ✅, a11y ✅, polish-1 ✅, first-altar ✅, onboarding-2 ✅, title-fuse ✅, split-rotate ✅, turn-2 ✅, turn-clarity ✅, capacitor-clarity ✅, codex-2 ✅, ending-2 + Ko-fi ✅, link-copy ✅, candle-light ✅, difficulty-2 ✅ (D-037), bug-bash ✅, perf-low ✅, finish-1 ✅, screens pruned ✅; remaining: user playtest check, minor backlog | ✅ polish round 2: tidy-2, newcomer-2, newcomer-3; ✅ ending-3 (D-038); ✅ tidy-3 (last minor items); ✅ lore-1 (make the twist land); 🟡 phones (D-039): mobile-perf ✅, mobile-ui ✅ but unplayable on a real phone → mobile-2 ✅ (PM blind review 6/10) → mobile-3 ✅ board / chrome ✅ / ending ✅ → gate review 1 6.25/10 ✗ → mobile-4 🟡 board / chrome (D-040; gate ≥8/10 blind review, then user retest); user playtest when ready |
| 6 Ship | v1.0.0 release, tags, itch kit | ⏳ |

## User feedback backlog
Each item stays here until it is verified in a merged build. The owning workstream is in brackets.

| Date | Feedback | Owner | State |
|---|---|---|---|
| 2026-11-02 | "Make our cute robot on the home page wander around a bit and say random stuff just for immersion" | title-fuse | ✅ merged; awaiting user check |
| 2026-11-02 | Re-check after first-altar: gem helper cards ("new item") block the grid; they should fade and be hover/focus pop-ups. "Is the bend a fixed direction? Should it be rotated?" (fixed vs rotatable gems not readable) | onboarding-2 | ✅ merged; awaiting user check |
| 2026-11-02 | alpha-1 playtest, intake desk: "didn't know what the target was, how to place, and the purple indicator had a shape I followed but the lightning went the other way. Confusing for a new user; address this first." | PM (glyph) + first-altar | ✅ Bend/Gate glyphs match rules (811f25c); ✅ first-time flow (first-altar); awaiting user re-check |
| 2026-11-02 | Get the real puzzles in (the live build still has stubs) | altar-scene | ✅ all 16 playable (cebe8a7) |
| 2026-11-02 | Machines are plain boxes; make them machines/buildings with more flavour on the factory floor | hall-art ✅ silhouettes; hall-floor ✅ pipes, cables, lamps, crates, puddles; readable alcove states | ✅ (4a0b76b) |
| 2026-11-02 | UI/UX must be clear, clean and intuitive (hall and altar) | ✅ altar-clarity, hall-floor, caption-layout, altar-polish; confirm with the user on alpha-1 | ✅ pending user check |
| 2026-11-02 | "Touch only that" leaves players unsure what to touch, and "touch nothing but that" makes them afraid of mistakes, now that many things glow | PM: hall first-entry, intake-desk arrive and teach nudge rewritten to name the gold doorway / tray / bright socket and say mistakes are free (77f61c5); pitch and script updated | ✅ |
| 2026-11-02 | Auto-formatting on | PM | ✅ D-024 |
| 2026-11-03 | After playing alpha-1: Discord is a community hangout, make the chat ending more fun, real emoji reactions not coloured circles, sidebar is the most interesting (screenshot). Picked: bring chat back, real channel names | D-038; ending-3 | 🟡 running |
| 2026-11-02 | "Make judgements for quality and focus on polishing things up." Don't worry about Firefox. User playtests when time allows | PM: wave 5 polish run (candle-light, difficulty-2, bug-bash, perf-low, finish-1); Firefox dropped as a target | ✅ merged |
| 2026-11-02 | Candles overwhelm the selectable-item highlight: tone down, or make them a warm flicker | candle-light (PM judgement: both; selection always brightest) | ✅ merged; awaiting user check |
| 2026-11-02 | The FUSE-is-the-Builder twist isn't obvious: "I didn't even pick up on that twist" | User: keep the lore, make it easier to catch. PM: lore-1 (FUSE says it once plainly, page 16 signature reads as his, clues ramp through tiers 2–3) | ✅ |
| 2026-11-03 | Support phones: "it's fine if it's horizontal only, but both would be cool" | D-039: landscape is a must, portrait where clear. mobile-ui (layout + touch) and mobile-perf (GPU/memory/audio/lifecycle) | ✅ merged; real-device check pending |
| 2026-11-03 | Real phone: "absolutely unplayable… help menus cover the full screen… bottom buttons go almost to the center… text boxes are huge wrapping messes" | mobile-2: a phone layout designed for phones (not inflated desktop), hard space budgets, realistic Safari viewports; PM reviews contact sheets, not rules | ✅ merged. PM blind review 6/10 → mobile-3 (D-040) ✅ merged; gate review 1 6.25/10 → mobile-4 running |

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
- ✅ Intake-desk first visit trimmed to one FUSE card (difficulty-2, D-037).
- ✅ Hall: capacitor-bay washout, puddles, vignette (candle-light). Open alcove doorway reads white-gold rather than gold (minor). 16 light slots: two are used by the wing lamps.
- ✅ Ending credits backing, door bloom, eased post (engine-adoption).
- ✅ HUD focus restore fixed in engine (a11y): `focusHome` + `buttonKeys`.
- ✅ Text size setting 100/125/150% (polish-1, D-025).
- ✅ Caption no longer covers the altar key-hint line (polish-1).
- ✅ Archive key presses 109 → 55; all 16: 808 → 564 (polish-1, D-026). Refresh the Keys column in `docs/design/playtest-report.md` from this run.
- ✅ Settings and Codex fit at every text size (bug-bash).
- ✅ Bug-bash S3 leftovers (finish-1). ✅ device-lost halt and clipboard drop (tidy-2).
- ✅ Pruned `docs/design/screens` (41 MB → 2 MB playtest set; history keeps the rest; new shots go to ignored `screens/local/`).
- ✅ Perf follow-ups (perf-low): timestamp GPU timing, Low composite at scene res, ending in budget at DPR 2. Left: synth in a Worker would remove 40–80 ms load tasks (optional); loop keeps ticking under the device-lost dialog (S4).
- Optional altar board readout key for screen readers (a11y S3).
- Ending UI copy (FUSE's 3 captions, title card, credits naming ThunderSoap) pending user confirmation; the chat mock is gone (D-032).

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
