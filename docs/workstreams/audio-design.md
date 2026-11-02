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
