# The ending

Owner: story-scenes. Code: `games/last-rune/scenes/ending/`. The script is `content/ending.ts` `ENDING_SEQUENCE` plus `content/lines.ts`, used verbatim. Pitch screen 7 sets the look.

## How it is reached

When the Last Rune is solved and the facility is complete, `flow.finishSolve()` hands the `SolveMoment` to the `ending` scene factory (`main.ts`). "Back to the hall" calls `flow.finishEnding()`. The save is kept and the hall is in its post-game state. A replay of the Last Rune (`moment.firstTime === false`) plays the ending again, and that replay can be skipped with the Skip button or Esc.

## Beats as implemented

`endingBeats()` in `ending-model.ts` derives the beat list from `ENDING_SEQUENCE`, starting at the first line. The silent arrival and "Only when the final gem is set" belong to the altar and the solve moment. Each direction is matched to a cue by a regex. `ending-model.test.ts` pins the order.

| # | Beat | On screen |
|---|------|-----------|
| 0 | Arrival | The hall view dims to dusk (alpha 0.62 wash and a held-back ending post). The rune warms to 0.3 and a faint storm begins. |
| 1 | `beat.rune-final-report` | FUSE, lower right, talking. |
| 2 | `beat.rune-lights` | The rune ignites. The engraving (rings, glyph band, the Builder's mark: an open triangle, a stave, a crossbar, three dots) lights gold. The storm funnel spirals into it. |
| 3 | cue `door` | The storm collapses into the centre. The aperture opens and a door of light rises from the disc. The view pushes in slightly (`approach`) to stand for the player walking toward it. |
| 4 | `beat.rune-not-for-you` | |
| 5 | cue `edge` | FUSE rolls to the edge of the gold light (x 1300) and looks at the door. |
| 6 | `beat.door-list` | |
| 7 | `beat.door-key` | |
| 8 | cue `through` | The clipboard falls from his clamp, turns, bounces and lands in the foreground (`clipboardDrop`). It stays there for the rest of the ending. FUSE rolls into the door, shrinking with depth, and fades. The screen goes warm white. |
| 9 | cue `chat-open` | White fades to near-black, then the mock chat fades in: ThunderClap server, channel list, #this-will-break, caret. Post goes flat (no fog, no god rays). |
| 10 | `chat.1`–`chat.3` | Typed into one FUSE message at 11 cps, or a whole line at a time with reduced motion. |
| 11 | cue `react` | Six reaction pills appear one by one, then "… are typing…". |
| 12 | cue `flood` | The chat shrinks to a point. Gold floods out from the rune (radial wash and light). `endingSwell` plays. The flood post is used: warm, but held below white. |
| 13 | title card | `endingTitleCard()`, then `safetyRecordLine(stats)` on a paper slip, then the credits one at a time. |
| 14 | end card | Join ThunderClap (only when the invite is https), the tip jar (hidden while `TIP_JAR_URL` is blank), the footer, and Back to the hall (focused). |
| 15 | idle 30 s | If there is no input for 30 s, the top sheet of the dropped clipboard flips to `beat.post-credits` ("Day 1. Hobby: people. Monitoring."). Any input resets the timer. |

## Privacy and network

The Discord link is a plain `<a href target="_blank" rel="noopener noreferrer">`. It is not created until the end card is shown. `[hidden]` is forced to `display: none` so the link cannot be clicked during the ending. The scene makes no `window.open` calls and no requests. The e2e test asserts that there are no popups, no main-frame navigations, and no off-host requests up to the end card.

## Look

- **Palette:** cool dusk over the hall; gold (1.0, 0.72, 0.3) for the rune, the door and the flood; storm blue (0.45, 0.7, 1.0) for the funnel. The chat is deliberately "a very different kind of screen": flat dark UI in system type. Everything after it returns to gold.
- **Post:** `POST_PRESETS.ending` is too hot for the lit rune and door, so it is patched three ways:
  - `DUSK_POST` (bloom 0.7 / threshold 1.4, exposure 0.92) while the rune and door play.
  - `CHAT_POST` (flat) for the chat.
  - `FLOOD_POST` (bloom 0.9 / threshold 1.3) for the flood and end card.
  
  Post switches are instant (see engine gaps), so each one happens behind a full-screen wash.
- **Shaders:** one WGSL (`ending-wgsl.ts`) with four modes: disc, funnel, wash and door. FUSE and the clipboard reuse `Fuse`/`PropLightRig` and the journal's `DeskArt`.
- **Text:** the title uses the display font, with dark drop shadows so it reads on gold. The safety slip uses the journal's hand font. All fonts are local stacks.

## Accessibility and motion

- **Reduced motion:** no camera push, no storm motion, a static door, whole-line chat typing, and CSS transitions that change opacity only.
- **Captions:** FUSE's lines go through `ctx.fuse.say`, so they use the player's caption speed.
- **Keyboard:** Back to the hall is focused on the end card. Esc skips on replays.

## UI copy that is not story text (PM to confirm or replace)

- **Credits** (`CREDITS`):
  - "The Last Rune / A ThunderClap game"
  - "Every stone, gem, candle and spark / Drawn in code, on your GPU"
  - "Every sound / Synthesised as you play"
  - "FUSE / As himself"
- **Chat mock:**
  - Server name "ThunderClap".
  - Channels #welcome, #rules, #gem-theory, #screenshots, #off-topic (#this-will-break comes from `CHAT_CHANNEL`).
  - "today", "Message #this-will-break", "… are typing…".
  - Six invented reactor handles: ohm_sweet_ohm, gearwright, mossy.lamp, spark_plug, tarp_enjoyer, breaker-7. None are real people.
- **Labels:** "Safety record", "Skip".

## Screens

`docs/design/screens/`:
- `ending-rune.png`: the rune lit with the storm funnelling in.
- `ending-door.png`: the door.
- `ending-drop.png`: the clipboard down, FUSE going through.
- `ending-chat.png`: the chat with reactions.
- `ending-flood.png`: the gold flood with the title.
- `ending-credits.png`
- `ending-card.png`: the end card with the post-credits note.

## Iteration log

1. **Pass 1:**
   - The whole screen blew out to white: the funnel washed everything, and the disc and door clipped under the ending preset's bloom and god rays.
   - The flood direction text mentions "chat window", so it matched the chat-open cue; the chat never shrank and the title overlapped it. Fixed by putting the flood cue first and anchoring `^white fades`.
2. **Pass 2:** Cut the shader emission, set the dusk alpha to 0.62, capped the storm, and added `DUSK_POST`. The hall reads again, but the disc core and door were still white. Replaced the hexagram sigil with the Builder's mark so it doesn't read as a religious symbol.
3. **Pass 3:** `CHAT_POST` removed the yellow fog from the chat background. Lowered the aperture (0.1/0.24), the door brightness (0.5 → 0.7) and the core term; the engraving now reads at the ignite beat.
4. **Pass 4:**
   - End card: the full ending preset turned the flood into cream, and the glowing title text was illegible. Added `FLOOD_POST`, made the flood wash a deeper amber, and gave the title and footer dark shadows.
   - The credits overlapped the safety slip; moved them down to 650.
   - Found that `hidden` was overridden by `display: flex`, so the invisible end card was clickable during the ending. Forced `[hidden]` to `display: none`, and the e2e test now asserts the card is hidden until it is reached.

## Open issues

- At the door beat (`ending-door.png`) the door still blooms hot over the disc centre. It reads as light, but a little more restraint (or a bloom-threshold tween) would keep the mark visible behind it.
- The end-card background is the flooded hall at low contrast. It is readable but busy behind the title; a soft dark vignette behind the text could help.
- The ending runs about 2 minutes 20 seconds with normal captions. There is no pacing tune per caption speed beyond `fuse.say`.
