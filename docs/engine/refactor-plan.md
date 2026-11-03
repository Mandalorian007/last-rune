> Imported 2026-11-03 from the user's Claude Doc "ThunderClap Engine Refactor Plan" (https://claude.ai/artifact/3rLQEWt1fvhB7zC6ZYjyAQ) so workstream agents can read it. The Doc is the source; PM decisions on it are in DECISIONS.md D-041 and the live board is in PLAN.md.

# ThunderClap Engine Refactor Plan

2026-11-03 ·

## Purpose

This plan turns `engine/` in the `last-rune` repo into the ThunderClap engine: a reusable, versioned, 3D-ready core that Last Rune and Forgewilds both build on. It is written for the PM agent and the workstream agents that already run this repo, in the same shape as `docs/PLAN.md` and `docs/STATUS.md`: phases, workstreams with a branch each, acceptance gates, and decisions logged to `docs/DECISIONS.md`.

How to read it: phases run in order and each ends at a gate. Within a phase, workstreams marked parallel may run on separate branches at once. Every workstream ends with `pnpm check` green, the full-run e2e (16/16) green, and a README update in the module it touched. Nothing here changes rules, content, art, audio or shaders (about 20k lines); the work is in `engine/`, `games/last-rune/scenes/`, `games/last-rune/ui/` and `games/last-rune/game/`.

## Vision and ground rules

The engine is a standalone product that stays separate from any game, starts as a 2D engine with keyboard, mouse, touch and controller, and grows into 3D worlds and VR without a rewrite. WebGPU is the only renderer. WebXR is a later plug-in. Desktop ships through Electron. Mobile ships through the browser on itch.io and GitHub Pages.

Rules the refactor holds throughout:

1. **Promotion rule stays.** Code enters the engine only if Last Rune uses it, the next game plausibly would, and the API has zero game nouns (`docs/architecture.md` rule 1).
2. **Dependency direction stays.** `games/*` imports `@thunderclap/engine`; the engine never imports a game. `rules/` still imports nothing from the engine or the DOM.
3. **3D by construction, 2D by preset.** Every scene renders through a real camera matrix with world units. A 2D game uses an orthographic preset where 1 world unit = 1 design px, so existing 1920×1080 layout math survives. Depth testing is off in the 2D preset; draw order stays painter's order by layer then submission.
4. **Build seams, not features.** VR and 3D content are out of scope. The engine gains the three seams XR will plug into: `Surface` (what is drawn to), `Camera` (what is looked through), and the frame loop (who calls render). Nothing else may be built on speculation.
5. **UI is CSS px, never scaled design px.** The overlay stops being a 1920×1080 canvas shrunk by one transform. Text, tap targets and regions are laid out in CSS px with density tokens. The world canvas keeps design units behind a camera.
6. **Host is a layer.** Browser-in-iframe, Pages, Electron and later XR are `Host` implementations. Open link, copy, fullscreen, storage backend and window controls go through it.
7. **No runtime frameworks (D-008).** Runtime dependencies still need a DECISIONS entry.
8. **Last Rune is the test harness.** No engine change merges without the game running on it. In-repo until Phase 5; extraction waits for a second consumer.

## Where the codebase stands

The engine is 14.4k lines in 9 modules; the game is 43.5k. Input and gamepad are already engine-grade. Mobile layout is the gap: it lives in the game as a shrunk desktop overlay patched by CSS variables, which is where four D-040 gate reviews have stalled at 6 to 6.5 out of 10.

