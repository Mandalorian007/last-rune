# Workstream: tidy-3

User (2026-11-02): "fix the minor issues now". These are the last minor items before the playtest and v1.0. PM judgement applies (D-027: intuitiveness first, and visuals match the rules).

## Scope
1. **FUSE's caption covers his body.**
   - At 1280×720 with 150% text, when a fail verdict is docked on the altar, FUSE's caption covers his body on the left (newcomer-3 log).
   - Fix it so the caption, FUSE's body, the verdict and the red mark are all visible together. Use the existing avoid/lane system (`fuse.avoid(rects)` and the caption lane) rather than special cases.
   - Check 1280×720 at 100/125/150% and 1920×1080, with and without a docked verdict.
   - Add or extend a layout-fit e2e test.
2. **Amplify's doubled diamond blurs together in the Codex** under bloom (newcomer-3 doubled the mark in `shaders/gem-wgsl.ts`).
   - Make the two diamonds read as two at Codex portrait size, without bloom haloes merging them.
   - Options: more gap or a thinner stroke at small sizes, or less bloom on the portrait bake. Your call.
   - The altar must still read clearly. Check both.
3. **The hall's open alcove doorway reads white-gold**, not gold (candle-light log).
   - Make the available doorway read clearly gold/warm while it stays the brightest, most inviting thing nearby. Don't brighten the candles.
   - Small change only.
4. **The ~52 ms audio-load long task.**
   - Attribute it first, following the tidy-2 proposal (`docs/workstreams/tidy-2.md` §3): use a performance trace around `lr:audio-ready` with `PERF_LOAD=1`.
   - If one sound or one step causes it, split or slice that work so no task in the pre-render window is over ~50 ms.
   - Don't add a Worker. Log before/after numbers.

Out of scope:
- The ending scene and its files. ending-3 is running there; don't touch `scenes/ending/`.
- Puzzles and rules.
- Wording.

## Done when
- Before/after screenshots for 1–3 in `docs/design/screens/local/tidy-3/`. Don't commit them.
- Trace numbers for 4 in the log.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02: all four items done (branch `ws/tidy-3`)

Screens are local only, in `docs/design/screens/local/tidy-3/{before,after,crops}/`. They come from `scripts/playtest/tidy-3.spec.ts`:
`PLAYTEST_OUT=docs/design/screens/local/tidy-3/after pnpm exec playwright test -c scripts/playtest/playwright.config.ts tidy-3`.

**1. FUSE's caption no longer covers FUSE.**
- Cause: at 1280×720 and 150% text, the docked verdict was centred under the board, so it took up the caption's bottom-right corner. `CaptionCard.place()` then mirrored the card to the bottom-left, over FUSE.
- Change: two parts in `avoidTray()` and `clearRootMark()`, both using the existing avoid/lane system.
  - FUSE's body (x < `FUSE_LANE.x`, y > `FUSE_LANE.y − 30`) is now an avoid region. The card can still choose that corner, but never on top of him.
  - The docked verdict keeps its width and stays centred under the board, but is clamped to end left of `CAPTION_LANE.x − 12`. The caption therefore keeps its bottom-right corner.
- Evidence: in `before/caption-1280-150-verdict.png` the card sits on FUSE. In `after/caption-1280-150-verdict.png` the card is bottom-right, the verdict is under the board and shifted left, and both FUSE and the red mark ("Faces the wrong way") are clear. The other sizes (1280 at 100/125%, 1920 at 100/150%, plain and with a verdict) look clean in `after/`.
- Test: `tests/e2e/layout-fit.spec.ts` has a new test, "relay at {1280,1920}px, {100,125,150}%: FUSE's caption keeps off FUSE, the verdict and the red mark".
  - FUSE says his longest kind of line (20 words) before and after a fail strike.
  - The test asserts that the caption misses FUSE's body, the verdict and the red-mark socket; that the verdict misses the mark and FUSE; and that neither covers the tray.
  - Checked against the old scene: it fails at 1280/150 and 1920/150 ("the caption covers FUSE") and passes with the fix.
- Files: `games/last-rune/scenes/altar/altar-scene.ts`, `tests/e2e/layout-fit.spec.ts`, `scripts/playtest/tidy-3.spec.ts`.

**2. Amplify reads as two diamonds.**
- Change (`games/last-rune/shaders/gem-wgsl.ts`, kind 3 only):
  - the outer diamond goes from 0.46 to 0.54, and the inner from 0.22 to 0.20;
  - the stroke is 0.022 thinner than the other glyphs;
  - the stems are shortened to meet the outer diamond.
- Effect: the Euclidean gap between the two strokes goes from about 0.17 to about 0.24 gem units. The gap's midpoint now sits outside the stroke's soft edge, so it stays dark under glow and bloom. The portrait bake's bloom is unchanged, so the Codex still matches the altar.
- Evidence:
  - Codex: in `crops/before-codex.png` the inner diamond sits in one bright blob; in `crops/after-codex.png` there are two clean diamonds with a dark band between them.
  - Altar: `crops/before-altar.png` vs `crops/after-altar.png`. The held, fixed-in-place Amplify on the Furnace is still crisp. Full frames are `{before,after}/amplify-codex-1.png` and `amplify-altar-held.png`.
