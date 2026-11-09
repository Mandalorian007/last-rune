# Workstream: harden-app (first-release hardening, D-053)

Branch `ws/harden-app`. PM merges. Scope: the game survives real players' browsers. Product behaviour only; the engine's own platform tests are upstream's.

## Audit, then fix what fails (each with a unit or e2e test)
1. **No WebGPU** (Firefox, old Safari, disabled GPU): a clear, styled message with what to do, not a blank page or console error. Same for adapter/device request failure and **device lost** mid-run (recover or tell the player).
2. **Storage:** localStorage throws (Safari private mode, quota, disabled), returns corrupt JSON, or holds an older save shape → game still boots, progress fallback is sane, nothing crashes. Saves from v1.0.0 load in 1.1 (check the save version/migration path).
3. **Uncaught errors:** a top-level handler shows a recoverable message instead of a frozen canvas; no `console.error` during a full normal run (full-run.spec) on desktop, iPad and one phone.
4. **Network:** the built `dist/` makes zero external requests (assert in e2e: every request is same-origin). No sourcemaps or dev-only code shipped unintentionally; check bundle for stray `console.log`/debug hooks (`?demo=` routes: keep only if harmless).
5. **Pages subpath:** `pnpm build && pnpm preview` under `/last-rune/` base: every asset (social.jpg, apple-touch-icon, fonts if any) resolves; reload mid-run and back/forward don't break state; tab hidden/visible pauses and resumes audio and loop.
6. **Input edge cases:** resize/rotate mid-placement, rapid double taps, keyboard-only play (a11y.spec exists, extend if gaps), audio unlock on first gesture on iOS.
7. **Live smoke:** after your fixes, run the smoke spec against `pnpm preview`; PM will re-run against the live site.

Anything that's an engine bug: write a minimal repro into the Log under **Upstream asks**; don't patch node_modules.

## Gates
`pnpm check`, `pnpm build`, `pnpm test:e2e` green, `pnpm baseline` 129/129, `pnpm test:e2e:desktop` green. D-046: fix real gaps, no gold-plating.

## Log

### 2026-11-09: audit and fixes (branch `ws/harden-app`)

Most of the brief already held: the engine (1.2.1) owns the no-WebGPU and device-lost screens,
the storage probe and memory fallback, the corrupt-save backup and the page lifecycle, and the
game already says when progress can't be kept or a save was unreadable. The real gaps were a
top-level error handler (an uncaught error or a boot that threw left a blank or stuck page) and
missing product tests for most of the rest. New tests live in `tests/e2e/hardening.spec.ts`
(10 tests, about 35 s), `games/last-rune/game/crash.test.ts` and `game/save.test.ts`.

| # | Check | Before | Now | Test |
|---|---|---|---|---|
| 1a | No `navigator.gpu` / `requestAdapter()` null | pass (engine screen) | pass | smoke.spec (existing) |
| 1b | `requestDevice()` rejects | pass, untested | pass | hardening: requestDevice() failing |
| 1c | Device lost mid-run | pass, untested in game | pass: "The lights went out", Reload focused, Reload → Continue keeps the altar's gems | hardening: losing the GPU mid-run |
| 1d | Boot throws (e.g. `getContext('webgpu')` crashes) | **fail**: blank page, console only | fixed: "Something went wrong" card, Reload | hardening: a boot that throws |
| 2a | localStorage access throws (blocked) | pass, untested | pass: boots, toast "Progress can't be saved…", plays | hardening: localStorage access throws |
| 2b | localStorage writes throw (quota, old Safari private) | pass, untested | pass, same | hardening: writes throw |
| 2c | Corrupt JSON / old optional-less save | pass | pass | robustness.spec (existing) |
| 2d | v1.0.0 save loads in 1.1 | pass, untested with real bytes | pass: exact bytes written by v1.0.0's own code (main slot and mixer slot) load as `loaded`, nothing lost | save.test: v1.0.0 saves load |
| 3a | Uncaught error / unhandled rejection | **fail**: nothing shown; a throwing frame kept failing behind a normal-looking canvas | fixed: `game/crash.ts` flushes the save and shows one card (Reload, Keep playing); ignores extensions, other origins, "Script error.", ResizeObserver noise, AbortError/NotAllowedError; stays out of the way of the engine's own fatal cards | crash.test (7), hardening: an uncaught error |
| 3b | Zero console.error in a full run | desktop pass; iPad, phone unverified | pass on desktop 1280×720, iPad 1180×820 touch, phone 844×390 touch (all 16 machines, `problems` empty) | full-run.spec, new `FULL_RUN_DEVICE=ipad\|phone` |
| 4a | Zero external requests from `dist/` | unverified | pass (the page and its one bundle; Discord/Ko-fi open only on click) | hardening: under /last-rune/ … |
| 4b | No sourcemaps, debug hooks | pass: no `.map`, `__game`/`?demo`/`?nogpu` are DEV-gated and absent from the bundle; no `console.log`/`debugger` | pass | (bundle grep, manual) |
| 5a | Pages sub-path `/last-rune/` | unverified | pass: every request stays under `/last-rune/`; apple-touch-icon and social.jpg resolve 200 there | hardening: under /last-rune/ … |
| 5b | Reload mid-run, back/forward | reload pass; back/forward untested | pass (headless Chromium reloads on forward rather than restoring from bfcache; either way the hall takes keys after) | hardening: back, forward and reload; robustness reload mid-strike |
| 5c | Hidden tab pauses loop and audio | pass (engine lifecycle + `hooks.hide` play time) | pass | engine lifecycle.spec; game flow unit test |
| 6a | Resize with a gem in hand | untested | pass: four window sizes between taking and setting each gem, the solve lands | hardening: resizing and rotating |
| 6b | Phone rotate mid-placement, rapid double taps | untested | pass: the hold survives portrait (rotate card) and back; a tray double tap is take-then-let-go; a socket double tap never double-places | hardening: phone › turning the phone… |
| 6c | Keyboard-only, gamepad, key spam | pass | pass | full-run (keyboard only), a11y.spec, robustness.spec |
| 6d | iOS audio unlock on first gesture | pass (engine unlocks on pointerdown/pointerup/touchend/keydown/click) | pass | engine audio tests |
| 7 | Smoke against `pnpm preview` | pass | pass | smoke.spec + hardening.spec |

