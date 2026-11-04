# Test split: engine platform vs game product (D-041 addendum 2)

> Audit of 2026-11-03 against `main` at `a036840`. Documentation only: no test was moved or edited. Each Phase 1–2 workstream moves the rows assigned to it **in its own branch**: it adds the engine test first, then trims the game spec, so coverage is never lost in between.

**Rule.** The engine (`packages/engine`, today `engine/`) proves platform capability once: in unit tests, and on a noun-free e2e harness across the viewport, device and wrapper matrix below. The game (`games/last-rune`) tests product only, at a few representative sizes. It never re-asserts "fits every phone", tap-target maths, iframe clipboard, resize handling or lifecycle.

## Classes

| Class | Meaning | What happens |
|---|---|---|
| **ENGINE** | Platform capability (ENGINE-PLATFORM) | Moves to the engine suite (unit or harness e2e). Deleted from the game in the same branch. |
| **GAME** | Product: rules, puzzles, copy, flow, teach and moments, D-026 press counts, a11y of game content, game visuals | Stays. May shrink to the representative sizes. |
| **MIXED** | One test asserts both | Split: the platform assertions go to the engine, the product assertions stay. |
| **REDUNDANT** | Re-verifies what the engine will own | Deleted from the game once the engine row named lands. |
| **GONE** | Already being deleted by another workstream | No action here. |

## Summary

| | ENGINE | GAME | MIXED | REDUNDANT | GONE |
|---|---|---|---|---|---|
| e2e test blocks (128 incl. 2 skipped; the phone loops expanded) | 14 | 47 | 50 | 4 | 13 |
| Unit test files (59 under `engine/` and `games/`) | 20 (18 engine + `ui/text-scale`, `ui/place`) | 35 | 3 | 0 | 1 (`zoom.test`) |
| Perf harness specs (3) | 0 | 1 | 2 | 0 | 0 |