- Files: `games/last-rune/shaders/gem-wgsl.ts`.

**3. The open doorway reads gold.**
- Cause: the floor-level Intake Desk niche sits in the hall's floor fog (density 0.7 over the bottom 38% of the screen). That mist takes its tint from nearby bloom, and an available niche put almost no gold into the bloom. The door therefore read as pale grey-gold haze, and white-gold when focused.
- Change (`games/last-rune/shaders/hall-machine-shaders.ts`, available state only):
  - an open doorway adds a small gold spill to the bloom source (0.05, breathing with the existing pulse, fading toward the floor);
  - the niche work lamp moves from warm-white toward lamp gold (`mix(C_WARM, (1, .8, .48), .3)`), with key 1.5 → 1.7.
  - The candles and the restored or locked states are untouched.
- Measured with `test-results/tidy3/region.mjs` (sRGB means; niche x 905–1015, y 860–1000; candles x 750–830, y 700–840):

  | Shot | Region | Before | After |
  |---|---|---|---|
  | first entry | niche | luma 115.6, sat 0.59, hue 35° | luma 130.6, sat 0.61, hue 38° |
  | first entry + focus | niche | luma 130.9, sat **0.39**, hue 32° | luma 150.2, sat **0.52**, hue 39° |
  | first entry | candles | luma 163.3 (p95 253) | luma 161.5 (p95 254), unchanged |
  | mid-game | open Press niche | luma 79.1, sat 0.87 | luma 116.5, sat 0.92 |
  | mid-game | restored Furnace niche | luma 96.6 | luma 100.2 |

  The candle-region mean includes the flames, so the niche is not meant to beat it on mean luma. By eye, the gold doorway is the most inviting thing on the wall and the candles have not changed (`before/` vs `after/hall-first.png`, `hall-mid.png`; crops `crops/before-hall-first.png` vs `crops/after-hall-first.png`). In mid-game, open doors now read gold and restored ones read orange (fire), which separates the two states better.
- Files: `games/last-rune/shaders/hall-machine-shaders.ts`.

**4. Audio-load long task: attributed and sliced.**
- Attribution: a Chrome trace plus temporary per-sound timing; the instrumentation has since been removed.
  - The warm-run long task (51–57 ms) was one `TimerFire → RunMicrotasks` task: the inter-group `setTimeout`, then `AudioEngine.prepare()` starting group 2.
  - That group starts about 18 `OfflineAudioContext` renders in one go. Each `renderSound` builds its graph and fills noise synchronously before `startRendering`, and `storm.4` alone takes 8–13 ms.
  - The per-sound build times summed to the task length: 52.8 vs 53, 56.8 vs 57 and 58.2 vs 58 ms.
  - Next in line were single reverb post-process jobs for the pad loops (`pad.t1/t2/t3/ending/journal`, `endingSwell`, `amb.storm`). These took about 40 ms, and 50–57 ms once the first fix moved work around.
- Changes:
  - `engine/audio/audio.ts`: `prepare()` starts loads one by one and yields to the event loop (MessageChannel, with a `setTimeout` fallback) whenever 10 ms of synchronous start-up work has built up. It stops early if halted, then awaits all loads.
  - `games/last-rune/audio/post.ts`: the reverb tail is a generator that yields every 8192 frames (`applyReverbSteps`). `drain()` runs it in one go for the offline tools.
  - `games/last-rune/audio/render.ts`: `postProcessSteps` is a generator. The post pump steps it within its existing 8 ms slices, rather than running one whole job per slice.
  - No Worker. The output is identical: a unit test compares the sliced reverb with the one-shot reverb.
- Numbers (`PERF_LOAD=1`, `scripts/perf/load.spec.ts`, built preview, 1920×1080; run 0 is a cold browser):

  | | audioMs | longTasks | longTaskMax | frameGapMax | inputDelayMax |
  |---|---|---|---|---|---|
  | Before, warm runs 1–3 | 941–949 | 1 | 51–55 ms | 50 ms | 31.5–34.5 ms |
  | After, warm runs 1–4 | 870–896 | **0** | **0** | 16.7–16.8 ms | 11.9–16.1 ms |
  | Before, cold run 0 | 1116 | | 143 ms | 133 ms | 146.5 ms |
  | After, cold run 0 | | | 108 ms | 83 ms | 109 ms |

  - With instrumentation after the fix, the largest single synchronous step was about 13 ms (one graph build).
  - `pnpm audio:check`: 60 sounds, 0 problems, max peak −1.51 dBFS, in-game pre-render 904 ms. 74 audio unit tests pass.
- Files: `engine/audio/audio.ts`, `engine/audio/audio.test.ts`, `games/last-rune/audio/post.ts`, `games/last-rune/audio/render.ts`, `games/last-rune/audio/dsp.test.ts`.

**Open**
- The cold-browser long task (~105 ms) left on run 0 is not our code. The trace shows `pointerdown → AudioContext::AudioContext → AudioDestination::Create → RendererWebAudioDeviceImpl` at 86 ms: Chrome opening the audio device the first time. It happens inside the AudioContext constructor and cannot be sliced. It happens once per browser session.
- At 1280×720 and 150% text, the docked verdict is now slightly left of the board's centre, to stay out of the caption lane. It reads fine, but it is no longer perfectly centred.
