# Workstream: tidy-2

Small leftovers from wave 5 (PM judgement).

## Scope
1. **Device lost:** stop the game loop, audio and timers while the "lights went out" dialog is up (bug-bash #16). Engine-side; no game nouns. Add a unit or e2e test.
2. **FUSE's clipboard drop on the ending:** it now travels ~290px right of his clamp to its resting spot (finish-1), and at fall speed it reads as a toss. Make the fall arc look natural: release nearer, a slight drift, or FUSE moves toward the spot first. Keep the resting position.
3. **Audio synth in a Worker (optional; do it only if it's clean):** the longest load tasks are 40–80 ms single-sound syntheses (perf-low). If synthesis can move to a Worker without restructuring the bank API, do it, and measure with `PERF_LOAD=1`. Otherwise leave a short written proposal.
4. **Lone flakes:** look into the rare unit-test flake in `pnpm check` (bug-bash) and the link-copy "gamepad A on Ko-fi with the new tab blocked" e2e flake (candle-light run). Fix the root cause if you can find it.

Out of scope:
- UI wording and layout (newcomer-2).
- Puzzles.
- Lighting.

## Done when
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass, and the full e2e suite passes 3 times in a row.

## Log

### 2026-11-02: tidy-2 (branch `ws/tidy-2`)

**1. Device lost (bug-bash #16): done.**
- `GameLoop.halt()` stops the loop for good: a later `start()` (the tab becoming visible again) and `tickOnce` do nothing.
- `AudioEngine.halt()` stops every voice, detaches the gesture listeners, drops queued loops, suspends the context, and refuses unlock/play/loop/prepare afterwards.
- `boot()`'s ok result gains `onDeviceLost(fn)`. Listeners run after the "lights went out" screen shows.
- `main.ts` wires the handler: halt the loop, dispose the music director's interval, halt audio, freeze the caption typewriter, commit play time and flush the save.
- Tests: unit tests in loop.test.ts and audio.test.ts. The e2e device-lost test in robustness.spec.ts now asserts that no AudioContext is running, no setInterval is live, and no rAF fires after a hidden/visible toggle. I confirmed it fails without the main.ts wiring.

**2. Clipboard drop: done.**
- New `clipDropPose()` and `CLIP_FALL_SECONDS` (0.62 s) in ending-model.ts.
- The board leaves the clamp with no speed. Its bottom edge falls with gravity, while the drift and growth toward the rest spot ease in later. It tips over with a slight flutter and lands with a 6 px settle.
- The rest pose is unchanged: (1640, 905), rot -0.22.
- The 'through' cue now waits for the landing.
- Frame-stepped contact sheets (before and after) are in `docs/design/screens/local/tidy-2/`, made with `scripts/playtest/tidy-2.spec.ts`.

**3. Audio synthesis in a Worker: not done. Proposal below.**
- Measured with `PERF_LOAD=1` over 3 runs, warm:
  - Audio pre-render: about 1.05 s, in 4 groups of 160–460 ms.
  - One long task of about 52 ms in the pre-render window.
  - Longest title frame gap: about 50 ms.
  - Input delay: 30–40 ms at most.
  - The cold first run was 153 ms / 133 ms.
- Why a Worker isn't clean:
  - `renderSound` needs `OfflineAudioContext`, which doesn't exist in Workers. The graph build and the DSP render have to stay on the main thread, and the DSP render already runs on the audio thread.
  - Only `postProcess` (pure Float32Array math) and the noise fill could move. `postProcess` is already sliced into chunks of about 8 ms (`SLICE_MS`).
  - Moving them means transferring channel buffers in and out of a module Worker, adding a fallback for vitest and node, and changing `renderDef`'s internals. The bank API stays the same.
  - The gain is bounded by the slices that are already short.
- Proposal if load jank becomes a priority:
  1. Attribute the remaining ~52 ms long task first, using a performance trace around `lr:audio-ready`. It is most likely one big graph build or `AudioBuffer` copy, not post-processing.
  2. If it is the graph or noise for one sound, split that sound or pre-fill its noise in slices.
  3. A Worker for `postProcess` only pays off if a trace shows post-processing above budget.

**4. Flakes: root causes found and fixed.**
- **Unit (`pnpm check`):**
  - Reproduced once in 60 shuffled runs (seed 23) while the machine was loaded.
  - The run took 22.8 s instead of the usual ~3.5 s. The finale search "cannot be solved without amplify" (0.8 s idle) took 11 s and hit vitest's 5 s default timeout.
  - Order and randomness play no part: the cause is CPU contention against a fixed timeout.
  - Fix: the solver checks get 60 s (`solver-checks.ts`) and the unit-test default is now 30 s (`vite.config.ts`).
- **e2e "gamepad A on Ko-fi with the new tab blocked":**
  - Input polls the pad once per fixed tick, but `padPress` held the button for 150 ms of wall-clock time.
  - The test presses right after `flow.state === 'title'`, which happens before the first frames draw. Instrumentation showed only 6–34 ticks had elapsed at the press.
  - When the first frames stall (pipeline compiles, a loaded suite), no tick lands inside the hold, so the press is never seen. The immediate non-retrying `__opened` check then fails.
  - Fix: `padPress` now holds and releases until the game loop has ticked 3 times, and the `__opened` checks after pad presses use `expect.poll`.
  - Passed 16/16 repeats alone and 28/28 across the file at 8 workers. Note that the original also passed when run alone, so the flake only shows under load.

**Shared files touched:**
- `games/last-rune/main.ts`: the device-lost wiring.
- `engine/core/loop.ts` and `engine/audio/audio.ts`: halt.
- `engine/platform/boot.ts`: `onDeviceLost`.
- `vite.config.ts`: `testTimeout`.
- `tests/e2e/robustness.spec.ts` and `tests/e2e/link-copy.spec.ts`.
- `games/last-rune/content/puzzles/solver-checks.ts`: test-only timeouts. No puzzle changes.
- Ending scene and model files.
- New file: `scripts/playtest/tidy-2.spec.ts`.