| Concern | Engine today | Game today | Verdict |
|---|---|---|---|
| Keyboard, mouse, touch, pen, gamepad | `engine/input`: action map, `blocked()`, `lastDevice`, queued taps, iframe-safe `preventDefault`, injectable pads, tests | ~2 raw DOM listeners outside demos | Done; keep |
| Gamepad in menus | `PadNav` (modal panels), `activateLink` | `ui/menu-nav.ts` for non-modal menus (title, end card) | Promote `menu-nav` |
| Device and platform | `deviceTraits`, `isTouchOnly`, `watchPointerKind`, fullscreen + landscape lock, letterbox and fill-width math, lifecycle, reduced motion, device-lost screens | `ui/device-mode.ts` (phone/touch flags, cssPx, bar, crop), `ui/phone-chrome.ts` (rotate card, fullscreen button) | Promote both, then retire under Phase 2 layout |
| Overlay layout | `createOverlay`: 1920×1080 design canvas, one CSS `scale()` transform, layers hud/captions/panels/toasts | `ui/phone-styles.ts` (1,014 lines of phone overrides), `ui/text-scale.ts`, `--lr-css-px` / `--lr-text-min` / `--lr-tap` | Replace with regions in CSS px (Phase 2) |
| Touch gestures | `Loupe` widget only | Tap vs pan, long-press pin, drag-off remove, snap, loupe thresholds, all inside `scenes/altar/altar-scene.ts` (4,268 lines, 130 phone branches) | New engine `Gestures`; altar rewritten on it |
| World camera | None; renderer is draw-order 2D, no depth | `scenes/altar/zoom.ts`: pure camera `screen = o + z·world`, fit, tap-to-zoom, pan limits | Generalise into engine `Camera` (Phase 3) |
| Boot and wiring | `boot`, `initGpu`, `mountSurface` | `game/ctx.ts` (486 lines): overlay, input, audio, save, device mode, fill bands | Generic `createGame()` (Phase 1) |
| External links, copy, embed | `embedContext`, `openExternal`, `copyText`, `externalLink` widget (D-036) | Ko-fi and invite links use them | Seed of the `Host` layer |
| Electron | None | None | Phase 4 |
| 3D, XR | None; pitch v0.3 defers them | None | Seams only, Phase 3; content later |

What the game owns that does not move: `rules/` (3.2k), `content/` (3.4k), `art/` (4.8k), `audio/` (3.9k), `shaders/` (4.2k). Shaders need a uniform-block change in Phase 3 if they read design-px positions; that is mechanical.

## Target architecture

The engine becomes five layers. Games touch only the top one. Hosts and the three render-core seams are the only places XR or Electron ever appear.

_(diagram in the source doc)_

Games call `createGame()` and write scenes; the host and the three seams under the render core are where Electron and XR plug in.

Contracts, one paragraph each. These go into `packages/engine/ARCHITECTURE.md` in Phase 1 and are the text the PM reviews promotions against.

