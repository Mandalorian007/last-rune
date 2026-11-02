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

### 2026-11-02 (engine-cleanup agent, branch ws/engine-cleanup)

**Bugs**
- ParticleSystem.clear(): the particle buffer now has STORAGE | COPY_DST. clear() defers the reset to the next prepare(), which zeroes the buffer with encoder.clearBuffer. It used to upload a 5 MB zero array. Queued emits are dropped, and emits made after clear() survive.
- boltSegmentsFromTrace: by default the timing follows the trace. The duration in ticks is 1/min(t1-t0), and each tick lasts TRACE_TICK_SECONDS = 0.15 s, which is the altar tick. Options: tickSeconds, duration, and the legacy timeScale, which wins when set.
- Fuse.destroy() frees its material's uniform buffer.

**Gaps**
- Per-draw uniforms: MaterialDesc.perDrawUniforms plus DrawParams.uniforms. Each draw gets its own block, bound with a dynamic offset. There is one upload per material per frame, and the buffer grows by doubling.
- Bind groups are cached per texture-view set (the last 4), so ping-pong does not allocate.
- Textures: textureFromSource(src, label, { linear }), textureFromPixels(...), writePixels(...), and bytesPerTexel.
- PingPong: renderer.createPingPong(desc), plus step, read, write, resize and destroy.
- Input global keys: InputOptions.globalKeys, setGlobalKeys and isTextEntryTarget.
- Audio:
  - a master limiter, on by default, configurable or off with `limiter: false`;
  - optional procedural convolution reverb: options.reverb, setReverb, setReverbSend, and the dsp helper reverbImpulse;
  - the OfflineContextFactory type is now exported.
- Test infrastructure: engine/render/fake-gpu.ts is a recording fake device that validates usage flags. With it, Renderer, ParticleSystem and the props run in Node.

**Decision: Input queues repeat taps (default on, `queueTaps: false` to opt out).**
- Why: the e2e press() helper had to wait a tick between key presses, and a fast double tap could merge into one press.
- How: a key that goes down again before the tick that saw its first tap queues one extra press, capped at 8 per key. Each queued press fires `pressed` on a later tick. `held` stays true, and `released` fires once the queue drains.
- Safety:
  - The queue is cleared while blocked, on releaseAll and on setBindings.
  - Holding another binding of the same action still does not re-press it.
  - Only taps that land inside one tick change behaviour, so slower input works as before.

**Verification**
- `pnpm check` passes: 524 tests pass and 2 are skipped, up from 489.
- `pnpm build` passes.
- e2e: 8 of 8 pass. Ports 4173 and 8790 were held by another agent's servers, so I ran the same specs from a temporary copy on 4183 and 8800, against this branch's dist/. Both the copy and its config were deleted afterwards.
- Perf: headless Chromium on the Metal adapter, 300 rAF frames per page, with this branch compared against the merge base 28bf494.

  | Page | fps | p95 | Heap churn per 300 frames (branch vs base) |
  |---|---|---|---|
  | ?demo=render | 60 | 16.8 ms | 810 vs 785 KB |
  | ?demo=art | 60 | 16.7 ms | 922 vs 967 KB |
  | ?demo=props | 60 | 16.7 ms | 354 vs 355 KB |
  | hall | 60 | 16.7 ms | 846 vs 846 KB |

  None of the four pages logged a console error or a GPU error. The heap churn existed before this branch, and the new code paths add no per-frame allocations.
- The new frame paths reuse their state:
  - The dynamic-offset array is a single reused array.
  - The per-draw staging is persistent.
  - The list of per-draw sets is cleared in place.

**Caller migrations (for the PM; scenes and art/hall were not touched)**
- storm.ts:
  - replace simA/simB plus copyTextureToTexture with renderer.createPingPong;
  - destroy() should also call material.destroy().
- bolt, storm and fuse could share one perDrawUniforms material instead of one material per instance.
- Emboss and mask textures should use textureFromPixels or textureFromSource(src, label, { linear: true }).
- game-shell: the C (codex) and O (settings) shortcuts could use `globalKeys: ['KeyC', 'KeyO']` instead of blurring HUD buttons.
- games/last-rune/audio/render.ts: import OfflineContextFactory from @engine/audio instead of deriving it.
- altar:
  - it can use ParticleSystem.clear();
  - it can drop its own bolt timing in favour of the boltSegmentsFromTrace default. Note that the altar uses a 0.9 s pulse gap, while the sim uses a 1-tick gap, so keep timeScale or duration if the current look must stay.
- Scenes that create a Fuse should call fuse.destroy() on exit.
- e2e press() helpers can drop their between-press tick waits now that taps queue (optional).
- The limiter is on by default and catches only peaks above -1 dBFS. Audio owners should listen once, and they can opt out with `limiter: false`.

### 2026-11-02 (PM addition: post blending, merge of main)
- Added `post.blendTo(patch, seconds, ease?)` to `engine/post`:
  - Numbers and RGB colours ease from their current values. The default ease is smoothstep; `easeLinear`, `easeIn` and `easeOut` are exported too.
  - `enabled: true` applies at once. `enabled: false`, `tonemap`, `dither` and `bloom.levels` switch when the blend ends.
  - A later `set` or `blendTo` on the same key takes over from wherever that key is.
  - Blends advance with the frame time inside `encode`, and each step counts at most 0.1 s.
  - Also added: `post.blending`, `post.finishBlend()`, `post.advanceBlend(time)`, and the pure class `PostBlender`. Nothing allocates per frame.
  - 7 unit tests, and a README section titled "Easing between looks".
  - No callers were migrated. The ending can replace its preset swaps hidden behind a white or dark wash with `blendTo`.
- Merged main (story-scenes) into this branch with no conflicts.
  - `pnpm check`: 556 tests pass and 2 are skipped.
  - `pnpm build` passes.
  - e2e: 10 of 10 pass, including `ending.spec`. As before, I ran the specs from a temporary copy on remapped ports (4183, 8800 and 5185), because another agent's servers held 4173, 8790 and 5175.
