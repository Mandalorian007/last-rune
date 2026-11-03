# Workstream: mobile-perf (phones: GPU, memory, audio, platform)

User (2026-11-03) wants phones supported, landscape at least (**D-039**; read it first). mobile-ui owns layout and touch. This workstream owns making phones *run* well and fail gracefully.

## Scope
1. **WebGPU on phones.**
   - Check, with sources, which phones and browsers have WebGPU on by default today: iOS/iPadOS Safari versions, Android Chrome versions and GPU requirements.
   - Make sure the "no WebGPU" screen is friendly and readable on a phone, and says what to try.
   - Record the support matrix in `docs/shipping-itch.md` or a new `docs/design/mobile.md`.
2. **GPU budget.**
   - Phones have high DPR (3), small batteries, thermal throttling and tiled GPUs.
   - Make Auto choose a phone-appropriate tier on first run: cap DPR (e.g. ≤2, or scene-res scaling), prefer Low-ish post on coarse-pointer or small-screen devices, and let DynamicResolution react to thermal slowdown.
   - Use the existing perf-tiers / DynamicResolution / GPU timers. Don't build a new system.
   - Measure with `scripts/perf` under mobile emulation plus CPU/GPU throttling, and log the numbers. Target 60 fps where possible, and a steady 30 rather than a jittery 45.
3. **Memory.**
   - Decoded audio is about 52 MiB, plus GPU textures. iOS kills tabs that use too much.
   - Measure the total footprint. If it's risky for phones, reduce it on phones only, e.g. a lower sample rate or mono for ambience/pads, or rendering some sounds lazily. The desktop sound must stay identical.
   - Log the before and after.
4. **Audio on phones.**
   - iOS: the AudioContext unlocks on the first touch (check `touchend` and `pointerup`). Audio resumes after the app is backgrounded or after an interruption such as a call or Siri. Mention the silent switch in the log.
   - Android: resumes after the tab is backgrounded.
5. **Lifecycle.**
   - Pause cleanly on `visibilitychange` and `pagehide`, and resume.
   - Saves flush before the page is backgrounded or frozen, since iOS can kill the tab without warning.
   - Survive device loss and restore (mobile GPUs lose devices more often).
   - Survive orientation changes without leaking resources.

## Constraints
- **Out of scope:** layout, touch input and wording (mobile-ui). Settings UI layout changes go through mobile-ui. You may add a setting value if needed and tell the PM.
- Engine changes must have no game nouns.
- Desktop perf, image quality and sound must stay identical on High and Auto at 1080p. Re-run the desktop baseline to prove it.

## Done when
- The support matrix, with sources.
- Mobile-emulation perf and memory numbers, before and after.
- Lifecycle e2e coverage: hide/show and pagehide flush the save; audio resumes.
- A short real-device checklist for the user covering perf, audio, backgrounding and battery/thermal over 10 minutes.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-03: mobile-perf
- **Support matrix** researched with sources; it is in `docs/design/mobile.md` §1.
  - Safari on iOS/iPadOS 26+ (iPhone 11 and up).
  - Chrome on Android 12+ with Qualcomm or ARM GPUs (Chrome 121+); Imagination GPUs need Android 16 and Chrome 139.
  - Not supported: Firefox on Android, Android WebView and in-app browsers. Samsung Internet is unreliable.
- **Harness.**
  - `PERF_MOBILE=1` emulates 852×393 at DPR 3 with touch, a coarse pointer and the matching `screen`. Playwright reports 1920×1080 `screen` unless told otherwise, which hid the handheld check on the first "after" run.
  - `PERF_MEM=1` (`mem.spec.ts`) reports decoded audio per sound, live GPU textures and buffers, and the JS heap, then does 10 orientation flips and asserts no texture leak.
  - What emulation can't tell us is listed in mobile.md §2. In short: no phone GPU speed, no thermals, no Safari, no iOS audio session.
- **GPU budget.**
  - On a handheld (coarse pointer and a short screen side ≤ 600 CSS px), Auto starts on Low (`autoReason` `handheld`).
  - New steady-30 rule. It needs the tier on Low with dynamic resolution and three things true for 4 s: dynamic resolution saturated at 0.6, the GPU over budget, and the median frame interval over 20 ms. It then sets `GameLoop.maxFps = 30` and doubles the budget. Changing Graphics clears it.
  - Hall under phone emulation, CPU×4: `ts` 13.9/16.8 → 5.5/6.6 ms (p50/p95).
  - Desktop High and Auto at 1080p: same tier, scene size, budget and draws. The `ts` differences are within noise. Tables are in mobile.md §3.
- **Memory.**
  - About 53 MiB audio, 47 MiB GPU textures and 9 MiB heap (steady); the ArrayBuffer peak is about 122 MiB during the audio pre-render.
  - Not risky for 4 GB+ phones, so nothing was cut. Desktop sound is identical.
  - Orientation flips: no leak. Table in mobile.md §4.
- **Audio.**
  - iOS `interrupted` used to become `unavailable` (silent until a reload). It is now a pause, and only `closed` is final.
  - The gesture listeners re-arm whenever the context should run but doesn't.
  - Audio now also pauses on `pagehide` and `freeze`, and resumes on `pageshow`, `focus` and `resume`.
  - The silent switch mutes us (default `ambient` session); this is noted in mobile.md.
  - Unit tests are in `engine/audio/audio.test.ts`.
- **Lifecycle.**
  - `watchLifecycle` (engine) covers hidden, pagehide and freeze, then visible, pageshow and resume. `ctx.ts` uses it to stop the loop, commit play time and flush the save.
  - The save store also flushes on `freeze`.
  - New `tests/e2e/lifecycle.spec.ts`.
- **Unsupported screen.**
  - Lists where the game runs, the visitor's platform first (iPhone/iPad, Android, computer). The in-app and Firefox advice is on it.
  - Small-screen CSS: it scrolls if needed, with tighter padding.
  - Screenshots (local only) at 852×393 and 393×852: `docs/design/screens/local/mobile-perf-unsupported-*.png`.
- **For the PM:**
  1. `navigator.audioSession.type = 'playback'` would play through the silent switch, but it pauses the player's music. Recommendation: keep the default.
  2. The steady-30 rule also applies to weak desktop GPUs that can't hold Low at 60. Those used to jitter at 40–50 fps.
  3. Device re-creation without a reload is left open. The Reload screen stays, and the save is flushed first.
  4. Shared files touched: `games/last-rune/game/ctx.ts` (graphics options, frame cap, lifecycle) and `engine/save/store.ts` (`freeze`).
- **Open.**
  - Real-device pass (checklist in mobile.md §6).
  - Lower pre-render concurrency on phones if iOS kills the tab while sounds load.
  - Whether Safari on iOS exposes `timestamp-query`.
  - Samsung Xclipse GPUs.
