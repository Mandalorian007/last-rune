# Decisions

Format: `D-NNN · date · decision · why · who`.

- **D-001** · 2026-11-02 · Art is **fully procedural** (shaders, SDF, generated textures). No hand-painted or third-party art. · Agents can't paint; keeps licensing clean; fits the week. · User
- **D-002** · 2026-11-02 · **WebGPU only**, no WebGL2 fallback. Unsupported browsers get a clear message screen. · Simpler engine; matches pitch. · User
- **D-003** · 2026-11-02 · Repo `Mandalorian007/last-rune` (public). Single repo containing `engine/` + `games/last-rune/` per pitch §6. · User
- **D-004** · 2026-11-02 · Storage is **browser-only** (`localStorage`). The pitch's "Fly volume / Fly boot" is dropped for now. · Public repo, no secrets, static itch hosting. · User
- **D-005** · 2026-11-02 · Discord: **in-game ending only.** FUSE "living in the Discord" is lore. There is no bot. The invite URL is a single config constant, placeholder until provided. · User
- **D-006** · 2026-11-02 · Tooling: **pnpm** (pinned via `packageManager`), TypeScript 7 strict, Vite 8, Vitest 5, Playwright, Biome (lint + format). No npm lockfiles. · Speed, professional grade. · User
- **D-007** · 2026-11-02 · Commits in this repo use the GitHub noreply email, so no personal email appears in public history. · Privacy. · PM
- **D-008** · 2026-11-02 · Minimal runtime deps: **no 3D/game frameworks** (no three.js, pixi, etc.). The engine is our own code on raw WebGPU, per pitch §6. Small pure utilities are allowed with PM approval. · Pitch intent: this week seeds the ThunderClap engine. · PM
- **D-009** · 2026-11-02 · Logical resolution **1920×1080 design space, 16:9 letterboxed**; itch embed 960×540 with fullscreen button. UI text is DOM overlay (crisp, accessible); world is the WebGPU canvas. · PM
- **D-010** · 2026-11-02 · **GitHub Pages is the first release location** (alpha), at `mandalorian007.github.io/last-rune/`, deployed from `main` by GitHub Actions once the alpha is playable. itch.io remains the launch target (M5). Pages saves are separate from itch saves (different origins). · Free HTTPS static hosting; top-level page avoids iframe WebGPU risk; live playtest link. · User
- **D-011** · 2026-11-02 · **No ship date.** Work proceeds milestone by milestone until the goal is met; the pitch's one-week schedule is no longer a constraint. · User direction. · User
- **D-012** · 2026-11-02 · **PM's finish line is the GitHub Pages release (M5).** The itch.io launch is done manually by the user with the PM, using the prepared zip and runbook. · User direction. · User
- **D-013** · 2026-11-02 · Discord invite URL: `https://discord.gg/thunderclap` (single constant in content). · User
- **D-014** · 2026-11-02 · "Always a choice" is enforced in its achievable form: no softlocks, never two consecutive single-door states before the finale, earliest single door after 7 solves, ≥ 90% of states with 2+ doors (tested exhaustively over 293 states). The strict form is provably impossible with single-source capabilities (`docs/design/progression.md` §3). · PM accepted progression-content's proof. · PM
- **D-015** · 2026-11-02 · Pitch lines over 20 words are kept verbatim and shown as multiple caption cards instead of being reworded. `TIP_JAR_URL` stays blank (button hidden) until there's an itch page; on Pages it may later point to itch. · PM
- **D-016** · 2026-11-02 · **WebGPU in the itch iframe is confirmed working** (Chromium + WebKit, live itch frames; no browser implements a `webgpu` permissions-policy feature). Firefox needs a manual check at launch. See `docs/research/itch-webgpu.md`. · ship-ops research. · PM
- **D-017** · 2026-11-02 · Storage rules: all classic itch games share one `localStorage` partition, so every key is namespaced (`thunderclap:last-rune:*`, engine/save), and we never call `localStorage.clear()`, and access is try/catch with in-memory fallback (already in engine/save). Page copy says progress is saved in this browser only. · PM
- **D-018** · 2026-11-02 · itch embed settings: 960×540, click-to-play on, fullscreen button on, scrollbars off, mobile-friendly off (v1), **SharedArrayBuffer never on** (it changes the origin and wipes saves), pricing "$0 or donate". · PM
- **D-019** · 2026-11-02 · CI (`ci.yml`) gates push/PR with check + build + itch package. The e2e workflow is manual-only until it has several green runs on GitHub. · PM
- **D-020** · 2026-11-02 · Rules spec adopted as written in `docs/design/rules.md`: 1 bolt = 4 sparks (1×/2×/4× = 4/8/16), empty socket breaks the circuit, Gate = two perpendicular inputs in the same strike → sum, Capacitor = bank on first strike and release stored+incoming on the next, overcharge trips the breaker. Tier-1 machines demonstrate their gem pre-set on the altar before granting it. · PM
- **D-021** · 2026-11-02 · Fun and a real difficulty curve are first-class goals. A standing difficulty-fun workstream tunes the puzzles against a target curve using solver metrics, a novice bot, and later local-only playtest data. · User direction. · User
- **D-022** · 2026-11-02 · Difficulty score adopted (`rules/difficulty.ts`): a ridge fit to designer estimates of first-time minutes, from novice-bot tries, search bits, required concepts, min gems and solution count. The tier bands in `content/puzzles/targets.ts` are **provisional**. Tests lock the *shape* (tiers rise, finale highest), not absolute minutes. Refit from Phase 2 playtest data (local-only metrics + the user's playtest) before M4 exit. · PM
- **D-023** · 2026-11-02 · GitHub Pages deploys on every push to main (plus manual runs for labelled releases). Pages always reflects main; the alpha/v1.0 milestones become labelled runs + GitHub Releases rather than first deploys. · User
- **D-024** · 2026-11-02 · Auto-formatting on. Project hook `.claude/settings.json` runs `biome check --write` on each file Claude/agents edit (silent, never blocks); `pnpm fix` for the whole repo. CI and `pnpm check` stay strict. · User
- **D-025** · 2026-11-02 · Optional settings fields `graphics` ('auto'|'high'|'low', missing = auto) and `textScale` (1 | 1.25 | 1.5, missing = 1). Old saves load unchanged. High is fixed resolution (today's image); Auto uses dynamic resolution (floor 0.6) and drops to Low if needed. · PM
- **D-026** · 2026-11-02 · Altar keyboard: arrows slide over carved stone; new `jump` action (G / pad R3) moves the cursor to the wire's open end and cycles. full-run plans placements for minimum presses (`tests/e2e/altar-keys.ts`), so key counts are a best-case planner, not a script. · PM
- **D-027** · 2026-11-02 · Principle: **intuitiveness matters.** A first-time player must understand the goal, the target and every piece without a manual, and every visual (glyphs, previews, labels) must tell the truth about the rules. Playtest confusion is a bug and goes to the top of the queue. Every workstream verifies its work through fresh-eyes screenshots. · User
- **D-028** · 2026-11-02 · Altar teaching (onboarding-2): gem info cards never cover the board; they sit over the tray band on hover/focus/held, or for 7 s on arrival (cut short by the first placement). Fixed gems: iron brackets + a cold-iron ring + "Fixed in place"; gold is reserved for things the player acts on. A turn badge appears where turning is first taught (furnace Bend, foundry Gate). Strike-ready means "the route reaches every machine", including a Capacitor's later release, never "exact". · PM
- **D-029** · 2026-11-02 · One altar input rule (turn-clarity, from user playtest): click/Enter/A picks up and sets down and never turns; R/Q/scroll/RB turn the gem under the cursor (the held gem, drawn as a ghost in its target socket, or a placed Bend/Gate). A gem that can't turn says so at that gem; nothing else turns in its place. Replaces click-to-turn. splitter-mill storm moved W→N so the storm no longer shares an edge with a machine (solution count unchanged). · PM
- **D-030** · 2026-11-02 · Amends D-029 (turn-2, from user playtest): R/scroll turns the gem you see under the pointer. A placed gem turns in place and is saved at once, even with a gem in hand. The held gem is drawn only in empty sockets. A click never turns anything. The hand stays full after placing; clicking a different-kind placed gem still swaps. · PM
- **D-031** · 2026-11-02 · **Split turns and has one input (User).** "Not intuitive. I would rather it be one input and rotate like everything else." A Split becomes rotational like Bend and Gate. Its `rot` names its one input side, and the halves leave by the two perpendicular sides. A bolt entering any other side fizzles, as at a Bend. Suggested convention, mirroring the Gate: rot 0 takes input from S and outputs W and E. Fixed Splits in puzzles get a set rotation; tray Splits are turned by the player. Supersedes the "whichever way the bolt enters" Split row in rules.md §4. · User
- **D-032** · 2026-11-02 · **The ending: FUSE went to ThunderClap Gaming (User).** "Don't give details about the discord, just note that he found friends there… he isn't a bot on the server. Just a game character." Amends D-005. The ending shows no Discord details: no mock chat window, server or channel names, or member handles. FUSE goes through the door, and his three closing lines play as ordinary captions over the light, with a warm hint of a lively crowd. The title card says he went to ThunderClap Gaming and found friends. Credits name the author: **ThunderSoap**, owner of ThunderClap Gaming. The end-card invite link stays (D-013), labelled "Join ThunderClap Gaming". · User

## D-033: Capacitor shows charge in the preview; viewport stays zoomable (2026-11-02, PM)
- Capacitors are the one exception to "preview shows direction only": a dashed plan label states what each strike does (from the sim trace), on every altar with a Capacitor.
- Multi-strike altars: Needs cards say "in one strike"; storm pips on the Gives card and Strike button; 1.4 s between strikes; Capacitor card shows its full rule. rules.md storm pips = these.
- index.html drops `maximum-scale=1.0, user-scalable=no` (axe meta-viewport, WCAG 1.4.4). Accidental zoom is still blocked by `touch-action` and the gesture/ctrl-wheel handlers.

## D-034: Ko-fi support link on the title menu and end card (2026-11-02, user)
- User: "put a fun donate/buy me a coffee thing on main menu and end screen with my kofi: https://ko-fi.com/thundersoap".
- Plain link only, same rules as the Discord door (D-013): opens on click in a new tab, `rel="noopener noreferrer"`, never automatic. No Ko-fi widget, script, iframe, image or other runtime network call. The icon is procedural (CSS/SVG).
- Secondary to Play on the title and to "Join ThunderClap Gaming" on the end card. Keyboard and screen-reader reachable.
- URL lives in one constant in content (next to DISCORD_INVITE_URL).

## D-035: Codex unlocks on sight; engine SnapshotRenderer (2026-11-02, PM)
- Save gains optional `codex.met?: GemKind[]` (gems seen at any altar). SAVE_VERSION stays 1: `repairSave` backfills it from solved/started altars; a new game resets it. `codex.seen` still means "page opened" (NEW ribbon).
- Pages: Not met yet (name hidden, "?" tab) / Seen (full rule, "Restore the X to earn it") / Yours.
- Diagrams count charge in sparks like the altar chips (bolt of 4).
- `engine/render/snapshot.ts` SnapshotRenderer (offscreen one-frame render to ImageBitmap, same device) is accepted engine API; `installGpuErrorLogging` is idempotent per device.

## D-036: External links are an engine service (2026-11-02, user)
- User: "make sure our game engine logic can handle external links I think in a game this will come up a bunch".
- `engine/platform/links.ts` (logic, no DOM widgets) + an `engine/ui` link widget. No game nouns. Games pass URLs and labels.
- One API for every outbound link:
  - https-only allowlist check; blank or invalid URL hides the control;
  - open via a real `<a target=_blank rel="noopener noreferrer">` on click/key;
  - open via `window.open` on non-activation paths (gamepad), with blocked-popup detection → fallback;
  - copy chain: Clipboard API → execCommand textarea (itch frame, Chromium) → selected read-only field;
  - "Copied" feedback + aria-live; padnav-reachable;
  - never opens or copies without a user action; no network calls.
- Embed context (itch frame vs top level) is detected, not assumed. Facts: docs/research/itch-webgpu.md "Clipboard and popups".
- Game code (Join ThunderClap Gaming, Ko-fi, future links) uses only this API. Do not add per-game link handling.
- D-036 addendum (merge): the gamepad path uses `window.open` without `noreferrer` so a blocked tab can be detected; `opener` is nulled, and the browser default policy sends only the origin. Engine `input` now counts a repeat press of the same key on adjacent frames as a new press. PadNav routes A through `activateLink`.
