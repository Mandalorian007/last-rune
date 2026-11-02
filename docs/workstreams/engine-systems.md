# Workstream: engine-systems

**Owns:** `engine/input/`, `engine/audio/`, `engine/ui/`, `engine/save/`.
**Contracts:** C6 in `docs/architecture.md`.

## Deliver
1. **input/**: pointer (mouse/touch/pen, unified), keyboard, gamepad polling → **action map** (game supplies bindings; engine has none). Pressed/held/released per frame, pointer position supplied via a coordinate-transform callback (platform owns letterboxing). Prevent default on game keys only while the game has focus (itch iframe).
2. **audio/**: WebAudio context unlocked on first user gesture (required in browsers and itch). Buses: master, music, sfx, ui, each with gain and mute. Volume settings persist via `save/`. One-shot and loop playback of `AudioBuffer`s. A **procedural synth toolkit**, since we ship no audio files: helpers to render short buffers offline (`OfflineAudioContext`) from oscillators, noise, envelopes and filters, plus a small library of named sound recipes that are **generic** (zap, chime, thud, click, crackle-loop, drone-pad, whoosh, sparkle). Game-specific sound design happens in wave 2/3 using this toolkit.
3. **ui/**: DOM overlay root positioned to match the letterboxed canvas (takes a rect from platform). Overlay stack (push/pop panels, focus trap, Esc to close), buttons, toasts, a speech/caption card primitive (the game uses it for FUSE's corner card), and theme tokens as CSS custom properties (fonts, colours, spacing, radii). Accessible: focus rings, `aria-live` for captions, keyboard navigation. Fonts: system/serif stacks or a self-hosted OFL font committed to the repo with its license file. **No Google Fonts CDN at runtime.**
4. **save/**: versioned slots in `localStorage` under a namespaced key (`thunderclap:<game>:<slot>`), a migrations chain (`v1 → v2 …`), debounced writes, a JSON schema guard. Safe when storage is unavailable or throws (Safari private mode, partitioned/blocked third-party storage in the itch iframe): fall back to in-memory and expose a `persistent: boolean` flag so the game can warn. Export/import of a save as a string (handy for players and testing).
5. READMEs for each module.

## Quality bar
- Unit tests for the action map, save migrations and failure fallback, overlay stack, and synth envelope math (test pure parts in Node; mock `localStorage`).
- Zero game nouns. No runtime deps.

## Log
_(agent appends progress, decisions, open issues here)_