Player-facing messages were screenshotted at 1280×720 (`docs/design/screens/local/harden-app/`,
`HARDEN_OUT=<dir>` on hardening.spec): no device, device lost, boot crash, uncaught error
and storage blocked. (The phone rotate card is the existing one, checked in the run but not shot.) All read as the game's own styled
card with one obvious action; the crash card says the progress is saved only when the flush
reached real storage.

**Shared files touched:** `games/last-rune/main.ts` (installs the guard, reports boot failures),
`tests/e2e/full-run.spec.ts` (opt-in `FULL_RUN_DEVICE`; default unchanged). Nothing in the
harden-tests files (helpers.ts, altar-column, shots, layout).

**Observation for harden-tests:** the `[layout] … overflows its region` / `free placement`
strings are in the production bundle too (engine), not only dev; the phone-landscape altar head
and Strike button overflow on 844×390 and 667×320.

### Upstream asks
1. **Top-level crash screen in `createGame`.** Title: engine has no uncaught-error handling.
   Steps: any game; `setTimeout(() => { throw new Error('x') })` after boot, or make
   `HTMLCanvasElement.prototype.getContext('webgpu')` throw before `createGame`. Expected: a
   styled "Something went wrong" screen (like `showDeviceLostScreen`) with Reload, the save
   flushed first; `createGame` resolving to a fatal screen instead of rejecting when
   `initGpu`'s `getContext` throws. Actual: nothing (error in console only); `createGame`
   rejects and the page stays blank. Engine 1.2.1. Game workaround: `game/crash.ts`
   (filters extension/cross-origin noise; could move upstream as `installCrashScreen`).
2. **`initGpu` doesn't catch `canvas.getContext('webgpu')` throwing**
   (`platform/gpu.js`): it returns `no-context` for null but lets a throw escape, so a browser
   with a broken WebGPU canvas gets a rejection instead of the unsupported screen. Same repro as
   above; expected `{ ok: false, reason: 'no-context', detail }`.
3. Minor: `Loop.frame` calls `this.now()` before its `try`, so a throwing clock stops frames
   for good (`core/loop.js`); everything else in a frame reschedules.

### Gates (2026-11-09, `ws/harden-app`)
- `pnpm check`: pass (52 files, 611 tests; boundaries ok; lint clean)
- `pnpm build`: pass
- `pnpm test:e2e`: 222 passed, 1 failed: `dense-board.spec.ts:293` "se … the-last-rune 0,0: aimed"
  (empty aimed cell) under full-suite load; `dense-board.spec` alone `--repeat-each=3` 48/48. That
  file wasn't touched here: flag it for harden-tests as a load flake.
- `pnpm baseline`: 129/129
- `pnpm test:e2e:desktop`: 2/2 (Electron boots with the crash guard in place)
- Full run on three devices: desktop, `FULL_RUN_DEVICE=ipad` 6/6, `FULL_RUN_DEVICE=phone` 6/6, all with zero console errors

### PM decisions needed
- Should CI run `FULL_RUN_DEVICE=ipad|phone` (about 3.5 min each)? It is opt-in for now.
- Should the engine adopt the crash screen (upstream ask 1)? If yes, `game/crash.ts` gets removed
  when the engine version that has it lands.
