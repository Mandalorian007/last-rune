# Decisions

Format: `D-NNN · date · decision · why · who`.

- **D-001** · 2026-11-02 · Art is **fully procedural** (shaders, SDF, generated textures). No hand-painted or third-party art. · Agents can't paint; keeps licensing clean; fits the week. · User
- **D-002** · 2026-11-02 · **WebGPU only**, no WebGL2 fallback. Unsupported browsers get a clear message screen. · Simpler engine; matches pitch. · User
- **D-003** · 2026-11-02 · Repo `Mandalorian007/last-rune` (public). Single repo containing `engine/` + `games/last-rune/` per pitch §6. · User
- **D-004** · 2026-11-02 · Storage is **browser-only** (`localStorage`). The pitch's "Fly volume / Fly boot" is dropped for now. · Public repo, no secrets, static itch hosting. · User
- **D-005** · 2026-11-02 · Discord: **in-game ending only.** FUSE "living in the Discord" is lore. There is no bot. The invite URL is a single config constant: `https://discord.gg/thunderclap` (confirmed real by the user, 2026-11-02). · User
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

## D-037: Difficulty phase 2 on PM judgement (2026-11-02, PM)
- The user asked the PM to make the quality calls, and playtest data will come later. Puzzle tuning therefore follows designer judgement, with the solver metrics as a guide.
- Turn choice is scored as a **turn load** (Bend 0.5, Split 1, Gate 1, fixed gems 0, taken from the lightest-turning solution), weighted 0.08. The solver and the novice bot don't simulate wrong turns, because the route preview shows a refusing side with ✕ before Strike.
- Loose puzzles are tightened: press-unit-4 goes 9 → 2 solutions and capacitor-bay 11 → 1 (re-laid as a single lane from the south). conveyor-a stays at 4, because "either half works" is its lesson.
- Intake-desk's first visit has one FUSE card. The gem info card, the lit socket and the idle nudge do the rest of the teaching.
- Revisit with playtest times: roof-array and control-booth score the same (5.4); relay-tower → crane is the biggest step on the curve; conveyor-a introduces amber and magenta together.
- **D-038** · 2026-11-03 · **The ending returns to a Discord-style community hangout (User; amends D-032).** After playing alpha-1 the user said: "Our discord is actually more of a community hangout… you can do something a bit more fun. Also for emoji reactions don't just use colored circles should have actual emojis… The side bar in particular is the most interesting." Chose: bring the chat scene back, made fun, using the **real channel names** from the ThunderClap Gaming server (Community category: 👋 welcome, 🧑 introductions, 💬 the-hangout, 👀 supporter-sneak-peeks, 💬 supporter-chat, 🏆 events-and-contests, 🐈 furry-friends, 🍔 omg-food, 🎶 jammin-out, 🍜 otaku-oasis, 📚 book-worms, 🌱 watch-me-grow, ⚽ sports-ball, 🚗 gearhead). Constraints kept from D-032/D-005: FUSE is a game character, not a bot (no BOT tag); no real members' names or avatars apart from ThunderSoap (the author); other posters are clearly invented; no member counts; no network calls. Reactions are real emoji, drawn as system emoji text; that counts as text, not a third-party asset file. The invite link stays (D-013). · User
- **D-039** · 2026-11-03 · **Phones are supported (User).** "do some due diligence to support the mobile phone as well it's fine if it's horizontal only, but both would be cool." Landscape phones are a release target: the whole game is playable by touch from title to end card on a ~667×375 to 932×430 CSS-px landscape screen, with no keyboard. Portrait is a stretch goal. If a scene can't be made clear in portrait, it shows a friendly "turn your phone sideways" card rather than a squeezed layout. D-027 still rules: a phone player must get the goal, the target and each piece as clearly as on desktop. Touch targets are at least 44 CSS px. Key-cap hints become touch hints on touch devices. Safe areas (notch, home bar) are respected. Phones default to a phone-friendly perf tier. Same storage and network rules (localStorage only, no network calls). Real-device checks are with the user; agents use Playwright mobile emulation. · User
- **D-040** · 2026-11-03 · **Phone polish bar and mobile-3 calls (PM).** The user said "make the judgements and get the eval and work done and scheduled as the PM". The PM screenshot review of mobile-2 scored it 6/10 from four independent reviewers.
  - **Acceptance gate.** A phone build ships only after a fresh blind screenshot review scores ≥8/10 with no blocker or major issue. That means 4 reviewers, every scene, all 16 altars in play, at 4 realistic viewports, asked "is this a highly polished, intuitive, mobile-supported interface?". Passing rule checks is not enough.
  - **Socket pitch on the iPhone 844×340 viewport (47 px insets):**
    - 6×4 boards: ≥44 CSS px;
    - 8×6 boards: ≥38;
    - 10×8 boards: ≥30, with the existing loupe and snap for touch.
    - On SE (667×320), at least 90% of these.
  - On phones the altar camera frames the board plus its gauges and drops the decorative surround. Labels go beside gauges, not above or below them.
  - **Kept as designed (not phone bugs):**
    - fixed gems keep their dashed corner brackets;
    - the held gem stays held after placing, for repeat placement;
    - only legal sockets light while a gem is held, provided that matches the rules.
  - **Phone chrome:**
    - one close convention for overlays: a ✕ top-right, plus the existing Esc/Back;
    - controls ≥44 px tall or with ≥44 px hit areas, drawn ≥36 px;
    - title and hall art fill the width up to the safe areas;
    - the ending chat on phones is a single conversation view with a channel header, not a sidebar.
  - Desktop and iPad stay unchanged. · PM
  - *Addendum (mobile-3 review):*
    - Every phone overlay closes with a ✕ top-right (36 px drawn / 44 px hit), plus Esc/Back.
    - Destructive actions (Reset progress) are red and sit on their own row.
    - `ViewContext.phone?: () => boolean` is accepted.
    - The engine's `computeFillWidth` and `Surface.setFill` are generic, accepted engine API.
    - The hangout on phones has no dead controls: an info badge, not a chevron, unless it actually navigates.
    - Phone altar: ↻ Turn sits at the bottom of the left bar (Back/Undo/Clear/Turn), so the right column can hold the tray, card lane, FUSE and Strike. Phones use one even work light (no candles, fog or vignette); desktop and iPad keep the candle-lit look.
    - The old mobile-2 info-lane rules (`--lr-info-l/-w`) are dead on altars and can be deleted in a later tidy.
  - *Addendum 2 (gate review 1, 2026-11-03):* the blind re-review after mobile-3 scored 6, 6, 6.5 and 6.5, so the gate failed. The calls:
    - **Phone blocked cells.** On phones a blocked cell is not drawn as a socket at all (no disc or plate). Only real sockets show as holes. All 4 reviewers could not tell grey from navy.
    - **Fixed gems.** The "kept as designed" fixed-gem brackets are reversed. Fixed gems get a bolted-collar treatment on all platforms, because dashed brackets read as selection.
    - **Phone tray and labels.**
      - The tray hides types the puzzle starts with zero of; types depleted during play dim.
      - Gives/Needs labels use one two-line format.
      - Every gauge and label sits at least 4 px inside the play area.
    - **Menus and title.**
      - Settings scrolls (no "More ▾" dropdown look).
      - The Journal on phones drops "Back to the hall" in favour of ✕.
      - "Full screen" is hidden where the API is unavailable (iPhone).
    - **Hangout.** It has no inert input on phones.
    - **Hall.** The hall's welcome line must agree with the Start here marker.
    - **Next.** mobile-4-board and mobile-4-chrome, then gate review 2.
    - mobile-4-board result: the fixed-gem treatment is a dark iron collar with four rivets (overlay state `collar`) on all platforms; dashed brackets are retired. The unused phone `plate` socket state may be deleted in a later tidy.
  - **Addendum 3 (gate review 2, 2026-11-03).** Blind scores were 6 / 6 / 6.5 / 6.5, so the gate failed again. The PM checked every issue against the screens.
    - **False issue.** "The pre-placed Gate gem is never named" is a capture artefact: the captures seed every altar as solved, so first-appearance teaching (`teach.ts`) never shows.
    - **Board calls (mobile-5-board):**
      - fixed gems must read as fixed at arm's length: the D-040 addendum 2 collar is too faint (3 of 4 reviewers);
      - the stone slab must enclose every socket;
      - the board fills the phone's height, using the right column's dead space on wide phones;
      - phone label text ≥13 px, with Gives/Needs numbers ≥15 px;
      - one rotate control on phones: the ↻ chip that overlaps the gem and board edge goes, and the rail's Turn button stays;
      - valid-socket rings show only while a gem is held;
      - multi-strike copy a newcomer can parse: what one tap of Strike does, and whether N is per strike;
      - Strike ≥12 px from the screen edge.
    - **Moments calls (mobile-5-moments):**
      - FUSE never replaces or covers the how-to hint;
      - a fail shows one message at a time (FUSE's quip waits);
      - the phone solve screen keeps the finished circuit readable (bloom toned down, no oversized gem over the board);
      - one result card holds the text, the journal scrap and Continue, with Continue ≥44 px tall;
      - captures show first-appearance teaching on a fresh save.
    - **Chrome calls (mobile-5-chrome):**
      - the hall gets door names on phones, legible lock and requirement state, and fills the usable width (no black side bands);
      - FUSE's hall bubble points at FUSE;
      - Settings never shows a half-cut row or header at the fold;
      - the Codex on SE shows the whole rule, formula included, without hidden overflow;
      - the hall exposes the Codex with a labelled control;
      - the title, end-card and hangout leftovers are fixed;
      - chrome text ≥12 px on phones.
    - **Kept:** the end card's Join/Ko-fi order (user decision D-034).
    - **Gate unchanged:** ≥8/10 average with no blocker or major issue.
    - **mobile-5 results (PM accepted):**
      - on phones, a placed gem leaves the hand (desktop keeps it);
      - the pitch floors are reset to the reached values, trading a little pitch on 8×6 and 10×8 boards for the 13/15 px label floors (The Last Rune: 26.4 px on SE, 28.9 px on iPhone);
      - the height-share floor is met on Android only; west/east 6×4 boards are limited by width.
  - **Addendum 4 (gate review 3, 2026-11-03).** Blind scores were 6 / 6 / 6 / 6.5 (average 6.1), so the gate failed a third time. Three rounds of trimming have not moved the score, so the PM calls a structural fix for dense boards. Every issue below was checked against `docs/design/screens/local/mobile-2/gate3/`.
    - **False issue.** FUSE repeating the Intake Desk line on The Last Rune is a capture artefact: that machine has no `arrive` line, and the capture falls back to the Intake Desk one.
    - **Zoom calls (mobile-6-zoom).** Dense boards are too small to tap: 4 of 4 reviewers, one blocker. 10×8 sockets are 24–29 px, and 8×6 boards about 30–36 px. Eight rows cannot reach 44 px in 320–380 px of height, so on phones a board whose fitted pitch is under 40 px gets a zoomed view:
      - placement happens at an effective pitch ≥44 px;
      - the whole board is always one gesture away, with a visible way back to the fit view;
      - Strike, the verdict and the solve are shown at the fit view;
      - desktop and iPad are unchanged.
    - **Board calls (mobile-6-board):**
      - the held gem is unmistakable: the tray tile lifts and is outlined, and a "Holding: Bend" style cue appears near the board;
      - valid-socket rings mark exactly the legal sockets, so every empty socket when any gem may go there (gate 3 showed a scattered subset: a D-027 rules mismatch);
      - empty sockets read clearly against the slab (a lighter rim and contrast);
      - wall cut-outs and blocked areas read as solid wall, never as black glitch rectangles or dead sockets;
      - gauges: the dial is ≥24 px, the Needs plate sits on a consistent side, and nothing touches the screen edge;
      - used-up (×0) tray gems read as "all placed", not as broken or locked.
    - **Moments calls (mobile-6-moments):**
      - the right column has one owner at a time, and tips, FUSE's speech, teach cards and verdict tags never overlap each other or board labels;
      - teach cards show a visible Next/Got it affordance;
      - the verdict tag never covers sockets;
      - rule copy uses words the game teaches. "Charge" is the one noun; "bolt", "fizzle", "stem", "arms" and "joined sides" go or are taught on screen. This applies to tray tips, teach cards, verdicts and the Codex text.
    - **Chrome calls (mobile-6-chrome):**
      - FUSE's title bubble never overlaps the logo (a regression on Android);
      - locked doors say what unlocks them in plain words, and the gem-pip strips and "+N" either explain themselves or go on phones;
      - the hall's top row isn't cropped;
      - the door tap card closes when the Menu opens;
      - Settings has no headers at the fold without content, and no duplicate "Graphics & Save" jump;
      - SE Codex and Journal text, arrows and ✕ are fully on screen;
      - the end card is centred and balanced, the clipboard is clear of the buttons, the subtitles have contrast, and "Back to the hall" is a clear button.
    - **Gate unchanged:** ≥8/10 average with no blocker or major issue.
  - **Addendum 5 (gate review 4, 2026-11-03).** Blind scores were 6 / 6 / 6.5 / 7 (average 6.4), so the gate failed a fourth time. The scores moved up, and the issues have shifted from "broken" to "unclear", but every reviewer still lists majors. The PM checked each issue against `docs/design/screens/local/mobile-2/gate4/`, `pm-review-altars/` and `mobile-4-chrome/gate4-*`.
    - **False issue.** The Android title is not clipped (`android/01-title.png` shows it whole).
    - **Zoom stays; the PM's call.** The Last Rune has about 10 rows in 320–380 px of height, so the fitted pitch is limited by height and no layout reaches 44 px. Reviewers object to losing context, not to zoom itself. mobile-7-zoom:
      - a minimap while zoomed shows the viewport, the source and the gauges;
      - Needs/Gives edge chips sit in a reserved gutter and never on cells;
      - the source and gauges are never half-cropped;
      - the edge arrows are ≥28 px;
      - the Holding pill never touches Menu;
      - Zoom is offered under the same rule on every phone.
    - **Teaching calls (mobile-7-teach).**
      - **Blocker (D-027):** the tray tip always describes the held gem, or nothing (`se/16-the-last-rune-held`: "Holding Channel" was shown with a Capacitor tip).
      - A teach card about a fixed board gem visibly points at that gem: a pulse on it plus a leader line or matching outline.
      - Fixed (puzzle) gems look fixed: a riveted bezel and a no-move cue. Your own gems don't have it.
      - Every gem rule gets a worked example in the Capacitor style ("in 4 → out 2 + 2"), and a mini diagram where it helps.
      - The "✓ placed" circles go. A ×0 gem shows as a dimmed silhouette with "all placed".
      - "Next ›" sits inside its card.
      - Only one panel shows at a time while teaching: no FUSE joke and no loose "Tap a gem" tab alongside a teach card.
    - **Strike and verdict calls (mobile-7-strike).**
      - Multi-strike results drop the "1:0 2:0" notation. Gauge chips stay compact ("got 0 / 20"), and per-strike detail goes in the right-column verdict in plain words ("Strike 1: 0 · Strike 2: 0, needs 20 in one strike").
      - The Strike button says clearly how many strikes are left ("Strike · 2 left" → "Strike again"). It is ≥56 px tall, inset from the edge, and gets a ready glow when every gauge is reached.
      - Before Strike, a gauge shows only whether the charge path reaches it (a lamp on or off, no numbers), so the puzzle isn't given away.
      - The red mark is a thick ring with a pulse.
      - The solve card doesn't cover the gauges.
    - **Hall calls (mobile-7-hall).**
      - Labels never collide with pills, rings or screen edges: the first-visit "Intake Desk" label, "Start here" over The Last Rune, the Next ring through "Relay Tower".
      - The open menu has a backing panel or scrim.
      - The locked popover says only "Locked: solve X first", carries FUSE's reason inside it, and avoids neighbouring labels; "● Gate" goes.
      - A "New pages" badge attaches to Menu.
      - FUSE's bubbles have tails and don't cover playable doors.
      - SE hall labels gain contrast and spacing.
    - **Ending calls (mobile-7-ending).**
      - Remove the "Plays by itself" pill or the "Tap to continue" contradiction.
      - The hangout fills the phone height (no 40–50% blank area).
      - The end card gets contrast and spacing.
      - The journal arrows sit near the book.
    - **Gate unchanged:** ≥8/10 average with no blocker or major issue.

## D-041: ThunderClap engine refactor adopted; v1.0 ships desktop and iPad first (2026-11-03, user + PM)
- **User direction (2026-11-03):** a major vision shift. Prepare the engine we will extract from this project for high-value future work, while still optimizing Last Rune for all kinds of platforms, wrappers and screen sizes. The user's plan is the Claude Doc "ThunderClap Engine Refactor Plan", imported to [engine/refactor-plan.md](engine/refactor-plan.md). The PM still organizes the work.
- **Agent cap raised:** up to 10 top-level agents, plus whatever each one spawns (user).
- **Phases** run in order, each ending at a gate the PM logs in STATUS.md:
  - 0: ship v1.0 and freeze;
  - 1: workspace, host layer and promotions;
  - 2: gestures, layout regions and phones (Last Rune 1.1);
  - 3: a 3D-ready render core with a 2D preset;
  - 4: Electron host (may run alongside 3);
  - 5: extraction.
  - The 3D and XR seams are built; 3D and XR content are out of scope until after Gate 5.
- **Phase 0, PM calls:**
  - mobile-7 lands where it stands: ending, strike, zoom and hall are merged. teach merges if green, otherwise its branch is parked.
  - **Gate review 5 is cancelled.** The D-040 phone gate moves to Gate 2 and judges the new layout model, not more patches on the scaled overlay.
  - v1.0 is for desktop and iPad. The current phone build stays reachable as it is and is not advertised.
  - v1.0 is released per shipping-itch.md: GitHub Release, tags `v1.0.0` and `engine-v0.1` on the same commit, and Pages.
  - **The itch upload stays manual, with the user (D-012).** It does not block Phase 1. ws/workspace may start on its branch early, but nothing from Phase 1 merges until the tags and baselines are on main.
  - **Committed baselines:** the regression baselines in `docs/design/screens/v1.0/` are an exception to "don't commit images". They cover every scene at 1280×720, 1920×1080 and iPad, with e2e timings and perf numbers. They are kept small, and nothing else in screens/ is committed.
- **The plan's open questions:** the PM's defaults, which the user confirmed on 2026-11-03:
  - package scope `@thunderclap/engine`;
  - the registry is decided at Phase 5;
  - Electron ships unsigned until the user has certificates;
  - portrait phones are a Phase 2 `LayoutSpec` form factor:
    - the chrome must work in portrait;
    - the altar in portrait is best effort and does not gate 1.1;
    - landscape stays the must (D-039).
- **Addendum 1 (2026-11-03, user + PM):** the phone altar zoom is removed entirely: button, badge, minimap, arrows, gutter chips, hints and code (`docs/workstreams/zoom-removal.md`).
  - Phones get their dense-board answer from the Phase 2 layout and camera model.
  - promote-ui no longer promotes `zoom.ts` to `camera2d.ts`; Phase 3's Camera builds `fitRect` itself.
  - Browser-zoom blocking and the loupe stay.
- **Addendum 2 (2026-11-03, user):** "The engine verifies platform testing. All product testing should remain in the game and we shouldn't need to re-verify platform capability testing." Split the tests by ownership:
  - **Engine (`packages/engine`):** unit tests plus an engine e2e harness on a noun-free test page. It proves platform capability once:
    - WebGPU init and loss;
    - surface and resize;
    - input, gestures, and the tap-vs-pan boundary;
    - layout regions, safe areas, form factors and orientation;
    - text scale and density tokens;
    - host link, copy, fullscreen and storage (quota, blocked, itch iframe);
    - lifecycle, pause and audio unlock;
    - browser-zoom blocking;
    - camera math.

    The viewports, devices and wrappers the engine supports form a matrix, and the engine's CI runs it.
  - **Game (`games/last-rune`):** product tests only. These cover rules, puzzles and solvability, teach and moments, copy, the flow (full-run), the D-026 press counts, a11y of game content, and the game's own visual baselines.
    - Game e2e runs at a small set of representative sizes and trusts the engine for platform behaviour.
    - It does not re-assert "fits every phone viewport", tap-target sizing math, iframe clipboard or resize handling.
  - **Migration:** `docs/engine/test-split.md` classifies every current spec and test. Each Phase 1–2 workstream moves the platform assertions it touches into the engine suite in the same branch, so no coverage is lost in between, then trims the game spec.
    - Gate 1 requires the engine harness.
    - Gate 2 requires the mobile-* platform checks to be engine-owned.
    - The D-040 blind screenshot review stays a product check.
- **Addendum 3 (2026-11-03, user):** "I don't really want tags on the repo, but maybe engine could have a cut release option that tags on the repo."
  - No routine tags. Gates are logged in STATUS, not tagged; the plan's per-gate `engine-v0.2.0-alpha.1` / `engine-v0.2.0` tags are dropped.
  - Engine releases go through `pnpm engine:release <version> [--tag] [--dry]` (`scripts/engine-release.mjs`):
    - it runs the checks, bumps `packages/engine/package.json`, dates the CHANGELOG and commits;
    - with `--tag` only, it creates `engine-v<version>`;
    - it never pushes.
  - Game releases need a tag only if they have a GitHub Release; that is the user's call per release.
  - Existing tags (user, 2026-11-03): `engine-v0.1` deleted, as no release used it; `v1.0.0` and `alpha-1` are kept because they back GitHub Releases. The engine at v1.0 is simply `v1.0.0`.

## D-042: Desktop host is Electron, not Tauri; desktop saves stay in localStorage (2026-11-03, PM)
- **Electron over Tauri.**
  - Electron ships its own Chromium, so desktop WebGPU behaves the same as Chrome on the web.
  - Tauri would use the OS webview: WKWebView on macOS, WebView2 on Windows and WebKitGTK on Linux. WebKitGTK has no usable WebGPU.
  - Cost: about 110 MiB per download (the macOS dmg is 114 MiB).
- **Storage.** The desktop build keeps saves in the page's `localStorage` on a fixed `app://bundle` origin, following the user's "storage is browser only for now". A file backend in `userData` is an open question for the user.
- **Local only.** Pages are served from `app://bundle` with a CSP. Every off-origin request is cancelled; links open only through `shell.openExternal`, and only for https.
- **Signing.** Builds are unsigned (user-confirmed under D-041).
- **Still open:** notarisation, the Linux AppImage sandbox under AppArmor, running the Electron e2e on Linux CI, and test runs of the Windows and Linux builds on real machines.
- Source: docs/workstreams/host-electron.md.

### D-041 addendum 4: Gate 2 does not wait on the altar line count (PM, 2026-11-04)
Two altar ports (port-altar, port-altar-2) moved input, magnify and rails onto the engine with no phone regression, but stopped short of the tray/gem-card/lane column: it is drawn and hit-tested on the canvas in design px and needs its own canvas↔region hand-off. The phone experience is what the user tests, and it is unchanged or better. So Gate 2 (D-040 blind review, real-phone retest, Last Rune 1.1, engine 0.2.0) proceeds now; deleting `phone-styles.ts` and getting `altar-scene.ts` under 2,000 lines move to ws/port-altar-3, scheduled after Gate 2 as refactor debt. Phase 3 (second game) must not start until port-altar-3 lands, so the second game never copies the phone special-cases.


### D-040 addendum 6: gate review 5 (Gate 2 blind review, PM, 2026-11-04)
Blind scores were 6.5 (SE), 6.5 (iPhone), 7 (Pro Max) and 6.5 (Android), average 6.6, so Gate 2 failed. The PM checked the issues against `docs/design/screens/local/gate5/`.
- **Confirmed majors (all four reviewers unless noted).**
  - The right column collides with itself. On SE (and on iPhone for Storm Cell II), the teach card puts "New here / Got it" beside the text, so the text wraps one word per line and runs under Strike (`se/10-foundry`). "all placed" under a used-up tray gem is cut by the gem card or drawn over the next gem (`12-press-unit-4-held`, `13-capacitor-bay-*`). Teach leader lines run through gauges and "Needs" labels (`10-capacitor-bay`, `10-relay-tower`).
  - Two-line goal labels ("Needs 20 / in one strike") spill out of their pills (`10-the-last-rune`).
  - **Text contradicts the board (D-027).** The over-charge hint is a fixed string, "Skip an Amplify, or halve it with a Split" (`scenes/altar/strike.ts:283`). Capacitor Bay has no Amplify.
  - Fixed (puzzle) gems still read like your own gems (3 of 4). The D-040 addendum 5 riveted bezel is too faint on Channels and Bends (`10-control-booth`, `10-the-last-rune`).
  - Turn is never explained: no card says what it rotates.
- **Majors downgraded by the PM.**
  - *Sockets under 44 px on The Last Rune, Lift Shaft and Archive.* These boards are limited by height, not width (addendum 5). The magnify loupe (port-altar part 1) provides touch precision, which still screenshots can't show. Call: the board must use all the height and width its region allows. The real-phone retest judges tapping.
  - *Charge badges inconsistent.* They show on some lit paths and not others. This is a rule-legibility issue: make the rule consistent and visible, or remove it.
- **PM call: port-altar-3 moves into Gate 2 (reverses part of D-041 addendum 4).** Every confirmed layout major lives in the tray/gem-card/lane overlay that port-altar-3 replaces. A sixth round of patches on `phone-styles.ts` would repeat gate reviews 1–4. The column moves to regions with a card that cannot collide.
- **Work.**
  - ws/port-altar-3: the column on regions plus every layout major.
  - ws/altar-truth: hints, preview, badges, Turn, fixed gems, Undo and copy.
  - ws/chrome-polish-3: the chrome minors.
  - Then blind review 6 on a fresh gate6 set.
- **Gate unchanged:** ≥8/10 average with no blocker or major issue, then the real-phone retest.


### D-040 addendum 7: gate review 6 (Gate 2 blind review, PM, 2026-11-04)
Blind scores were 7 (SE), 7 (iPhone), 7 (Pro Max) and 7 (Android), average 7.0, so Gate 2 failed again (up from 6.6). Every layout major from addendum 6 is gone: no collisions, pills fit, the verdict shows its Try line. The PM checked the issues against `docs/design/screens/local/gate6/`.
- **Confirmed blocker or major (all four reviewers): the solve screen contradicts the rules (D-027).** In `20-solve`, the Furnace reads "restored" with the Channel at (1,2) drawn horizontal inside a vertical run. `12-furnace-held` draws it vertical. Channels are not rotational; they lie along their run. So the solve render chooses a different direction than play. The built-in Amplify off the path glows full gold, and built-in gems lose their collar and padlock at the solve moment. Bloom whites out the glyphs on solve and on fail (`13-capacitor-bay-multi`). → ws/solve-truth (started at once).
- **Confirmed majors.**
  - *Gem glyphs hide the rule (4/4).* The Split's no-arrow end and the Gate's input stubs are faint and lost under glow. The tray ×N badge covers the Split's no-arrow end and the Gate's bottom input. Gems at ×0 turn into different-looking dark blobs. The Capacitor at ×1 looks disabled. Holding a gem lights every socket at full cream, which drowns the circuit. → ws/glyph-truth, after solve-truth (both touch gem rendering).
  - *Advanced gems are taught in compressed one-liners (4/4).* Gate ("both sides": which?), Split and Capacitor. Multi-strike is learned by failing. The gauge dot (empty, cyan, red) is never explained. Nothing says Channels lie along their run, so a dim Turn while holding a Channel reads as broken. → ws/teach-4: in→out mini diagrams on the cards like the codex, a two-strike strip for the Capacitor, a first-time line for the gauge dot, a line saying "Channels lie along their run", Strike named in the first teach. Sums and units must not wrap mid-expression ("8 + 8 = 16", "Needs 20 in one strike").
- **Majors held at the addendum 6 call.**
  - *Small sockets on dense boards (4/4).* The Last Rune is height-bound (10×8, about 31 px pitch on Android). Width in the right column does not raise pitch. The small-target loupe stays (zoom-removal kept it) and does not show in stills. The real-phone retest judges tapping. If the user's retest finds mis-taps, that becomes the 1.1 blocker.
- **Open product question for the user:** a live "will get N" on each gauge before Strike. Three of four reviewers asked for it. It changes the puzzle from predicting to reading, so the user decides. Until then teach-4 explains the existing dot.
- **Minors** (hall dots and lines, title button weight, end card primary button and "Time on site", journal caption, FUSE position): → ws/chrome-polish-4.
- **Gate unchanged.** After solve-truth, glyph-truth, teach-4 and chrome-polish-4 land, run blind review 7 on a fresh gate7 set.

## D-043: Strike is a free test, no live readout; cover art from the game; menu flow is PM's call (2026-11-04, user + PM)
- **No "will get N" readout before Strike (user).** The puzzle stays predicting, not reading. Instead the game must frame Strike as a free, educational test: you can strike whenever you like, a miss costs nothing, and the verdict shows clearly where the charge went. The user judges today's verdicts already clear. → ws/strike-free: teach "Strike to test; a miss costs nothing" on the goal/strikes page and on the first miss; verdict copy reads as information, not failure; drop the "Attempt N" and "try N" counters from the altar (keep `attempts` in the save for stats only, never shown as a score).
- **itch cover art (user).** 8 cover candidates, made with the game's own renderer and styling (procedural scenes, our palette and type), not an outside image generator. Each aims at the itch browse grid: readable title at thumbnail size, one clear focal point (FUSE, a lit bolt through the altar, the hall), bright contrast against itch's dark UI. Hosted for review on GitHub Pages at `/cover-image/`, rendered live in the browser with a PNG download per cover (630×500, and 315×250 to judge thumbnails). No image binaries committed. → ws/cover-art.
- **Menu flow is the PM's call (user).** The PM audits title → hall → altar → solve → ending and the settings, codex and journal entry points, and cleans up as needed. Journal joins the altar menu if it fits the SE without crowding (players reread pages that land at the solve). → ws/menu-flow.
- **Gate 2 order:** blind review 7 waits for glyph-truth, strike-free and menu-flow, because all three change what a phone player sees. cover-art does not block it.

### D-043 addendum 1: cover pick (user, 2026-11-04)
The itch cover is #8 **fuse-portrait**: FUSE by candlelight, his eye on a glowing gem, the gold title and "A gem-circuit puzzle". The other seven covers and the hosted `/cover-image/` page come down. The cover stays reproducible from source with `pnpm cover`, which writes `build/last-rune-itch-cover.png` (630×500, git-ignored). → ws/cover-final.

## D-044: External architecture review adopted; one overlay is the Phase 3 entry condition (2026-11-04, user + PM)
The user brought an external review of the engine at 0.2.0-alpha.1 (full text: `docs/engine/review-2026-11-04.md`). It confirms the package boundary, `Host`, the pure Layout functions, Gestures, the generic `createGame()`/`EngineCtx` layering and the D-041 add. 2 test split, and ranks five debts. Adopted as written:
- **Protect what is right.** `ARCHITECTURE.md` (today vs planned, per phase) is updated in the same branch as every public API change; the PM checks it on merge.
- **One overlay before the camera (debt 1).** `ctx.ui` becomes CSS px on every form factor and `createCssChrome`, `legacyScale` and `avoid()` are deleted, so panels and toasts never move between roots. This is a Phase 3 **entry condition**: ws/camera does not start until it is merged. → ws/one-overlay (PLAN 9.5).
- **ws/camera absorbs debts 2 and 3.** It delivers the matrix `Camera` with `fitRect` fed by `layout.freeRect`, and in the same branch deletes `device: DeviceMode` and `fillBands` / `setFill(key)` from `EngineCtx` (and `platform/device-mode.ts`). The dense phone board is answered here.
- **ws/render-call absorbs debts 4 and 5.** `Renderer.render(frame, camera, target)`; `Host.requestFrame` (rAF on web and Electron, `XRSession.requestAnimationFrame` later); `GameLoop` takes its frame source from the host. The `Host` change is logged in DECISIONS and `CHANGELOG.md` when it lands.
- **No Forgewilds engine work until Gate 3.** It would inherit the two-overlay model and the fixed pipeline. PLAN row 17's "Forgewilds ws 1" starts after Gate 3.
- **Timing (PM).** ws/one-overlay starts now in a worktree, because phones already run CSS px and Gate 2 judges phones. It is **held from main** until blind review 7 is compiled, and must keep the desktop and iPad baselines (`pnpm baseline`) unchanged, or within the baseline tolerance with each diff explained. ws/camera and the other Phase 3 rows wait for it and for Gate 2.

### D-040 addendum 8: gate review 7 (Gate 2 blind review, PM, 2026-11-04)
Blind review 7 on `gate7` (main after glyph-truth, teach-4, chrome-polish-4, menu-flow, strike-free and strike-free-2) scored **7 / 7 / 7 / 7** (SE, iPhone, Pro Max, Android), so Gate 2 fails again. All four say the art, the chrome, the failure feedback and the teaching are close to shippable, and the visuals match the rules wherever they traced them. They agree on:
- **Dense boards are too small (1 blocker, 3 major).** Pitch is about 26–31 px on The Last Rune, about 30–33 on Lift Shaft and Capacitor Bay, and about 33–39 on Archive and Control Booth. Meanwhile the right ~40% of the screen holds only the tray, one card and FUSE. The magnify loupe exists, but no still shows it. A 10×8 board on a 320 px-high SE at full height can't reach 44 px. **Call:**
  - the board takes the space: full height, with the column shrinking on dense boards;
  - hit areas larger than the ring;
  - badges and the source orb clear of neighbouring sockets;
  - a held-aim shot with the loupe added to the gate set.

  → ws/dense-board. This is the external review's debt 3 seen from the product side. It is done with today's `layout.setForms` and `surface.setFrame`, without pulling ws/camera forward.
- **"Strike (2 left)" reads as a lives counter (4/4 major).** That contradicts D-043. It becomes "Strike ×2", with two pips that light one per pulse. The Capacitor card says that one tap sends two pulses and that a miss resets for free. → ws/teach-5.
- **Teaching cards (3/4).**
  - The Split and Gate diagram cards wrap into a narrow column ("Power / the no- / arrow end").
  - Amplify's "once per path" has no picture.
  - The Furnace line about Channels is cryptic.
  - The Needs dot (hollow, lit, red) is never explained.
  - The Capacitor warning is clipped.

  → ws/teach-5. There is still no "would get N" readout (D-043 stands).
- **Orientation on the board (3/4).**
  - The Split's input end and the Gate's input sides blur at board size.
  - The Channel's tray icon flips orientation between levels.
  - Some locked Channels look drawn across their run (Splitter Mill r2c1, the Lift Shaft rows).
  - Turn, Undo and Clear have no disabled state.
  - The teach callout's leader line through the lock badge reads as ⊘.

  → ws/glyph-truth-2.
- **Minors**, folded into the workstreams above:
  - the solve card shows no "got 8 ✓";
  - the ending has no visible skip;
  - the ☰ menu covers the hint;
  - the title FUSE box is oversized.

  → ws/teach-5.
- **Gate unchanged:** an average of at least 8 with no blocker or major issue, then the real-phone retest. ws/one-overlay stays held until these three workstreams have merged and blind review 8 is compiled.
- **Addendum 8a (PM, on the teach-5 merge):** the ending can be skipped on every viewing, the first included (Skip button and Esc). The rule against skipping the first viewing came from the design doc, not from a user decision. Blind review 7 flagged the missing skip as a phone issue, and a player who can't skip is worse off than one who skips the twist. `docs/design/ending.md` is updated to match.
- **Addendum 9 (PM, blind review 8, 2026-11-04):** SE 8, iPhone 7.5, Pro Max 7.5, Android 7.5 (avg 7.6). No blockers. Gate 2 not passed (majors remain). Up from 7/7/7/7. Majors and their routes:
  - (a) Gauge-dot language: only red is captioned in shots; cyan read as "exact"; the hollow ring reads as "0". → ws/teach-6. D-043 holds: the dot means "charge reaches it", no number and no "will be met".
  - (b) Two-strike rule: "in one strike" is ambiguous; ○○ on Strike is unexplained; the Capacitor card's "stores 8 →" dangles. → ws/teach-6.
  - (c) Gate card copy and break ("both sides of the arrow"). → ws/teach-6.
  - (d) A lit Bend reads as a T on the solve screen (the elbow stub glows past the turn). → ws/glyph-truth-3.
  - (e) Dense boards still tight (The Last Rune on iPhone, Pro Max and Android). The board uses about 55% of the width while the right column is mostly empty; the loupe covers the cells around the target; the "Needs 20" label sits a row from its gauge. → ws/dense-board-3.
  - (f) Turn is never shown enabled, and 14-* teach shots duplicate 10-*. → shot coverage in ws/polish-8.
  Minors go to the same streams (Amber/Amplify naming → teach-6; torn carved edges and small-size Split/built-in contrast → glyph-truth-3; source orbs clipped at the bottom → dense-board-3; hall label over "Start here", title FUSE cut, candle over links, Strike lit under the open menu, stray diamond on the solve card → polish-8). Reviewer asks for a "will get N" readout are declined under D-043.
- **Addendum 10 (PM, blind review 9, 2026-11-04):** SE 7, iPhone 7.5, Pro Max 7.5, Android 7 (avg 7.25). No blockers. Gate 2 not passed. Down from 7.6: the review-8 majors (a)–(f) are fixed and not raised again, but new ones surfaced. All four reviewers raised (A) and (B). Majors and their routes:
  - (A) A held Split's orientation can't be read: the selection glow washes the tray icon white, so Turn shows no visible change, and nothing previews the gem on the aimed socket. → ws/held-gem.
  - (B) "in either strike" reads as "each" or "one of them" (the second wording to fail, after "in one strike"). The result shows strike 2 only; strike 1 and what the Capacitor stores are text-only. → ws/teach-7. Rule wording: "on strike 1 or 2" ("on any strike" when there are 3 or more). After Strike, each gauge shows what it got on each strike. This is a result, not a forecast, so D-043 holds.
  - (C) Split and Gate look alike at board size, and their arrows mean opposite things (the Gate's inputs read as outward arrows). → ws/held-gem: arrows always mean out, and inputs are drawn as inward ports.
  - (D) The Gate is explained two ways (Relay Tower card vs Foundry chip). → ws/teach-7: one sentence everywhere.
  - (E) Amplify's "once per path" rule is text-only. → ws/held-gem: a lit Amplify that won't double is drawn idle (no number).
  - (F) Late-board sockets are about 30–37 px, the magnifier covers the "Needs" label and the hint card, and on the SE the reviewer thinks it sits under the thumb. Pitch is at its landscape ceiling (dense-board-3: iPhone ≤ 39.6). The loupe staying clear of labels and cards → ws/polish-9; anything beyond is the Phase 3 camera (D-044). Not a Gate 2 fix.
  Minors (three reviewers): the gauge needle never moves, so it looks like a meter → ws/polish-9 (it rests at zero and swings to what arrived after Strike). Also: blocked cells look like square sockets and dark marks on wall blocks look like glitches → ws/held-gem; "keeps 8" → "stores 8" and "Try again" → ws/teach-7; the stray emoji in the hangout header → ws/polish-9. Declined: a three-state "too little / exact" dot (D-043); moving the coffee link or the end-card community buttons (user decisions).
- **Addendum 11 (PM, blind review 10, 2026-11-04):** SE 7, iPhone 7, Pro Max 7, Android 7 (avg 7.0). No blockers. Gate 2 not passed. The review-9 fixes held: the held gem, per-strike results, one Gate sentence, the needle and the loupe keep-clear weren't raised again, and the round port and arrow on Split and Gate read correctly at codex size. What's left is the same three themes as before plus one regression, so this round fixes them structurally, not with more rewording. Majors and their routes:
  - (A) Multi-strike target still ambiguous (3 of 4): "on strike 1 or 2" still leaves open whether it means both or either, and whether the other strike can be anything. This is the third wording to fail. → ws/teach-8. One phrase, tested against the sim: gauge note "Needs 8 on one strike". The rule, stated once on the teach page and the Strike ×2 card: each strike is checked on its own; exactly 8 wakes it, less does nothing, more trips it. Result labels name each strike ("1: 0 · 2: 16 ✕"). The Capacitor plan's pre-Strike "Strike 2 sends 16; needs 8" is a forecast, so it goes (D-043).
  - (B) Regression: codex pictures for two-way gems (Channel, Bend) carry a round port in and an arrow out, which contradicts "either way" (2 of 4). → ws/glyph-truth-4. Port and arrow appear only on one-way gems (Split, Gate). Two-way gems show plain ends both sides. The Capacitor needs a visible straight-through line (no ports).
  - (C) Pieces met without a lesson: Splitter Mill's fixed Split gets only a FUSE joke; Foundry's Gate has no picture; "same strike" appears in single-strike rooms; "once per path" is undefined (3 of 4). → ws/teach-8. Every piece gets its picture card the first time it appears, fixed or in the tray. The Gate sentence drops "same strike" where there's one strike and says what one port alone does. Amplify defines "path" in plain words.
  - (D) Dense boards (Archive, The Last Rune, Lift Shaft) are hard to read and tap, and the loupe hides neighbours (3 of 4). Pitch is at the ceiling for the current column. Reviewers point at the lever not yet pulled: the right column (tray, hint, empty wall) takes ~40% of the width. → ws/dense-board-4. On dense altars, slim the column (tray as a compact strip, the hint card behind a tap) and give the width to the board, and keep the loupe smaller and off the aimed neighbours. Not the camera; that stays Phase 3.
  - (E) Split's round port reads as a highlight at board size, Split vs Gate is told apart mainly by colour, and Capacitor vs Channel are close in hue (Pro Max). → ws/glyph-truth-4: a hollow ring with a dark rim for the port, distinct silhouettes, shape (not just hue) for the Capacitor.
  Minors → ws/polish-10: the aim ghost reads as placed (make it translucent), ×0 tray gems shrink and brown (keep colour, mark spent), "each lighting a mark", portrait Settings over Play, menu cutting off the hall label, the Capacitor in single-strike Control Booth (check it's an intended decoy and the card says so). Android's "first gem drops the hold" is checked by polish-10. Declined: showing the live charge path or dimming unreached gems before Strike (D-043: no forecast); moving the coffee link or reframing the hangout (user decisions); "Next" order in the hall (by design: next unsolved in story order).
- **Addendum 12 (PM, blind review 11, 2026-11-04):** SE 7, iPhone 7, Pro Max 7, Android 7 (avg 7.0). No blockers. Gate 2 not passed: third round in a row at 7. The review-10 fixes held: no one raised the codex port/arrow regression, Split vs Gate by colour only, Splitter Mill's untaught Split, or the pre-Strike forecast again. What remains:
  - (A) Regression from teach-8: the new "Again" cards overflow on the SE (Roof Array's Capacitor line runs off the right edge, Press Unit 4's Amplify line is clipped at the bottom), and the "Again" label reads as a replay button (4 of 4). altar-column's no-clip check did not catch it.
  - (B) Dense boards (The Last Rune, Lift Shaft, Archive, Capacitor Bay): pieces too small to read port direction, and the loupe still covers the neighbours on The Last Rune (4 of 4). dense-board-4 reached +12.5% on SE Archive only; The Last Rune is height-bound, so a slim column cannot fix it. This is the Phase 3 camera (D-044).
  - (C) Wording still asked about: "on one strike" (4 of 4, major for 2), "A second Amplify doesn't double again" (3 of 4), "○○ ○○ = your two strikes" (3 of 4), the Capacitor card's fixed numbers, the Control Booth decoy being gold-ringed in the tray (Pro Max), the tray Capacitor drawn vertical vs horizontal on the board (Pro Max).
  - PM call: rewording has not moved the score for three rounds, and the biggest remaining major (B) needs the camera. Iteration stops here; the user chooses between a real-phone check now and bringing the Phase 3 camera forward. The regression (A) and the small copy items in (C) are fixed either way. Decided (PM, same day): Phase 3 comes forward. polish-11 fixes (A) and (C); one-overlay is rebased and merged, then ws/camera starts with The Last Rune and Lift Shaft as its acceptance boards; blind review 12 follows the camera.

## D-045: The save records which gems have been taught (2026-11-04, PM)
Proposed by teach-8 (D-040 add. 11, major C). The save gains an optional `codex.taught`, a map from gem kind to the altar whose arrival card taught it. It is written when an arrival card opens. Any gem kind on an altar that is not in `taught` gets its pictured card ("Again" if it was earned but never handled), whether the gem is fixed or in the tray and in any play order. Older saves load unchanged: a missing field means nothing has been taught yet. The field is stored in localStorage only, like the rest of the save. Also ruled with it: the Capacitor plan's red "this gauge will trip" warning before Strike is a forecast under D-043 and is removed. Per-strike results after Strike stay.

## D-046: Good enough beats more review; the user's phone test decides Gate 2 (2026-11-04, user)
User: "minimize review. Get phone ready for testing and I will try it. This is the very first game... get it functional, extract engine and then work towards next rather than over investing. I would rather make sure we have good enough then consider possible usage metrics."
- Gate 2's bar changes. No more D-040 blind phone reviews (review 12 is cancelled). The gate is the user's own real-phone test of the live Pages build. Blockers they hit get fixed; polish beyond that waits for real usage.
- ws/camera (zoom/pan for dense boards) is parked. It is reopened only if the user's phone test finds dense boards unplayable.
- ws/one-overlay is kept on its branch and is not merged before the phone test. desktop/iPad must not change (the user rates iPad highly).
- After Gate 2: extract the engine (`@thunderclap/engine` 0.2.0, usable by a next game) and move on to the next game. Usage metrics may come later. They need their own decision, because storage is localStorage-only and there are no runtime network calls today.


- **D-047** · 2026-11-04 · **itch.io is cut; GitHub Pages is the release.** The user asked why itch when GitHub hosts the game. Pages already hosts it top-level (no iframe limits) and deploys on every push. itch's only extras were discovery, a tip jar and comments, which this first game doesn't need (D-046). Removed from the game: the itch zip packager and validator (`pnpm package:itch`), the CI itch-zip step, itch-sim and `itch-release.spec`, and the cover tooling (`pnpm cover`, `games/last-rune/cover`). The CI job keeps its name "check + build + package" so the required check still matches. **The engine keeps itch as an option:** embed-context detection, the clipboard fallbacks and the cross-site iframe row in `packages/engine/e2e` (wrapper.mjs) stay, so a later game could ship to itch. `docs/shipping-itch.md` and `docs/research/itch-webgpu.md` are kept for reference only. Supersedes the itch parts of D-010, D-012, D-015, D-018 and D-043 add. 1. · User

- **D-048** · 2026-11-05 · **Phones chain-place, like desktop.** The user, on a real phone, asked why phones set down one gem per pick when desktop keeps the gem in hand. mobile-5-board (blind review finding 6: the rings stayed, so it was unclear whether a gem was still held) had ended the hold on every place. Now phones keep the gem in hand while more remain. The Holding pill and the rings say so. Tapping the held tray slot or empty space lets go, and the hold ends when the last one is down. Turn still turns the gem just placed, and on phones the next copy in hand takes the same turn, so a chain runs one way. Desktop is unchanged. · User
- **D-049** · 2026-11-05 · **Teach cards open over the tray on phones, then minimise.** Real-phone finding: in Brave landscape with a tab strip (about 852×270 CSS), the arrival card squeezed under the tray, clipped and scrolled. On phones, cards now open as an overlay over the tray at a readable size (no scrolling) and can be closed. After a few idle seconds a card minimises to a pill, and a tap expands it again. Minimised is not dismissed (first-sight teaching kept). A short "phone in a browser with toolbars" viewport joins the phone test profiles. Workstream: ws/teach-overlay. · User
  - D-049 add. 1 · 2026-11-05 · PM, on the teach-overlay questions. (1) An open teach card may show while a different gem is in hand; the Holding pill names the gem in hand, so this relaxes D-040 add. 5 on phones. (2) FUSE stays quiet while a card pill is waiting, the same as the Rule tab. (3) The Rule tab shows on any short-lane phone. (4) Board taps fold the panel and still act; a short-lane verdict panel lets taps through. (5) Arrival cards follow D-045 play order, so Lift Shaft only shows the Capacitor card if it was not met first. · PM

- **D-050** · 2026-11-05 · **Share embeds use the old itch cover art.** The user wanted the itch cover as the link preview for Discord and similar apps, with good basic embed support. The cover renderer cut by D-047 is back as `pnpm social`, framed wide: `games/last-rune/cover`, `scripts/cover` and `vite.cover.config.ts` render the same FUSE-by-candlelight scene with the title at 1200×630. They write `public/social.jpg` (og:image, about 116 KB) and a 180×180 `public/apple-touch-icon.png` cropped from the gem. Both files are our own procedural render, committed and shipped with the Pages build. `index.html` carries description, Open Graph (absolute URLs, image size and alt), `twitter:card=summary_large_image`, canonical and theme-color. theme-color is the game's dark background, not gold, because iOS Safari tints its bar with it. `scripts/cover/social-embed.test.ts` checks the tags and image sizes. Regenerate after art changes with `pnpm social`. · User
- **D-051** · 2026-11-05 · **ThunderClap Engine gets its own public repo; The Last Rune stays on its in-repo engine.**
  - The user asked for a public `thunderclap-engine` repo with:
    - a clean, detailed README;
    - the engine code ported over;
    - a "Built with ThunderClap" section with a GIF and a blurb for The Last Rune.
  - The user's words: "do not remove the engine from this project. Just port the code… this product will remain on the original engine."
  - The user also said: "This game can be cited as the original inspiration that started work on the engine."
  - What was done:
    - `git subtree split` of `packages/engine` (29 commits, history kept) pushed to https://github.com/Mandalorian007/thunderclap-engine.
    - New in that repo:
      - standalone pnpm/Biome/tsconfig and CI (`pnpm check`);
      - `examples/hello` (`pnpm example`);
      - a 15 s gameplay GIF recorded from the production build: title, hall, Intake Desk, strike, solve.
    - Checks pass standalone: check (351 unit tests) and e2e (274 tests).
  - This is plan row 17's repo half: no npm publish and no tag.
  - The engine here (`packages/engine`) is unchanged and remains The Last Rune's engine.
  - Until the game switches to the new repo, the two copies are kept in step by hand. A change to the engine here is ported to the engine repo when it matters.

- **D-052** · 2026-11-07 · **The Last Rune moves onto the published ThunderClap engine (reverses D-051's "stays on its in-repo engine").**
  - The user: "Ignore the phone check. Coordinate the migration I would like this to be the first title on the game [engine]."
  - The game depends on `@thunderclap-engine/engine@^1.1.0` and `@thunderclap-engine/host-electron` from npm. `packages/engine` and `packages/host-electron` are deleted from this repo, along with their scripts and CI jobs.
  - The work is ws/engine-npm, built on ws/one-overlay (which already removed `ctx.chrome`/`CssChrome`/`avoid()`/`setRect`). Upstream also removed `ctx.device`, `setFill`, `computeFillWidth` and `fillBands`; the game frames `ui.layout.freeRect` with `renderer.camera.fitRect` instead.
  - The Gate 2 phone check (D-046) no longer blocks. The next release, v1.1.0 (desktop, iPad, phones), ships on the npm engine. It is the first title on the published engine.
  - Gates: `pnpm check`, `pnpm build`, game e2e, desktop e2e, and `pnpm baseline` against the v1.0 baselines (desktop and iPad must look the same; any diff is explained or fixed).
  - From here on, engine fixes go upstream to Mandalorian007/thunderclap-engine (PR or issue, never a node_modules patch), and Last Rune takes them with `pnpm up @thunderclap-engine/engine`. The hand porting of D-051 ends.
  - D-052 add. 1 · 2026-11-07 · PM, on merging ws/engine-npm (ed4fedc):
    - (1) Phones keep the fill framing through the game-side `games/last-rune/game/screen-fit.ts`. It uses only the engine's public API (computeLetterbox, computeBackbuffer, createDeviceMode). Engine v1 alone would letterbox phones. It stays until upstream adds a fill/cover mode.
    - (2) Baselines regenerated (`BASELINE_UPDATE=1`, 129 shots). desktop-720 and iPad differ by 0.2–4.9% from one-overlay's text and border rasterization. The desktop-1080 solve-card gauge now shows its red 100–125% zone, which matches the rules.
    - (3) `pnpm-workspace.yaml` stays as `packages: [.]`.
    - (4) Upstream asks filed on thunderclap-engine: a surface fill/cover mode, host-electron packaging and dev entry points, and a lower-specificity zoomed-select rule.