- **Surface.** Owns the canvas, swapchain, DPR, backbuffer size and letterbox or fill-width fit. Exposes `rect` (CSS px), `size` (device px), `clientToLogical`, `onResize`. Later an `XRSurface` provides a target per eye per frame through the same interface.
- **Camera.** A view-projection matrix plus `worldToScreen` and `screenToWorld` (the inverse projection; touch aiming uses it). Presets: `ortho2d(designW, designH)` where 1 unit = 1 design px, and `fitRect(rect, viewport)` which generalises `zoom.ts`. Depth test and write are camera-preset flags; the 2D preset leaves both off.
- **Frame loop.** `GameLoop` as today (fixed 60 Hz update, variable render), but `render(camera, target, alpha)` takes the camera and target as inputs rather than reading them from the renderer. The host decides who schedules frames (rAF, Electron, later `XRSession.requestAnimationFrame`).
- **Host.** `interface Host { kind; openExternal; copyText; fullscreen; storage; window?; embed }`. Implementations: `web` (detects iframe vs top, wraps today's D-036 link service), `electron` (preload bridge). The engine never calls `window.open`, `navigator.clipboard` or `localStorage` directly after Phase 1.
- **Input.** Unchanged action map. New `Gestures(target, opts)`: tap, double-tap, long-press, pan, drag with thresholds in CSS px, reporting in the same tick model as `Input`. Gestures feed actions where a game binds them.
- **Layout.** `createOverlay` laid out in CSS px, not design px. A `LayoutSpec` names regions (`top`, `left`, `right`, `bottom`, `cardLane`, `captionLane`, `modal`) per form factor (`phone`, `tablet`, `desktop`, each in `landscape` or `portrait`), with safe areas. Games register widgets against regions; the engine places them with CSS grid. The layout reports the free rect to the camera so the world frames into what the UI leaves. Density tokens `--tc-text-min`, `--tc-tap-min`, `--tc-text-scale` replace the game's `--lr-*` variables.
- **UI, Audio, Save, FX, Post.** Unchanged in API; the overlay's scaling model is the one change inside UI.
- **Scene and Ctx.** `Scene<Ctx, Frame>` stays. `Ctx` gains `host`, `camera`, `layout`, `gestures`; the game's `GameCtx` wraps it with game nouns as today.

## Phase 0: ship v1.0 desktop and freeze

Last Rune v1.0 ships for desktop and tablet on the current code before any engine refactor starts, so the refactor is never done under release pressure and always has a known-good baseline to regress against.

1. Stop `mobile-7` where it stands; merge if green, else park the branch. Phone support moves to a 1.1 release that Phase 2 delivers.
2. Release v1.0 per `docs/shipping-itch.md`: GitHub Release, `v1.0.0` tag, itch zip, Pages deploy. Desktop and iPad only; the title shows the phone "turn sideways" card unchanged.
3. Tag `engine-v0.1` on the same commit. This is the last engine state with the scaled-overlay model.
4. Record the full-run e2e timings, the perf harness baselines (`scripts/perf/`), and a screenshot set of every scene at 1280×720, 1920×1080 and iPad as `docs/design/screens/v1.0/`. These are the regression references for every later phase.
5. Log D-041: v1.0 scope, 1.1 = phones on the new layout model, engine refactor plan adopted (link this doc).

**Gate 0:** v1.0 live on Pages and itch; tags pushed; baselines committed.

## Phase 1: workspace, host layer, promotions

The repo becomes a pnpm workspace with the engine as a real package, the host layer lands, and everything already generic in the game moves up. No layout or renderer changes yet; the game runs identically at the end of this phase.

**ws/workspace** (first, blocks the rest)

- Move `engine/` to `packages/engine/` with its own `package.json` (`@thunderclap/engine`, `version: 0.2.0-dev`), `exports` map per module (`./input`, `./ui`, `./platform`, …), `tsconfig`, and its own `test` and `check` scripts. Root becomes a workspace; `games/last-rune` depends on `workspace:*`.
- Replace the `@engine/*` alias with package imports. Biome rule or lint check: no import may reach into `packages/engine/src/**` from a game; only the exports map.
- Add `packages/engine/ARCHITECTURE.md` with the contracts from the section above, one paragraph each, and `CHANGELOG.md` started at 0.2.0-dev.
- CI runs engine tests and game tests as separate jobs.

**ws/host** (parallel after workspace)

- `packages/engine/src/host/`: `Host` interface, `createWebHost()` that detects `embedContext()` and wraps `openExternal`, `copyText`, `clipboardWriteAllowed`, fullscreen helpers and a `storage` backend over `localStorage` with the same quota and blocked-storage handling `engine/save` has today.
- `engine/save` takes its storage from the host rather than touching `localStorage`. `externalLink` widget takes the host. The game's Ko-fi and invite links go through `ctx.host`.
- Test: the itch-sim (`scripts/itch-sim/`) e2e covers copy and open through the host in a cross-origin frame.

**ws/promote-ui** (parallel after workspace)

- `games/last-rune/ui/menu-nav.ts` → `engine/ui/menu-nav.ts` (already noun-free).
- `games/last-rune/ui/text-scale.ts` → engine tokens `--tc-text-scale`, `--tc-text-min`; `scaleFontSizes()` becomes an engine helper.
- `games/last-rune/ui/device-mode.ts` and `phone-chrome.ts` → `engine/platform/device-mode.ts` and `engine/ui/rotate-card.ts` as interim engine API. Both are retired in Phase 2 but promoting them now removes the last `@game` imports from boot.
- `games/last-rune/scenes/altar/zoom.ts` pure functions → `engine/render/camera2d.ts` with the game's `AltarLayout` dependency replaced by a plain `Rect`. The altar keeps calling it; this is the seed of Phase 3's `Camera`.

**ws/create-game** (after host and promote-ui)

- `game/ctx.ts` splits: the noun-free wiring (surface, renderer, post, particles, input, audio, overlay, save, host, device mode, lifecycle, fill bands) becomes `createGame(opts): EngineCtx` in `engine/core/game.ts`; `GameCtx` wraps `EngineCtx` and adds `sound`, `progress`, `setMood`, FUSE and the rest.
- `main.ts` shrinks to `createGame({...}).then(ctx => scenes.push(title))`.

**Gate 1:** `pnpm check` green in both packages; full-run e2e 16/16; Playwright screenshot diff against the v1.0 set shows no pixel change on desktop; no `@game` import inside `packages/engine`; `CHANGELOG.md` lists every promoted module. Tag `engine-v0.2.0-alpha.1`.

## Phase 2: input gestures and layout regions

The overlay moves from a scaled 1920×1080 canvas to CSS-px regions, a gesture layer joins the action map, and every scene is ported, small ones first and the altar last. This phase delivers Last Rune 1.1 with phones, and the D-040 gate becomes the acceptance test for the engine's layout model.

**ws/gestures** (first; no scene changes)

- `engine/input/gestures.ts`: `Gestures` attached to a pointer target, reporting per tick like `Input`: `tap`, `doubleTap`, `longPress` (default 450 ms), `pan` (threshold default 10 CSS px, with `dx`, `dy`), `drag` (start, move, end, with the origin), `pinch` (scale, for later zoom). Thresholds in CSS px, positions in game space through the same `PointerTransform`. `blocked()` shared with `Input`.
- Public feed methods for tests, as `Input` has. Unit tests under happy-dom for every gesture and the tap-vs-pan boundary.
- A gesture can be bound as an action binding (`{ gesture: 'longPress' }`), so a game can treat long-press as `info` and tap as `select` without reading gestures directly.

**ws/layout** (parallel with gestures)

- `engine/ui/layout.ts`: `LayoutSpec` and `createLayout(overlay, spec)`. Form factors by `deviceTraits` plus orientation: `phone-landscape`, `phone-portrait`, `tablet`, `desktop`. Regions `top`, `left`, `right`, `bottom`, `cardLane`, `captionLane`, `modal`, `fill`, each a CSS grid area with min size and safe-area padding. A widget registers once with a region per form factor; the layout moves it on change.
- `createOverlay` stops scaling. The root is the surface rect in CSS px. The `designWidth`/`designHeight` option is kept only for the `legacyScale: true` path the unported scenes use during this phase; it is removed at the gate.
- `layout.freeRect` (CSS px) is reported to whatever camera the scene uses so the world frames into the space the UI leaves. The caption card's `avoid()` becomes region placement; the rect-collision search is deleted.
- Density tokens on the overlay root: `--tc-text-min`, `--tc-tap-min` (44 on touch form factors), `--tc-text-scale`. Base widgets (button, slider, toggle, panel chrome) honour them, so a phone gets 44 px hit areas from the engine, not from a game stylesheet.
- Unit tests: region assignment per form factor, safe-area padding, freeRect math, widget relocation on orientation change.

**ws/port-chrome** (after gestures and layout)

- Title, hall, settings, journal, codex and the ending ported to regions. `ui/phone-chrome.ts`, `ui/device-mode.ts`, the promoted interim copies, and the chrome half of `phone-styles.ts` deleted. Each scene's phone CSS shrinks to region-specific styling.
- Acceptance: the existing `mobile-chrome.spec.ts` and `mobile-ending.spec.ts` pass on all four phone viewports plus desktop and iPad; desktop screenshots match the v1.0 set within the diff tolerance.

**ws/port-altar** (last; the hard one)

- `scenes/altar/` rewritten against `Gestures`, `Layout` and `camera2d`. Target: `altar-scene.ts` under 2,000 lines, zero `L.phone` branches; the phone case is a `LayoutSpec` and a camera fit, not a code path. Keep `teach.ts`, `moments.ts`, `hints.ts`, `strike.ts`, `cursor.ts`, `board.ts` and their tests; these hold the UX learning from 45 workstreams and must not be rewritten.
- Loupe and snap move behind a `Gestures` option (`magnify: { below: 44, size, zoom }`) so any game with small targets gets them.
- Acceptance: `altar-labels.spec`, `altar-keys`, `mobile-budget.spec` and the full-run e2e all green; keyboard press counts stay at or under the D-026 numbers; socket pitch meets D-040 on all four phones.

**Gate 2:** D-040 blind screenshot review ≥8/10, no major issues, then the user's real-phone retest. Desktop and iPad screenshot diff against v1.0 within tolerance. `phone-styles.ts` deleted. Release Last Rune 1.1 (phones). Tag `engine-v0.2.0`.

## Phase 3: 3D-ready render core with 2D preset

The renderer gains a real camera, transforms with depth, and a render call that takes camera and target as inputs. Last Rune keeps drawing exactly what it draws today through the `ortho2d` preset. This is the last API-breaking change on the 2D path and must land before extraction.

**ws/camera** (first)

- `engine/render/camera.ts`: `Camera` with `view`, `projection`, `viewProjection` (column-major `Float32Array`, no math library per D-008; a small `mat4` module in `engine/core/math.ts`), `worldToScreen`, `screenToWorld`, and flags `depthTest`, `depthWrite`. Presets: `ortho2d(w, h)` and `perspective(fovY, aspect, near, far)`. `camera2d.ts` from Phase 1 becomes `Camera.fitRect(...)`.
- A camera uniform block (`view_proj: mat4x4<f32>`, `viewport: vec4<f32>`) bound at group 0 for every material. `engine/render/wgsl.ts` exports the WGSL snippet.

**ws/transforms** (parallel)

- `Transform` with position (x, y, z), rotation, scale and an optional parent; world matrix cached and invalidated on change. Sprites and meshes take a `Transform` rather than x/y/w/h. The 2D case leaves z at 0 and rotation about z only.
- Draw submission keeps a `layer` number. Within the 2D preset the renderer sorts by layer then submission order, as today. With `depthTest` on it sorts opaque front-to-back and blended back-to-front by camera distance; that path is tested with a demo scene, not used by Last Rune.

**ws/render-call** (after camera and transforms)

- `Renderer.render(frame, camera, target)`; `GameLoop` passes the active camera and the surface's current target. `PingPong`, `DynamicResolution`, the post stack and `SnapshotRenderer` take the target they are given. No code path reads `renderer.camera` or `surface.currentTexture` on its own.
- A depth attachment is allocated only when a camera in the frame asks for it.

**ws/port-shaders** (after render-call)

- Every game material in `games/last-rune/shaders/` reads `view_proj` from the camera block instead of design-px constants or the old per-draw uniform. Procedural art (`art/`) and the post stack need no change. `?demo=render`, `?demo=art`, `?demo=props` and the altar run pixel-identical to Phase 2's screenshot set.

**ws/demo-3d** (last, engine only)

- A `?demo=mesh` scene in the engine's own demos: a perspective camera, a few lit meshes, depth on, orbit by pointer and gamepad through the action map. Proves the 3D path exists and gives Forgewilds a starting template. No lighting model beyond one directional light; no asset loading.

**Gate 3:** Last Rune pixel diff within tolerance on desktop, iPad and the four phones; full-run e2e green; perf harness within the Phase 2 budgets (the camera block must not cost frame time); `?demo=mesh` runs at 60 fps on the perf baseline machine. Tag `engine-v0.3.0`.

## Phase 4: Electron host and packaging

Desktop builds come from the same web bundle through a thin Electron shell, with the `Host` interface as the only seam. This phase is independent of Phase 3 and may run alongside it.

**ws/host-electron**

- `packages/host-electron/`: main process (window, WebGPU flags enabled explicitly via `app.commandLine.appendSwitch` so the build does not depend on the user's Chromium defaults), a preload that exposes `openExternal` (via `shell.openExternal`), `copyText` (via `clipboard`), `fullscreen`, `window` (minimise, close, title) and a `storage` backend over a JSON file in `app.getPath('userData')` with the same versioning as the web backend. `createElectronHost()` on the renderer side reads the bridge and satisfies `Host`.
- `electron-builder` config for Windows, macOS and Linux; outputs in `dist/desktop/`. Code signing is out of scope until the user supplies certificates; log that as an open question.
- Scripts: `pnpm desktop:dev` (Vite dev server inside Electron), `pnpm desktop:build`.
- Decision to log: Electron over Tauri because Chromium parity is what keeps WebGPU behaviour identical to the web build.

**ws/last-rune-desktop**

- Last Rune boots with `createElectronHost()` when `window.thunderclap` is present, else the web host. Settings gain a `Quit` entry on desktop only. The fullscreen button uses the host. The itch and Ko-fi links open through the host.
- e2e: Playwright's Electron driver runs the title → intake-desk → solve path.

**Gate 4:** desktop builds for all three platforms produced in CI as artefacts; the e2e path green; a manual run on the user's machine. Tag `engine-v0.3.x` and `last-rune-desktop-v1.2`.

## Phase 5: extraction to standalone and releases

The engine leaves the Last Rune repo once two conditions hold: Phase 3 is merged (the last breaking change on the 2D path) and Forgewilds exists as a second consumer that has exercised the API for at least one workstream. Extracting earlier means every API change is two PRs and a version bump before the game can run.

1. `git filter-repo` on `packages/engine/` into a new `thunderclap-engine` repository, history intact. The host packages go with it.
2. Publish `@thunderclap/engine` and `@thunderclap/host-electron` as versioned packages (a private npm registry or GitHub Packages; the user decides). `engine-v1.0.0` is the first release; semver from there, with the promotion rule and `ARCHITECTURE.md` as the review gate for every public API change.
3. Last Rune and Forgewilds pin a version. Breaking engine changes now ship as a major bump with a migration note in `CHANGELOG.md`; the engine repo's CI runs both games' e2e suites against a release candidate before it is tagged.
4. `docs/DECISIONS.md` in the engine repo starts fresh with the contracts; game decisions stay in the game repos.

**Gate 5:** both games build and pass e2e against the published `engine-v1.0.0`; the Last Rune repo contains no `packages/engine/` directory.

## Later: 3D content and XR, out of scope

Nothing in Phases 0 to 5 builds 3D content or XR. Agents must refuse workstream proposals that do, and log them to the engine backlog instead. This section exists so the seams are built with the right shape and nothing more.

- **3D content** (meshes, materials, lights, asset loading, a scene graph beyond `Transform`) starts on the standalone engine, driven by Forgewilds' first real need, not by a demo.
- **XR** arrives as three implementations of existing seams: an `XRSurface` (one target per eye per frame from the session's layer), an `XRCamera` per view (matrices from the `XRView`), and an `XRHost` whose frame scheduler is `XRSession.requestAnimationFrame`. Controllers map into the action map through a new binding kind. The UI layer needs a spatial region model; that is a design task for then, and the only rule now is that no scene may assume a screen rect exists outside the layout it is given.
- **Compatibility note.** WebGPU-backed WebXR was early and behind flags in browsers as of this plan's knowledge; the engine stays WebGPU-only rather than carrying a WebGL fallback renderer. Re-check browser support before any XR workstream is opened.
- **Mobile native shells** (Capacitor or similar) are not planned; mobile ships through the browser on itch and Pages.

## Acceptance gates, tests and risks

Every phase ends at a gate the PM runs; no phase starts before the previous gate is logged in `docs/STATUS.md`. The regression set is the v1.0 baseline from Phase 0 plus the existing suites: 404 rules tests, 59 engine and game test files, the full-run keyboard e2e (16/16), `mobile-budget`, `mobile-chrome`, `mobile-ending`, `altar-labels`, `layout-fit` at 5 sizes, axe a11y, and the perf harness.

Tests the refactor adds:

| Suite | Phase | What it locks |
|---|---|---|
| Screenshot diff vs `docs/design/screens/v1.0/` | 1 onward | Desktop and iPad pixels through every engine change |
| Engine import-boundary lint | 1 | Games use only the exports map |
| Host e2e in itch-sim cross-origin frame | 1 | Open and copy still work in the iframe |
| `gestures.test.ts` | 2 | Tap vs pan boundary, long-press timing, drag origin, blocked() |
| `layout.test.ts` | 2 | Region assignment per form factor, safe areas, freeRect, orientation relocation |
| D-040 blind review ≥8/10 | 2 | The layout model, not just the game |
| `camera.test.ts` | 3 | ortho2d identity against design px, screenToWorld round trip, fitRect vs the old zoom.ts |
| Draw-order test | 3 | 2D preset sorts by layer then submission; depth path sorts by distance |
| Electron e2e | 4 | Title to first solve in the desktop shell |
| Two-consumer CI | 5 | Both games green against a release candidate |

Risks and the fallback for each:

- **The altar rewrite loses UX behaviour.** Mitigation: `teach.ts`, `moments.ts`, `hints.ts`, `strike.ts`, `cursor.ts` and `board.ts` are kept with their tests; the rewrite touches layout, input and camera code only. The D-026 press counts and the altar e2e suites are hard gates.
- **Regions model turns out to need a per-widget escape hatch.** Allow one: a widget may declare `region: 'free'` with an explicit rect in CSS px. If more than two widgets need it at Gate 2, the region set is wrong and gets revised before the altar port.
- **Camera uniform costs frame time on phones.** Perf harness is a gate; the block is one 80-byte uniform per frame, so this is a sanity check rather than an expected problem.
- **Phase 3 shader port breaks procedural art.** `?demo=art` and the gem portraits (`SnapshotRenderer`) are in the pixel diff.
- **Electron WebGPU flags differ by platform.** Log the exact switches per OS in `packages/host-electron/README.md`; the three-platform CI build is the check.
- **Scope creep toward 3D or XR.** The out-of-scope section is the rule; the PM rejects workstreams that add either before Gate 5.

## Workstreams

The phases run in order with a gate between each; Phase 4 is the one that may run alongside another.

_(diagram in the source doc)_

Phase 2 is the accent because it is where the mobile gate finally becomes an engine test rather than a game patch.

The table below is the harness's board: one row per workstream, in dependency order, with the branch name the repo's convention expects. The PM updates Status; agents update Notes on merge.

| # | Workstream | Branch | Phase | Depends on | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | Ship v1.0, tag engine-v0.1, baselines | main | 0 | mobile-7 parked | Not started |  |
| 2 | Workspace + engine package + ARCHITECTURE.md | ws/workspace | 1 | 1 | Not started |  |
| 3 | Host layer (web) | ws/host | 1 | 2 | Not started |  |
| 4 | Promote menu-nav, text-scale, device-mode, rotate card, camera2d | ws/promote-ui | 1 | 2 | Not started |  |
| 5 | createGame() from game/ctx.ts | ws/create-game | 1 | 3, 4 | Not started |  |
| 6 | Gestures | ws/gestures | 2 | 5 | Not started |  |
| 7 | Layout regions + overlay in CSS px | ws/layout | 2 | 5 | Not started |  |
| 8 | Port title, hall, settings, journal, codex, ending | ws/port-chrome | 2 | 6, 7 | Not started |  |
| 9 | Port altar; delete phone-styles.ts | ws/port-altar | 2 | 8 | Not started |  |
| 10 | Camera + math | ws/camera | 3 | 9 | Not started |  |
| 11 | Transforms + layer/depth sort | ws/transforms | 3 | 9 | Not started |  |
| 12 | render(camera, target) | ws/render-call | 3 | 10, 11 | Not started |  |
| 13 | Port game shaders to camera block | ws/port-shaders | 3 | 12 | Not started |  |
| 14 | ?demo=mesh | ws/demo-3d | 3 | 13 | Not started |  |
| 15 | host-electron package + builds | ws/host-electron | 4 | 3 | Not started |  |
| 16 | Last Rune desktop boot + e2e | ws/last-rune-desktop | 4 | 15 | Not started |  |
| 17 | Extract engine repo, publish engine-v1.0.0 | engine repo | 5 | 13, 16, Forgewilds ws 1 | Not started |  |

Open questions for the user before Phase 1 starts:

- Package scope name: `@thunderclap/engine` is assumed.
- Registry for Phase 5: GitHub Packages, a private npm scope, or git tags only.
- Electron code signing: certificates available, or ship unsigned for now.
- Portrait phones: stay a stretch goal (D-039) or become a Phase 2 form factor with its own region spec.
