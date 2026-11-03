# Workstream: perf-low

The game must hold up on an ordinary laptop with integrated graphics, not only on the M4. Background: `docs/workstreams/perf-tiers.md`, budgets in `docs/engineering.md`, `scripts/perf/`.

## Scope (perf-tiers follow-ups)
1. **GPU timing.** Use timestamp queries (`engine/platform`, feature-detected; fall back to frame-time heuristics). This lets DynamicResolution and the perf scripts see GPU cost directly.
2. **Low tier composite at scene resolution.** This cuts the ~4 ms floor; a softer image is fine on Low. Auto should pick it only when needed.
3. **Ending flood at DPR 2 on High** (~17–20 ms GPU). Bring it within budget without visibly changing the image at 1×. Options: cheaper bloom taps, half-res flood, or capped DPR for that pass.
4. **Weak-GPU simulation.** No integrated-GPU hardware is available, so approximate one:
   - force DPR 2 at 2560×1440 plus Low, or the scale factors in `scripts/perf/`;
   - measure fill cost per pass and report which passes dominate.
   - Write down an estimate for an Intel Iris Xe / AMD 680M class GPU, with your reasoning.
5. **First frame and load.** Measure time to first title frame and the audio pre-render (~0.9 s). Make sure nothing blocks input, and that the title animates while audio pre-renders.

## Constraints
- High at 1× DPR must look the same (side-by-side screenshots).
- No new per-frame allocation.
- `engine/` holds no game nouns.
- Don't change lighting intensities (candle-light owns them) or UI layout.

## Done when
- A table of before/after p95 CPU/GPU ms per scene (title, hall, altar small/large, ending) on High/Low/Auto.
- `docs/engineering.md` budgets updated.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### Branch `ws/perf-low` (merged with main at 008432b, after candle-light and difficulty-2)

**What changed**
- **GPU timestamps** (`engine/render/gpu-timer.ts`). The device requests `timestamp-query` when the adapter has it (`engine/platform/gpu.ts` reports `timestamps`). Every `renderer.timingEvery` frames the renderer brackets each pass (`scene`, post `bloom`/`rays`/`composite`/`upscale`, `pre` = compute before the scene) and reads the results back without stalling. Apple's GPU overlaps passes, so each pass gets its *marginal* time (end minus the later of its begin and the previous end); the parts sum to the frame. `FrameTiming.source` is `'timestamp'` or `'queue'` (the old submit→`onSubmittedWorkDone` fallback). DynamicResolution and Auto read the same `onGpuTime` hook, so they now see true GPU cost with nothing downstream changed. All buffers are preallocated, so there is no per-frame allocation.
- **Low composites at scene resolution** (`PostQuality.compositeAtScene`, Low only). When the scene target is smaller than the backbuffer, the composite writes an LDR target at scene size and a 1-tap bilinear `upscale` pass fills the backbuffer. High and Auto keep the output-resolution composite.
- **Ending pixel cap** (`GraphicsController.capPixels`). The ending caps scene pixels at the CSS pixel count (DPR 1) from `enter()` to `exit()`, following resizes. At 1× this changes nothing. At DPR 2 the scene renders at 1920×1080 and the composite upscales it, which cuts ~45% of the ending's GPU time.
- **Audio pre-render no longer freezes the title.** `audio/render.ts` used to run every sound's post steps (reverb, filters, normalise) back to back. They now run through a pump that yields every 8 ms (MessageChannel). This doubles the title frames drawn during the pre-render; total time rises ~5%.
- **Harness.**
  - `perf.spec.ts` adds a `ts` column with a per-pass split and a `budget` field.
  - Two new rows: `ending-door` and `ending-flood`. The old flood row actually measured the door phase: an async `waitForFunction` predicate resolves at once.
  - `PERF_BASELINE=1` undoes this branch's changes in the page, so before and after can run back to back.
  - New `load.spec.ts` (`PERF_LOAD=1`) runs against the production preview and reads the `lr:gpu-ready`, `lr:first-frame` and `lr:audio-ready` performance marks.

**The "~58 ms GPU p50 in the ending flood" that candle-light saw is a measurement artefact.** That `gpu` column is submit→`onSubmittedWorkDone` latency, not GPU cost. It counts waiting behind the browser compositor and every other GPU client (5–15 headless Chromes from other agents during these runs). In the same runs it read 70–120 ms while the timestamp cost was 9–25 ms and frames still landed every 16.7 ms. The real flood cost at 1× on High is 7.6–9.8 ms (ts p50, below). Use the `ts` column.

**Numbers.** Apple M4 10-core GPU, 1920×1080 CSS viewport, vsync on. Each column pair is a back-to-back run: `PERF_BASELINE=1` (before) then this branch (after), both on merged main. Values are timestamp GPU ms, p50 / p95. CPU encode p95 is 0.2–0.5 ms everywhere, before and after. Other agents' browsers were running throughout, so treat differences under ~1.5 ms, and any lone p95 spike, as noise. "altar" is the rune loaded (small); "strike" is a big strike (large).

