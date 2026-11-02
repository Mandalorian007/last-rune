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

### 2026-11-02 — wave 1 (engine-systems agent)

**Progress**
- `engine/save`: versioned localStorage slots: envelope `{v,t,d}`, key `thunderclap:<game>:<slot>`,
  migration chain, schema/guard validation, debounced writes, `:backup` copy before a migrated or
  recovered load overwrites anything, memory fallback when storage is blocked/partitioned/full,
  checksummed export/import strings (`TC1.…`). 18 tests.
- `engine/input`: typed action map over keyboard (`KeyboardEvent.code`), mouse, wheel and gamepad;
  per-tick pressed/held/released latching; pointer in design coords through an injected transform;
  `blocked` gate. 17 tests (Node + happy-dom).
- `engine/audio`: AudioEngine with master←music/sfx/ui buses, a context created/resumed on the first
  gesture, voices with caps, and deferred loops. Declarative `SoundSpec` → OfflineAudioContext
  procedural synth plus 8 recipes (zap, chime, thud, click, whoosh, sparkle, crackleLoop, dronePad);
  `persistMixer` stores volumes via engine/save. 28 tests. All recipes were rendered in Chromium
  (no NaN; one-shots start and end at 0; loops are seamless; ~80 ms in total).
- `engine/ui`: overlay scaled into the letterbox rect; panel stack (modal focus trap, Esc, focus
  restore, `inert` lower layers, `hasModal`); toasts; caption card (typewriter + queue + live region
  + reduced motion); button/slider/toggle; theme tokens as `--tc-*` custom properties. 13 tests,
  plus a Chromium layout/focus check.

**Decisions (local to this workstream)**
- UI sizes are in design px (1920×1080) and one CSS transform scales them. Fonts are system serif/UI
  stacks only, with no runtime fetches.
- Input calls `preventDefault` only for bound keys that have no Ctrl/Meta/Alt, aren't typed into a
  form field, arrive while not blocked, and arrive while the document has focus. Wheel and
  contextmenu are swallowed only when bound. All input is released on blur/hidden. This keeps the
  itch parent page scrollable and its shortcuts working.
- The panel stack consumes Esc on `document` (with stopPropagation) so the input map on `window`
  never sees a panel-closing Escape.
- Audio volume uses a v² curve. One-shots are dropped (not queued) while audio is locked; loops are
  deferred until unlock.
- Storage is probed with a round-trip write. On any failure the store keeps working in memory and
  reports `persistent: false` so the game can show a "progress won't be saved" notice.

**Open issues / for PM**
- Platform has to call `overlay.setRect(rect)` and `input.setPointerTransform(fn)` on resize. Both
  are setters, so the wiring belongs to engine-render/platform.
- No key-rebinding capture UI yet (the bindings API supports it). Gamepad access can be denied by an
  iframe permissions policy, in which case `getGamepads` returns nothing (handled, just silent).
- Partitioned storage in a third-party iframe (Safari/Firefox) can be wiped independently of the
  top-level site. The export string is the escape hatch, and wave 2 should expose it in settings.
- OfflineAudioContext rendering is verified only in Chromium. Safari is untested.
