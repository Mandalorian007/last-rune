# Workstream: engine-cleanup (wave 4)

**Goal:** close the engine gaps and bugs that the wave 2–3 agents worked around, without breaking any caller. The engine is planned to be tagged `engine-v0.1` at M5.

**Owns:** `engine/`, `engine/**/README.md`, `games/last-rune/art/props/bolt*.ts` (trace timing only).
**Don't touch:** game scenes (`scenes/`, `art/hall/`), which other agents are editing in parallel. Every engine change must be additive or keep its current signature. If a caller has to change, list it for the PM instead of editing it.

## Deliver
1. **Bugs:**
   - `ParticleSystem.clear()` writes to a buffer created without `COPY_DST`; fix the usage flags and add a test.
   - `boltSegmentsFromTrace` uses a different timeScale from the sim trace. Make it match the trace's t0/t1 by default (keep an option for the old timing) so callers don't need their own timing.
   - `Fuse` (art prop) has no `destroy()`; add one that frees its GPU resources.
2. **Gaps:**
   - per-instance or per-draw uniforms beyond `params`/`tint`;
   - linear texture upload;
   - a ping-pong render-target helper;
   - global keys in `Input`;
   - a master limiter and optional reverb on the audio graph;
   - export `OfflineContextFactory`.

   Each gets a small API, a unit test where it's testable, and a README note.
3. **Input taps:** today two taps of the same key inside one tick count as one press. Decide whether `Input` should queue taps so that each one is a separate `pressed` on consecutive ticks. Implement it only if it's simple and safe, and document the decision.
4. **Perf check:** the `?demo=render`, `?demo=art` and `?demo=props` pages and the hall still run at 60 fps, with no new per-frame allocations.
5. `pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log