| Scene | High 1× before | High 1× after | High 2× before | High 2× after | Low 2× before | Low 2× after | Auto 2× before | Auto 2× after | Auto 1× before | Auto 1× after | Low 1× before | Low 1× after |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title | 3.9 / 5.2 | 5.3 / 6.7 | 9.8 / 12.9 | 8.2 / 10.9 | 3.2 / 4.0 | 4.5 / 10.7* | 6.6 / 7.8 | 7.8 / 9.6 | 6.0 / 6.2 | 8.0 / 13.7* | 3.6 / 12.7* | 3.1 / 11.1* |
| hall start | 8.5 / 11.4 | 9.0 / 11.4 | 19.8 / 24.3 | 16.7 / 22.0 | 6.4 / 7.7 | 6.9 / 19.2* | 11.5 / 12.1 | 10.0 / 12.1 | 7.9 / 8.0 | 8.8 / 15.8* | 11.7 / 19.1* | 5.4 / 15.6* |
| hall end | 8.5 / 8.7 | 9.7 / 10.5 | 17.7 / 20.1 | 14.8 / 15.8 | 6.9 / 7.3 | 6.5 / 13.1* | 11.3 / 11.7 | 9.1 / 9.2 | 7.3 / 8.9 | 9.5 / 22.7* | 16.2 / 23.0* | 4.2 / 13.2* |
| altar (small) | 6.0 / 7.4 | 5.9 / 7.7 | 7.3 / 8.7 | 8.8 / 10.0 | 3.3 / 4.2 | 2.5 / 7.3* | 7.1 / 8.3 | 6.0 / 8.4 | 6.0 / 7.4 | 6.4 / 17.7* | 7.4 / 16.6* | 2.2 / 8.2* |
| strike (large) | 5.9 / 9.3 | 4.4 / 6.2 | 7.8 / 14.5 | 9.0 / 9.9 | 3.2 / 4.4 | 5.9 / 15.3* | 8.0 / 8.6 | 7.8 / 10.4 | 6.1 / 7.6 | 7.2 / 12.3* | 9.2 / 18.9* | 2.2 / 9.2* |
| ending door | 19.1 / 28.6* | 9.0 / 9.1 | **21.6 / 27.7** | **12.2 / 12.9** | 7.6 / 8.6 | 10.9 / 23.2* | 12.9 / 19.4 | 9.4 / 9.8 | 9.0 / 10.6 | 9.2 / 28.2* | 13.3 / 29.8* | 4.4 / 11.4* |
| ending flood | 9.8 / 19.4* | 7.6 / 7.6 | **16.2 / 19.2** | **10.7 / 11.1** | 5.6 / 7.5 | 6.0 / 14.5* | 9.6 / 10.8 | 8.5 / 8.6 | 8.5 / 10.5 | 8.4 / 20.5* | 4.2 / 20.0* | 3.9 / 11.6* |

\* Contended run. Its p95s are inflated, and dynamic resolution dropped the scale in some rows (Auto 1× after, Low 1× before), so only the p50s compare. The scenes the change targets do not depend on these runs.

What the numbers say:
- **Ending at DPR 2 on High**: door 21.6 → 12.2 ms p50 (p95 27.7 → 12.9), flood 16.2 → 10.7 (p95 19.2 → 11.1). Both are now inside the 14 ms target. At 1× the cap is a no-op: the scene is already 1920×1080 and `budget` reads 2.07 MP. On Auto at DPR 2 the ending now holds a fixed 1920×1080 instead of dynamic resolution's 0.8 × 2560.
- **Low composite at scene resolution**: at DPR 2 (2560×1440 out, 1280×720 scene), composite 0.72–1.00 ms → composite + upscale 0.5–0.65 ms (quiet runs: 0.94 → 0.32 + 0.33 ms on the title). The saving is ~0.3–0.4 ms on the M4, not 4 ms. The "~4 ms floor" in the brief was a floor in the queue-latency column, not in GPU work: the timestamp total for Low at DPR 2 is 2.5–3.3 ms on the light scenes. The saving scales with output pixels × composite ALU (fog, grade, dither at 3.7 MP). On a GPU with ~2.75× less fill it is ~1 ms, which is why only Low turns it on.
- **High at 1×**: no change outside noise. The ending cap is inert at 1×, and High never takes the scene-res composite.

**Visual check (side by side, `docs/design/screens/local/perf-low/`, not committed).**
- High 1× (`high-dpr1-before` vs `high-dpr1-after`; title, hall start and end, altar, strike, ending door and flood): identical framing, colour, bloom, mist and text. The only differences are animation phase (candle flicker, mist drift, the ring pulse behind the flood credits).
- Low 2× (`low-dpr2-before` vs `low-dpr2-after`, the hall at 2560×1440 out): mist, vignette and grade match. The dither grain is now at scene resolution and upscaled, so it is ~2 px wide and a touch softer, not visible at normal viewing distance. Text and UI are DOM and unaffected.