Expected game e2e after Phase 2: about **55 tests** (53 run; from 128), at five sizes instead of eleven. See [Runtime](#runtime-estimate).

Workstream keys: **P1** `ws/workspace`, `ws/host`, `ws/promote-ui`, `ws/create-game`. **P2** `ws/gestures`, `ws/layout`, `ws/port-chrome`, `ws/port-altar`. **P3** `ws/camera`, `ws/render-call`. **P4** `ws/host-electron`, `ws/last-rune-desktop`.

## Engine e2e harness (Gate 1)

`ws/workspace` creates `packages/engine/e2e/` with a noun-free page (`harness.html`). The page:

- boots a surface;
- draws a test pattern;
- mounts base widgets (button, slider, toggle, panel, `externalLink`, caption card) in an overlay;
- exposes probes for input, gestures, save, host and lifecycle.

It has its own `playwright.config.ts` with one project per matrix row. It reuses the itch-sim and the port-offset scheme from `tests/e2e/ports.ts`. The workstreams fill it in:

| Workstream | Adds to the harness |
|---|---|
| P1 workspace | Harness skeleton and CI job. WebGPU adapter sanity, the unsupported screens (no `navigator.gpu`, null adapter), non-black canvas. |
| P1 host | Wrappers: itch-sim iframe and click-to-launch. Open and copy through `Host` (granted, refused, missing, `execCommand` fallback, popup blocked, gamepad activate). Storage: available, blocked, quota. Fullscreen present or absent. |
| P1 promote-ui (done: e2e/ui.spec.ts) | Text-scale tokens 100/125/150 on base widgets. `menu-nav` pad focus. Rotate card on portrait phones. Device-mode flags (`data-touch`, `data-phone`). |
| P1 create-game | Resize and DPR mid-scene (overlay tracks canvas, buffer follows DPR). GPU device loss screen and halt. Lifecycle: hidden, pagehide and freeze flush the save and stop frames and audio, show resumes them. Audio unlock. Browser-zoom blocking. |
| P2 gestures | Tap vs pan boundary, long-press, drag origin and drag-off, `blocked()`, loupe and snap (`magnify`), all through real CDP touch on the phone rows. |
| P2 layout | Regions per form factor and orientation, safe areas, `freeRect`. No page scroll, no clipped text, everything on screen. `--tc-tap-min` 44 hit areas, `--tc-text-min` floors. Panel fits at 150% or scrolls to its last control. Caption lane never overlaps another region. Panel-stack spam leaves at most one panel. Focus returns after a panel closes. |
| P3 camera / render-call | `fitRect`, `screenToWorld` round trip on every row. A noun-free perf scene (camera-uniform cost). |
| P4 host-electron | Electron row: boot, open, copy, window controls, storage. |

### Engine matrix

| Row | Viewport (CSS px) | DPR | Input | Wrapper | Runs |
|---|---|---|---|---|---|
| desktop-720 | 1280×720 | 1 | mouse, keyboard, pad stub | top-level | all capabilities |
| desktop-1080 | 1920×1080 | 1 | mouse, keyboard | top-level | layout, text scale, resize |
| desktop-hidpi | 1440×900 | 2 | mouse | top-level | surface, DPR, layout |
| aspect-extremes | 1600×600, 1000×800 | 1, 1.5 | mouse | top-level | resize and letterbox only |
| itch-embed | 960×540 | 1 | mouse, keyboard | itch-sim cross-origin iframe | boot, host, storage, lifecycle |
| pages-subpath | 1280×720 | 1 | mouse | served under `/<repo>/` | boot, asset paths, storage |
| tablet-land | 1180×820 | 2 | touch | top-level | layout, gestures, text scale |
| tablet-port | 820×1180 | 2 | touch | top-level | layout (portrait form factor) |
| phone-se | 667×320, no insets | 2 | touch, coarse | top-level | layout, gestures, text floors, zoom block |
| phone-iphone | 844×340, inset 47 | 3 | touch, no Fullscreen API | top-level | safe areas, fullscreen absent, layout |
| phone-promax | 932×380, inset 59 | 3 | touch, no Fullscreen API | top-level | safe areas, layout |
| phone-android | 915×360 | 2 | touch | top-level | layout, fullscreen present, gestures |
| phone-full | 852×393 | 3 | touch | top-level, fullscreen | layout without browser bars |
| phone-port | 390×844 | 3 | touch | top-level | rotate card; portrait regions (P2) |
| electron (P4) | 1280×800 window | 1–2 | mouse, keyboard, pad | Electron shell | host, storage, window |

The variants run on the rows that care, not on all of them:

- text scale 100/125/150;
- `prefers-reduced-motion`;
- storage blocked or over quota;
- clipboard granted, refused or missing;
- popup blocked;
- gamepad only.

Chromium with WebGPU is the only browser in CI, as today. WebKit and Firefox join when their headless WebGPU works.

### Game representative sizes

| Size | Why | Used by |
|---|---|---|
| 1280×720, 100% and 150% text | The default desktop and the worst text case | full-run, a11y, altar, capacitor, codex, title, ending, robustness, layout-fit, altar-labels |
| 1920×1080 | v1.0 baseline, large desktop | layout-fit (one relay case each), visual baselines |
| iPad 1180×820 | The tablet form factor that v1.0 ships | visual baselines, one touch smoke |
| phone-se 667×320 | Tightest landscape phone | every phone product spec (moments, strike, hall, chrome, ending, touch play) |
| phone-iphone 844×340, inset 47 | Notch, for the board budget only | mobile-budget |

## e2e specs

Line numbers are the `test(` line on `main` at `a036840`. "×4" means once per phone in `PHONES`.

### Desktop and product specs

| Spec : line | Test | Class | Engine target | Who moves it | Notes |
|---|---|---|---|---|---|
| full-run :418–434 (6) | play order, 4 chunks, all solved + reload | GAME | | | The product's spine. Stays at 1280×720. |
| altar :111 | intake then furnace by keyboard, save | GAME | | | |
| altar-labels :12 | labels clear at 1280×720, 150% | GAME | | | |
| capacitor :64, :101 | two-strike read-out; no "got N" mismatch | GAME | | | |
| codex :44 | gem seen gets its page | GAME | | | |
| turn-clarity :89–189 (5) | Bend and Split turning by R, Q, click, scroll | GAME | | | Wheel and key delivery are engine (input unit tests already). |
| ending :153 | replay skips to the end card | GAME | | | |
| ending :23 | ending plays; ThunderClap link opens only on a click | MIXED | ui (`externalLink`), host | P1 host | "Opens only on a click" goes to the engine. The game keeps that the link is there with the right URL, and the whole ending. |
| title :29 | FUSE chatters, clear of menu, stops | GAME | | | |
| title :85 | quiet Ko-fi link opens only on a click | MIXED | ui, host | P1 host | Same split as ending :23. |
| a11y :51 | keyboard path with axe, strike announcement | MIXED | ui (focus trap, focus restore) | P1 promote-ui (done: e2e/ui.spec.ts) | axe on game screens and the live-region wording stay. Focus return after a HUD panel closes goes to the engine. |
| a11y :141 | solve, journal, end card with axe; Esc from a focused button | MIXED | ui | P1 promote-ui (done: e2e/ui.spec.ts) | Esc from a focused button goes to the engine; axe stays. |
| layout-fit :56 (×3 scales) | Settings fits 1280×720, Done on screen | MIXED | ui (panel fit and scroll × text scale) | P2 layout | The engine owns panel fit at 100/125/150. The game keeps 150% only (its Settings content). |
| layout-fit :78 (×3) | every Codex spread fits | GAME, shrink | | P2 port-chrome | Keep 150% only (worst case). |
| layout-fit :118 (×2) | fizzle tags never cover the verdict | GAME | | | |
| layout-fit :172 (×4) | relay one-arm, verdict and Try line whole | GAME, shrink | | P2 port-altar | Keep 1280@150 and 1920@100. |
| layout-fit :265 (×3) | top-row root: the verdict never hides the red mark | GAME, shrink | | P2 port-altar | Keep 1280@150 and 1920@100. |
| **layout-fit :334** (×5) | FUSE's caption keeps off FUSE, the verdict and the red mark | MIXED | layout (caption lane replaces `avoid()`) | P2 layout | The non-overlap guarantee becomes an engine region test. The game keeps 1280@150 only. Flaky under load: 5 → 1. |
| layout-fit :406 | the-last-rune 150%: storm card off board | GAME | | | |
| link-copy :196 | title Copy link puts the Ko-fi URL on the clipboard | MIXED | host | P1 host | Clipboard mechanics go to the engine. The game keeps "Copy link copies the Ko-fi URL". |
| link-copy :252, :279, :294 | refused clipboard → field; `execCommand` fallback; pad A with the tab blocked → field | ENGINE | host, ui | P1 host | Pure link-service behaviour. |
| link-copy :319 | end card: each Copy link copies its own URL | GAME | | | The URLs are product. |
| link-copy :373 | end card: no clipboard API, blocked pad open → field | REDUNDANT | host | P1 host | Covered by the host rows above. |
| link-copy :409 | itch embed: Copy link copies inside the iframe | ENGINE | host (itch-embed row) | P1 host | Addendum 2 names "iframe clipboard". |
| link-copy :468 (×2, skipped) | first-time-player screens | GAME | | | Opt-in capture (`LINK_COPY_SHOTS`), not in the suite. |

### Platform specs

| Spec : line | Test | Class | Engine target | Who moves it | Notes |
|---|---|---|---|---|---|
| smoke :19 | boots without console errors or failed requests | GAME | | | The game's smoke; keep. |
| smoke :28 | test browser exposes a WebGPU adapter | ENGINE | render | P1 workspace | Harness sanity belongs to the harness. |
| smoke :38 | canvas has non-black pixels | REDUNDANT | render | P1 workspace | The engine renders a test pattern; the game's visual baselines cover its own pixels. |
| smoke :57, :74 | unsupported screen: no `navigator.gpu`; null adapter | ENGINE | render, platform | P1 workspace | |
| smoke :88 | loads in a cross-site iframe with WebGPU and localStorage | ENGINE | host (itch-embed) | P1 host | |
| smoke :117 | click-to-launch at 960×540 | ENGINE | host (itch-embed) | P1 host | |
| lifecycle :95 | hidden flushes the save, stops frames and audio; visible resumes | ENGINE | core, platform, save, audio | P1 create-game | Uses `__game` only to write the save; the harness has a noun-free save probe. |
| lifecycle :115 | pagehide and freeze flush; pageshow restores | ENGINE | core, platform, save | P1 create-game | |
| robustness :91 | resize and DPR mid-scene keep canvas and overlay in step | ENGINE | platform (surface), render | P1 create-game (P3 render-call re-checks it through `Surface`) | The "verdict survives a resize mid-strike" tail is REDUNDANT. |
| robustness :133 | hidden tab pauses play time | MIXED | core (pause on hidden) | P1 create-game | The engine asserts the loop pauses. The game keeps that play time does not count, as a `game/flow` unit test, and drops the e2e. |
| robustness :164 | lost GPU device shows the reload screen above everything | ENGINE | render, platform | P1 create-game | Loop, audio and timer halt included. |
| robustness :269 (×5) | corrupt save (5 shapes) boots to the title and says so | MIXED | save | P1 host (storage moves under `Host`) | The engine unit-tests all 5 shapes. The game keeps 1 e2e (its notice text). |
| robustness :293 | old save without newer fields loads intact | GAME | | | Game schema migrations. |
| **robustness :328** | spamming Strike, Back, Enter never stacks scenes or panels | MIXED | ui (panel stack), input (repeat queue) | P2 layout | "At most one panel, Esc spam closes it" goes to the engine. The game keeps "12 × F = one attempt" and "solve card → hall once". Shorter and less flaky. |
| **robustness :375** | reload mid-strike keeps placements | GAME | | | Product. Flush-on-unload is proven by the engine (lifecycle), so this test needs no timing slack. Still slow under load. |
| robustness :445 | gamepad alone: title → Settings → Codex → altar | GAME | | | The product's pad path. The engine proves pad → action and `menu-nav`. |

### Phone specs

Today every phone spec runs ×4 (se, iphone, promax, android). Under the split the platform half goes to the engine matrix and the product half runs at phone-se, plus phone-iphone for mobile-budget.

| Spec : line | Test | Class | Engine gets | Game keeps | Who moves it |
|---|---|---|---|---|---|
| **mobile-budget :430** (×4) | phone budgets on every altar | MIXED | Budget 4: no page scroll, no ellipsis or clipped text. Budget 7: the insets part (safe area). Budget 12: the generic 13 px floor (`--tc-text-min`). | Budgets 1–3, 5–6, 8–11, 13–15: board share, socket pitch, cards clear of the board, gem chip, the 15 px Gives/Needs numbers, rings, Strike inset. | P2 port-altar (engine side: P2 layout) |
| mobile-chrome :200 (×4) | title, hall, Settings, Codex, Journal meet D-040 | MIXED | Item 1: the ≥44 hit, ≥36 drawn and slider-thumb sizes on base widgets. Item 2: nothing clipped or off screen. Item 3: art reaches the safe-area edges (fill-width). | Play ≥140×48 (a product choice); Codex tabs; Journal page arrows | P2 port-chrome |
| mobile-chrome :431 (×4) | welcome, Settings to Save, Codex, Journal, Full screen | MIXED | Settings scrolls to its last control; no Full screen button without the Fullscreen API | FUSE's welcome on a fresh save only and off the door; Codex pages clear of tabs; Journal handwriting ≥15, one exit | P2 port-chrome |
| mobile-chrome :656 (×4) | door plates, Menu, Settings fold, Codex formula, text floors | MIXED | the generic text floors | Door plates, Menu, the Settings fold, the Codex formula | P2 port-chrome |
| mobile-ending :118 (×4) | ending, hangout, end card fit | MIXED | Skip and end-card controls ≥44 to the finger; nothing cut | "Plays by itself" with no "Tap to continue"; chat bottom-anchored with its start block; messages ≥80% wide; form on one line; clipboard uncut; Skip clear of the caption | P2 port-chrome |
| mobile-hall :129 (×4) | hall labels, locked card, menu, FUSE's tail, Settings | MIXED | Menu note ≥11 px; segments ≥36 | Plates on screen, the Next ring and tag, locked-card copy, the scrim, FUSE's tail, default text speed Normal | P2 port-chrome |
| mobile-moments :223 (×4) | hint, fail, solve, FUSE one at a time | MIXED | Continue ≥44; the card ≥12 inside the play area (safe area) | One voice at a time, how-to slot, fail order, FUSE's figure in view, arrival card clear of Strike | P2 port-altar |
| mobile-moments :393 (×4) | right column has one owner | GAME, shrink | | Runs at phone-se only | P2 port-altar |
| mobile-strike :127 (×4) | Strike, lamps, verdict, solve card | GAME, shrink | (≥12 inside the play area is the engine's safe-area row) | Everything else; runs at phone-se only | P2 port-altar |
| mobile-zoom :103, :268, :440 (×4) | zoom | GONE | | | zoom-removal (D-041 addendum 1) |
| mobile :111 | intake desk by touch alone | MIXED | `data-touch` and `data-phone` flags (device mode) | the touch play path: the touch analogue of full-run | P1 promote-ui (flags, done); the rest stays |
| mobile :149 | furnace by touch with ↻ Turn | GAME | | | |
| **mobile :173** | turn before placing; drag a placed gem off to remove it | MIXED | CDP touch drag recognition (start, move, end, origin) | That a drag-off removes the gem, driven through the `Gestures` test feed instead of CDP timing. This makes it shorter and no longer flaky. | P2 gestures (engine), P2 port-altar (game) |
| **mobile :350** (×2) | fits a 844×390 and a 667×375 phone: hall, panels, every altar | REDUNDANT | Everything: no scroll, text ≥11, ≥44 targets, no clipping, on screen. These are the engine layout rows. | Nothing: mobile-budget covers the altars at phone-se. | P2 layout (engine), then delete at P2 port-altar |
| mobile :400 | upright phone shows the turn-sideways card | ENGINE | ui (`rotate-card`), platform | P1 promote-ui (done: e2e/ui.spec.ts) | |
| **mobile :416** | Last Rune: tray drag zooms in | GONE | | | zoom-removal |

### Helpers (not tests)

| File | Class | Notes |
|---|---|---|
| `helpers.ts` | split | `trackProblems`, `waitFrames` and the touch helpers get a noun-free copy in `packages/engine/e2e/`. The game helpers stay. |
| `altar-keys.ts`, `altar-audit.ts` | GAME | D-026 press counts and altar audit |
| `ports.ts` | shared | The engine harness needs its own port block within the worktree offset. |

## Unit tests

### Engine (all ENGINE, already in place)

All 18 move with `engine/` to `packages/engine/` in **P1 workspace**, with no content change:

- audio: `audio`, `dsp-envelope`
- core: `loop`, `scene`
- fx: `flicker`, `particles`
- input: `input`, `input.dom`
- platform: `letterbox`, `links`
- post: `blend`, `quality`
- render: `dynamic-resolution`, `gpu-timer`, `renderer`
- save: `save`
- ui: `link`, `ui`

Later workstreams extend `links` and `save` (host), and add `gestures`, `layout` and `camera`.

### Game

| File(s) | Class | Engine target | Who | Notes |
|---|---|---|---|---|
| `rules/progression`, `rules/sim`, `rules/solver` | GAME | | | |
| `content/*` (7 files: altar-lines, codex, content, puzzles/difficulty, finale, puzzles, solve) | GAME | | | |
| `art/*` (candles, bolt, fuse-stroll, fuse) | GAME | | | |
| `audio/bank`, `audio/dsp`, `audio/logic` | GAME | | | The game's sound design. The engine DSP is tested in `engine/audio`. |
| `game/flow` | GAME | | | Add the play-time-while-hidden case here (from robustness :133). |
| `game/settings` | GAME | | | The setting's legal values are product. |
| `game/graphics` | GAME | (render, if ever promoted) | | Tier policy over `DynamicResolution`. Not in the promotion plan; flag it if Forgewilds needs it. |
| `game/save` | MIXED | save, host | P1 host | "Works without storage (memory fallback)", "round-trips through storage" and the corrupt-backup case re-verify engine save and storage; they move. Schema, migrations, `codex.met`, placement repair and new game stay. |
| `scenes/altar/board`, `board-lock`, `capacitor`, `clarity`, `cursor`, `moments`, `reach`, `strike`, `socket-looks` | GAME | | | Kept through port-altar by plan |
| `scenes/altar/snap` | MIXED | input (`Gestures` `magnify`/snap) | P2 gestures adds the generic case; P2 port-altar trims | "Nearest accepted target within half a pitch" is generic. Which sockets are refused is product. |
| `scenes/altar/zoom` | GONE | | zoom-removal | Phase 3 camera builds `fitRect` itself (addendum 1). |
| `scenes/ending/ending-layout` | GAME | | P2 port-chrome may retire it | `phoneClipRest`: likely replaced by a region |
| `scenes/ending/ending-model`, `hall/hall-state`, `journal/journal-model`, `title/chatter` | GAME | | | |
| `scenes/hall/hall-frame` | MIXED | render (Camera `fitRect`, round trip) | P3 camera | The world↔screen round trip and fit-to-band are camera maths. Door spreading stays. |
| `ui/codex-data`, `ui/codex-diagram` | GAME | | | |
| `ui/place` | ENGINE | layout | P2 layout | Noun-free rect placement. It is deleted when regions replace `avoid()`; otherwise it moves. |
| `ui/text-scale` | ENGINE | ui (density tokens) | P1 promote-ui | It moves with `text-scale.ts`. "Unknown saved values mean 100%" stays with `game/settings`. |
| `scripts/lib/itch-validate`, `zip` | tooling | | | Release packaging. Not part of either suite. |

## Perf harness (`scripts/perf/`, outside `pnpm test:e2e`)

| Spec | Class | Split | Who |
|---|---|---|---|
| `perf.spec` (frame times per scene) | MIXED | The engine gets a noun-free perf scene (post stack, dynamic resolution, camera uniform). Phase 3 needs it as the camera-cost gate. The game keeps per-scene budgets for title, hall, altar, strike and ending. | P3 render-call |
| `load.spec` (load and audio pre-render) | GAME | The game's bank and boot time. Engine boot cost is visible in the engine perf scene. | |
| `mem.spec` (memory, orientation flips) | MIXED | Texture and buffer leaks on landscape↔portrait flips go to the engine (surface). Decoded audio per sound and the JS heap stay. | P1 create-game (flip-leak check); the rest stays |

`scripts/playtest/*.spec.ts` (31 capture scripts) are screenshot tooling for reviews, not tests. They stay with the game and are out of scope.

## Runtime estimate

These are estimates from the test counts, timeouts and the timings logged in STATUS and the workstream logs (full-run chunks 44–72 s; mobile-budget walks all 16 altars per phone). They were not measured here.

| | Tests | Worker time (est.) | Wall time (est., same workers) |
|---|---|---|---|
| Today | 128 (126 run) | ~3,700 s | **6–8 min** |
| After zoom-removal | 115 | ~3,000 s | 5–6.5 min |
| After the Phase 1–2 split | ~55 | ~1,300–1,500 s | **~2.5–3.5 min** (about 55–60% less) |
| Engine harness (new, its own CI job) | ~60–80 checks over 15 rows | ~600–900 s | ~1.5–2.5 min, in parallel with the game job |

Where the saving comes from:

| Source | Saving |
|---|---|
| Phone specs from ×4 to ×1 (×2 for budget) | ~1,300 s |
| layout-fit from 21 to 10 | ~165 s |
| robustness, smoke, lifecycle and link-copy platform tests to the engine | ~215 s |

The wall time is then bounded by mobile-budget at phone-se (all 16 altars) and the longest full-run chunk.

What happens to the specs that are flaky under load:

| Spec : line | Today | After |
|---|---|---|
| mobile-budget :430 | ×4 phones, all 16 altars, 300 s timeout | Stays GAME at 2 phones: half the load. Its generic budgets (scroll, clipping, floors) move to the engine. |
| mobile :173 | CDP touch drag timing | The drag recognition is ENGINE (gestures). The game drives drag-off through the `Gestures` feed: shrinks, no CDP timing. |
| mobile :350 | ×2 phones, every altar | REDUNDANT: deleted at P2. |
| mobile :416 | | GONE (zoom-removal) |
| layout-fit :334 | ×5 sizes | The caption lane goes to the engine. The game keeps 1 case. |
| robustness :328 | strike, Esc and O spam | Panel-stack spam to the engine. The game keeps strike spam = one attempt: shorter. |
| robustness :375 | reload mid-strike | Stays GAME. The flush is engine-proven, so no timing slack is needed; still slow under load. |

## Gate checks (from addendum 2)

| Gate | Requirement |
|---|---|
| **Gate 1** | The engine harness runs in CI with every P1 row of the harness table. smoke :28, :38, :57, :74, :88 and :117, lifecycle (both), robustness :91 and :164, link-copy :252, :279, :294, :373 and :409, and mobile :400 are gone from `tests/e2e/`. |
| **Gate 2** | Every phone spec runs at phone-se (plus phone-iphone for budget) only, and their generic assertions live in the engine layout and gestures suites. mobile :350 is deleted. layout-fit is down to 10 tests. The D-040 blind screenshot review stays a product check. |
