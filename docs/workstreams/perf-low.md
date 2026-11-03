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