**Where the GPU time goes (per-pass fill cost).** The scene pass (lit full-screen materials, mist fbm, particles) is 75–85% of every frame.
- At High it costs ~3.6–4.2 ms/MP (hall 13.4–15.5 ms at 3.69 MP).
- At Low it costs ~5.5 ms/MP (hall 5.0 ms at 0.92 MP). Fixed costs such as the 256² storm sim and light setup weigh more at small sizes.
- The ending door is the heaviest scene per pixel, ~4.7 ms/MP, from overlapping light shafts and particles.
- Post is cheap:
  - bloom 0.3–2 ms (the high end under contention);
  - rays 0.2–1.5 ms (half res);
  - composite ~0.27 ms/MP.

**Weak-GPU estimate (Intel Iris Xe 96 EU, AMD Radeon 680M).**
- **M4 10-core GPU:** ~4.3 FP32 TFLOPS and ~120 GB/s. It is tile-based, so the rgba16f scene targets stay on chip.
- **Iris Xe:** ~2.1 TFLOPS on ~68 GB/s shared LPDDR4x. It is immediate-mode, so the 16-bit HDR targets and the bloom chain go through memory. Allow ~2.5–3× the M4's cost.
- **680M:** ~3.4 TFLOPS on ~100 GB/s LPDDR5, so ~1.3–1.6×.

Scaling the quiet p50s by those ratios:

| Case | M4 (ms) | Iris Xe (×2.5–3) | 680M (×1.3–1.6) |
|---|---|---|---|
| High 1080p, hall | 8.5–9.7 | 21–29: over budget, so Auto runs dynamic resolution at ~0.6–0.7, giving ~12–15 | 11–16: fits |
| High 1080p, ending door | 9.0 | 23–27: Auto at ~0.6 gives ~13–15 | 12–14 |
| Low at 1440p out, hall | 6.4–6.9 | 16–21: Low's dynamic resolution at 0.6–0.8 gives ~10–14 | 8–11 |
| Low at 1440p out, light scenes | 2.5–3.3 | 6–10 | 3–5 |

So an Iris Xe at 1080p holds 60 fps on Auto by running the scene at ~0.6–0.7 scale, or on Low. On a 1440p panel it needs Low, and the hall then sits near Low's 0.6 floor. The 680M runs High at 1080p and has headroom on Low. Where anything is over budget, the cause is the scene pass's per-pixel mist fbm and light loop, not post or draw count. These are estimates from throughput ratios, not measurements.

**Load (production build, `PERF_LOAD=1`, 4 runs each, back to back, contended).**

| | Before (unsliced post) | After (8 ms slices) |
|---|---|---|
| Navigation → GPU ready | 35–65 ms | 52–90 ms |
| First title frame | 97–164 ms | 124–159 ms (cold run 0: 379) |
| Audio pre-render | 1.64–1.71 s | 1.68–1.96 s (~+5%) |
| Title frames drawn during pre-render | 29–32 | 60–67 |
| Longest frame gap | 167 ms | 83–117 ms |
| Longest task | 82–84 ms | 79–89 ms |
| Arrow-key delay, max | 53–85 ms | 58–68 ms |

- The first frame is well under the 2 s budget.
- Input is never blocked for more than ~90 ms.
- The title keeps animating through the pre-render at about twice the old frame rate.
- On a quiet machine earlier (before main gained more sounds) the pre-render took 0.93–1.1 s; contention roughly doubles it.
- The longest tasks left are single sounds' synthesis loops, not the post steps: amb.storm, endingSwell and the pads take ~40 ms each in dev and ~80 ms under contention.

**Decisions taken (local; no DECISIONS entry needed)**
- Timestamp attribution is marginal per pass, so the parts sum to the frame on TBDR GPUs.
- The ending fix is a scene-pixel cap at DPR 1, not a per-pass change. It leaves the 1× image untouched and needs no new shader.
- The scene-res composite is a Low-only `PostQuality` flag. Auto still picks Low only under the existing rules (fallback adapter, predicted over budget at the 0.6 floor, or 4 s at the floor), so it is used only when needed.

**Open issues**
1. The longest load tasks (~40–80 ms) are whole-sound synthesis loops. Moving synthesis to a Worker, or slicing inside the synth loop, would bring max input delay under ~16 ms. Proposed as a follow-up, because it restructures the audio module.
2. These absolute numbers were taken under heavy contention from other agents' browsers. Re-run the matrix on a quiet machine before quoting p95s outside the team.
3. There is no real Iris Xe or 680M measurement yet. Check the estimate on hardware (a playtester's laptop) when one is available.
4. The harness keeps the `gpu` (queue-latency) column for the fallback path. Readers should use `ts`; the README now says so.
