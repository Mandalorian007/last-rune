# Workstream: audio-design (wave 2)

**Owns:** `games/last-rune/audio/` (sound bank, music/ambience, mix presets), `games/last-rune/scenes/_demo/audio-demo.ts`, `docs/design/audio.md`.
**Depends on:** merged `engine/audio` (synth toolkit, recipes, buses) and `engine/ui` (for the demo panel).

## Deliver (all procedural, no audio files, D-001)
1. `docs/design/audio.md`: sonic identity. Lightning factory, stone halls, gems as glassy bells keyed per gem colour (each gem kind gets its own pitch/timbre family), FUSE as warm brass/servo blips. A mix plan per scene.
2. **Sound bank** `audio/bank.ts`: named game sounds built on the synth toolkit (extend with game-side recipes as needed), e.g. gem pick/lift, gem place (per kind), rotate, socket blocked/invalid, bolt travel crackle (loopable, intensity param), bolt step through gem (pitched per kind), machine under (fizzle), machine exact (solve fanfare: rising chime stack + thunder), breaker trip, storm cell hum (1×/2×/4×), gem granted, door unlock, page found (paper), codex open/close (book), UI hover/click, FUSE talk blip (a pitch-varied per-character voice), FUSE quiet variant, ending swell.
3. **Ambience and music**: hall ambience (distant storm, hum, drips), altar loop, journal (candle, quiet), ending (warm gold swell). A generative music bed or evolving drone pads that intensify by tier (tier 1 light, tier 3 sparse and tense, ending warm). Seamless loops; crossfade API (`setMood(...)`).
4. `audio/index.ts`: a game-facing API (`sfx.play('gemPlace', { gem })`, `music.setMood('hall-t2')`, etc.) that wraps `engine/audio`. Lazy pre-render on first unlock so boot stays fast. Total pre-render time is measured and kept small.
5. `?demo=audio` (dev only): a panel with buttons for every sound and mood, so the PM/user can audition. Verify in Playwright that everything renders without NaN/clipping (peak ≤ -1 dBFS) and report render times.

## Log

### 2026-11-02: first full pass (audio-design agent)

**Delivered:** `docs/design/audio.md` (identity, tier arc, mix plan); `games/last-rune/audio/`
(`bank.ts` with 59 sounds, `voices.ts` recipes, `theory.ts`, `post.ts` reverb/trim/fades,
`render.ts`, `moods.ts`, `music.ts` director, `fuse.ts` voice, `index.ts` game API, `analyze.ts`,
`render-check.ts`); `?demo=audio`; `pnpm audio:check` (`scripts/audio-check.mjs`); 34 unit tests.

**Measured (headless Chromium, M-series Mac):** 59 sounds, 0 problems. Max peak -1.51 dBFS. The
offline render takes 1.6 s sequential and 0.8 s concurrent. The in-game pre-render after the first
click takes 0.87 s, in groups of 150 / 159 / 408 / 146 ms: interaction sounds are ready about 150 ms
after the first gesture. Decoded memory is 52 MiB, mostly the 12 s stereo pads. Live master peaks:
hall-t1 -18 dBFS, solve moment -3.7 dBFS, ending -9.3 dBFS.

**Decisions:**
- Everything is in D. Gems are on the D major pentatonic, and tiers change mode, not key (t1 major
  pent, t2 mixolydian, t3 dorian, ending major).
- Reverb is done game-side, offline, in pure TS (Freeverb), and it is loop-aware so loop seams
  stay clean. This is because the engine has no effects send.
- One-shots are trimmed to their audible length and given a raised-cosine edge fade, so every
  one-shot starts and ends at exactly 0.
- Loops are 6 to 12 s with whole-cycle frequencies and tremolo. Pads and ambience are rendered at
  22.05 kHz to halve the cost.
- The loop seam level check is relative to the material: crackle and wind move 2 to 5 dB between
  50 ms windows on their own, so the seam may jump as much as the material does.
- Pre-render starts on the first unlock, in priority groups: interaction, then machine, then
  rooms and pads, then the ending.
- `?demo=audio` loads before WebGPU boot, so it works without a GPU.
- Added a `codex` mood (a quiet hum and pad over the dimmed altar) and a `silence` mood.
- FUSE tier mapping follows the pitch ("tier 3 he gets quiet and fast"): `quiet` is lower,
  softer, and spaced 55 ms apart rather than 70 ms. The Last Rune is `silent`.

**Engine gaps (not changed, extended game-side):**
- No reverb or effects send. The game renders reverb offline (`post.ts`).
- No master limiter or compressor. Peaks are kept safe by levels alone, and live smoke shows
  -3.7 dBFS at the busiest moment. An engine-owned limiter on master would be a cheap safety net.
- `OfflineContextFactory` is not exported from `@engine/audio` (`render.ts` derives the type).
- `define()` takes no per-sound default bus, so the game passes `bus` on every play.
- There is no master tap for metering. The demo connects an AnalyserNode to `busNode('master')`.

**Open issues:**
- 52 MiB of decoded buffers. If memory matters on itch or mobile, shorten the pads to 8 s or
  render them mono with a stereo widener.
- The sound has only been checked objectively. A listening pass by the PM or user is needed on
  levels, the FUSE vowel colour and the tier 2 "wrong note".
- Game scenes still need wiring: call `createGameAudio` once at boot and `setMood` per scene and
  tier. FUSE captions should pass `audio.fuse.onChar(mode, line)`.
