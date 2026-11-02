# Workstream: story-scenes (wave 3)

**Goal:** the story lands. The Builder's journal is a place you *want* to visit, and the ending is the emotional payoff the pitch promises: FUSE's arc, the reveal, the Discord door.

**Owns:** `games/last-rune/scenes/journal/`, `games/last-rune/scenes/ending/`, `games/last-rune/content/codex.ts` (new: gem rule and maths text, moved out of `ui/codex-data.ts`), the `SceneFactories` additions `journal()` and `ending()` and the flow hook for the ending (`game/flow.ts` `finishSolve` when `complete`), `docs/design/ending.md`.
**Don't touch:** `scenes/altar/`, `scenes/solve/` (altar-scene), `scenes/hall/` + `art/hall` + `art/title` + `art/props/palette.ts` (hall-art), `audio/` (use `ctx.sound`), puzzle content (difficulty-fun). In `main.ts` only add the new scene factory entries.

## Deliver
1. **Journal desk scene:** reachable from the hall (a HUD button and key J; coordinate the hall entry point as a small, additive hook. Keep hall-scene edits minimal and tell the PM). A candlelit desk with parchment pages (procedural parchment, ink, the Builder's hand); found pages readable in order, unfound pages as blank slots with a hint of which tier they belong to. New pages are highlighted. Mood `journal`. Pages come from `content/journal.ts` (verbatim, never rewrite story text).
2. **Ending sequence:** follows the solve moment of the final machine. Beats come from `content/lines.ts` / `content/ending.ts` and the pitch (follow the pitch's ending section exactly: FUSE's lines, the clipboard drop, the reveal, safety record via `safetyRecordLine()`, credits). Then the end card with `endingButtons()`: the Discord door opens `DISCORD_INVITE_URL` in a new tab (`rel="noopener noreferrer"`, user click only), the tip jar is hidden while `TIP_JAR_URL` is blank, "Back to the hall" keeps the save (post-game state). Mood `ending`, `endingSwell`, `clipboardDrop` sounds. Skippable after first viewing; reduced-motion aware.
3. **Codex content:** create `content/codex.ts` as the single source for codex text (gem rules, charge maths) consistent with `docs/design/rules.md` (1 bolt = 4 sparks? present it the way the player sees it). The codex UI reads from it. Tests: every GemKind has an entry; text ≤ the card limits.
4. **Tests:** unit tests for journal ordering/visibility and ending button logic; a Playwright e2e that seeds a nearly-complete save, triggers completion via the dev handle, runs the ending through to the end card, and asserts the Discord button href and that nothing navigates without a click.
5. Screenshots `docs/design/screens/journal-*.png`, `ending-*.png` (each under ~400 KB). Iterate critically.

## Log

### 2026-11-02: story-scenes agent

**Codex (2e3c1ef).** `content/codex.ts` is the single source for gem rule and charge copy. The codex UI reads from it, and tests cover every GemKind and the card limits.

**Journal (5c1e6ba).** A candlelit desk at `scenes/journal/`, opened from the hall with the HUD Journal button or the J key.
- Found pages are listed in page order.
- Unfound pages show as blank slots with a tier numeral.
- New pages are sealed in wax.
- FUSE's rebuttal is on a brass plate.
- All art is procedural (`desk-wgsl.ts`, `desk-art.ts`).

Shared edits:
- `game/flow.ts`: `journal` and `ending` states; `openJournal`/`closeJournal`; `finishSolve` routes to the ending when the facility is complete; `finishEnding`. Flow tests added.
- `game/ctx.ts`: `SceneFactories.journal` / `ending`.
- `game/actions.ts`: the journal action.
- `ui/hud.ts`: the Journal button.
- `main.ts`: the factory entries.

Screens: `journal-desk.png`, `journal-day-one.png`.

**Ending (this commit).** See `docs/design/ending.md` for the beat table, the look and the four-pass iteration log.

Decisions:
- The beats are derived from `ENDING_SEQUENCE`; there is no second copy of the script. Each direction maps to a stage cue by regex. The flood cue is checked first because its text mentions "chat window".
- The ending preset is patched for each phase (dusk, chat, flood), because the full preset clips the lit rune and the end-card text.
- The end card is in the DOM but kept `[hidden]` with `display: none` until it is reached, so the Discord link cannot be clicked early.
- The rune's centre sigil is a "Builder's mark" (open triangle, stave, crossbar, three dots). It replaced a hexagram that could read as a religious symbol.

Shared-file edits (minimal and additive), for the PM:
- `art/props/fuse.ts` + `shaders/fuse-shaders.ts`: FUSE gains a `clipboard` boolean (default true), sent as `params.x`. When false, the shader pushes the board, paper and clip SDFs out of the frame, so the ending can drop the clipboard as its own prop. No other visual change. (art-props owns this file; please re-apply if it conflicts.)
- `main.ts`: `ending: (moment) => new EndingScene(moment)`.
- `scenes/stubs/solve-stub.ts`: removed the "Ending scene not built yet" toast.
- `playwright.config.ts`: a third webServer, the Vite dev server on 127.0.0.1:5175. The ending e2e needs the DEV-only `window.__game` handle.

Tests:
- `scenes/ending/ending-model.test.ts`: beat order, cues once each, end-card buttons, https-only links, the tip jar hidden when blank, the title-card variant, and skippable after the first viewing.
- `tests/e2e/ending.spec.ts`:
  - The full ending runs to the end card in about 1.4 min (reduced motion, instant captions). It asserts the Discord href, `target` and `rel`, that the tip jar is absent, and that there are no popups, navigations or off-host requests. Back to the hall goes to the hall.
  - A replay is skipped with Esc straight to the end card.

Open issues and gaps:
- Missing copy: the credits, chat server and channel names, reactor handles, and the "Safety record" and "Skip" labels are invented UI copy. They are listed in `ending.md` for the PM to confirm or replace. No story lines were missing.
- Engine gap: `ctx.post.set` applies immediately and there is no tween or crossfade between post settings. The ending hides each switch behind a white or dark wash. A `post.blendTo(patch, seconds)` would let the bloom ease down as the door opens.
- Visual: the door still blooms hot over the disc centre at its peak, and the end card sits over a busy flooded hall (see `ending.md`).
