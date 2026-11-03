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
| 9 | cue `beyond` (D-032) | The white warms to amber gold with a soft, breathing core (static with reduced motion). `BEYOND_POST` eases in (no fog, no god rays, a light vignette). A quiet procedural crowd murmur (`amb.crowd`: talkers, a din, a few laughs) fades in under it. |
| 10 | `beat.beyond-arrived`, `beat.beyond-arguing`, `beat.beyond-day-1` | FUSE, from the other side, as ordinary captions over the light: "Hello. This unit has arrived somewhere with a great many people in it." / "You appear to be arguing about a game." / "Day 1." No chat window, server, channel, handles or reactions. |
| 11 | cue `flood` | The light settles back over the hall. Gold floods out from the rune (radial wash and light). The murmur fades out over 3.5 s. `endingSwell` plays. The flood post is used: warm, but held below white. |
| 12 | title card | `ENDING_COPY.titleCard` (three lines), then `safetyRecordLine(stats)` on a paper slip, then the credits one at a time. |
| 13 | end card | Join ThunderClap Gaming (only when the invite is https), the smaller Ko-fi link "Buy ThunderSoap a coffee" (D-034, only when `KOFI_URL` is https), the footer, and Back to the hall (focused). Arrow keys and the pad's d-pad walk the card. |
| 14 | idle 30 s | If there is no input for 30 s, the top sheet of the dropped clipboard flips to `beat.post-credits` ("Day 1. Hobby: people. Monitoring."). Any input resets the timer. |

## Privacy and network

The Join ThunderClap Gaming link and the Ko-fi link are plain `<a href target="_blank" rel="noopener noreferrer">`. They are not created until the end card is shown (`addEndLinks`). The Ko-fi link has no widget, script, iframe or remote image; its cup icon is inline SVG drawn in `ui/coffee.ts`. The same Ko-fi link sits in the title screen's bottom-right corner (D-034). `[hidden]` is forced to `display: none` so the link cannot be clicked during the ending. The scene makes no `window.open` calls and no requests. The e2e test asserts that there are no popups, no main-frame navigations, and no off-host requests up to the end card.

## Look

- **Palette:** cool dusk over the hall; gold (1.0, 0.72, 0.3) for the rune, the door and the flood; storm blue (0.45, 0.7, 1.0) for the funnel. Beyond the door is warm amber light (`BEYOND_AMBER`, `BEYOND_CORE`) with FUSE's captions on their usual dark card; the flood after it returns to gold.
- **Post:** `POST_PRESETS.ending` is too hot for the lit rune and door, so it is patched three ways:
  - `DUSK_POST` (bloom 0.7 / threshold 1.4, exposure 0.92) while the rune and door play.
  - `DOOR_POST` (bloom 0.5 / threshold 1.75, light god rays and fog, exposure 0.88) eases in over 3.8 s as the door opens, so its light doesn't bury the Builder's mark.
  - `THROUGH_POST` eases back up under the white-out; `BEYOND_POST` (no fog or god rays, vignette 0.45) eases in as the white warms to gold.
  - `FLOOD_POST` (bloom 0.75 / threshold 1.4) for the flood and end card. It eases in over 3 s (5 s with Reduce flashes) from fog and god rays at zero.

  Every change after arrival is a `post.blendTo`. The arrival is a hard set because the view itself cuts from the solve scene. The white-out and the white-to-gold wash stay because the story calls for them, not to hide a preset swap.
- **Shaders:** one WGSL (`ending-wgsl.ts`) with four modes: disc, funnel, wash and door. FUSE and the clipboard reuse `Fuse`/`PropLightRig` and the journal's `DeskArt`.
- **Text:** the title uses the display font, with dark drop shadows so it reads on gold. The safety slip uses the journal's hand font. All fonts are local stacks.

## Accessibility and motion

- **Reduced motion:** no camera push, no storm motion, a static door, a still core in the beyond light, and CSS transitions that change opacity only.
- **Captions:** FUSE's lines go through `ctx.fuse.say`, so they use the player's caption speed.
- **Keyboard and pad:** Back to the hall is focused on the end card. Tab, the arrow keys or the d-pad move between Join, Ko-fi and Back (`ui/menu-nav.ts`); the pad's A clicks the focused control. Esc skips on replays.
- **Text size:** the three-line title card sits at top 92 with tighter follow-up lines so it clears the safety slip at 100% and 150%.
- **Reduce flashes** (`ctx.settings.reduceFlashes`):
  - The white-out fades over 2.8 s instead of 1.6 s, to a dimmer warm white.
  - The door peaks at 0.45 instead of 0.7.
  - The funnel's sparks are frozen, so nothing twinkles.
  - The flood's gold rises over 6 s and the rune re-ignites over 2.5 s instead of 0.5 s.
  - The flood uses a softer bloom (`FLOOD_POST_CALM`) and a lower wash.
  - The beyond light is dimmer (wash 0.72, lower glow) and warms over 3.2 s instead of 2.2 s.

## UI copy that is not story text (confirmed by user, D-032)

- **Title card** (`ENDING_COPY.titleCard`):
  - "FUSE went to ThunderClap Gaming."
  - "He made friends. Loud ones."
  - "He still has questions about your safety record."
- **Credits** (`CREDITS`):
  - "The Last Rune / A ThunderClap Gaming game"
  - "Made by / ThunderSoap"
  - "Every stone, gem, candle and spark / Drawn in code, on your GPU"
  - "Every sound / Synthesised as you play"
  - "FUSE / As himself"
- **End card:** "Join ThunderClap Gaming" (same invite URL), "Buy ThunderSoap a coffee" (`KOFI_URL`, D-034), the footer "This was the whole game. Thank you for finishing it.", "Back to the hall".
- **Title screen:** "Buy ThunderSoap a coffee" in the bottom-right corner (D-034). FUSE's caption avoids it like the menu.
- **Labels:** "Safety record", "Skip".

FUSE is a game character, not a bot or a member of a real server: the ending shows no chat, server, channel or member details (D-032).

## Screens

`docs/design/screens/`:
- `ending-rune.png`: the rune lit with the storm funnelling in.
- `ending-door.png`: the door.
- `ending-drop.png`: the clipboard down, FUSE going through.
- `ending-flood.png`: the gold flood with the title.
- `ending-credits.png`
- `ending-card.png`: the end card with the post-credits note.
- `ending-card-newhall.png`: the title over the re-dressed hall, after main was merged (pass 5).
- `ending-flood-reduce-flashes.png`: the same beat with Reduce flashes on.

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
5. **Pass 5 (after merging main):**
   - The re-dressed hall (3-tier grid) is much brighter, and the old flood blew the title beat out to flat yellow.
   - Lowered the flood wash (0.5 → 0.34, emissive 0.35 → 0.14), its glow (0.22 → 0.12) and the `FLOOD_POST` bloom (0.9/1.3 → 0.75/1.4). The alcoves now read through the gold.
   - Added Reduce flashes support (see Accessibility).

6. **Pass 6 (engine adoption):**
   - Post changes ease with `post.blendTo` instead of hiding behind washes.
   - Door: the mark is cut out of the disc's inner light and aperture, and the door body thins over the disc centre. Together with `DOOR_POST`, the triangle, stave and dots now read through the door light.
   - The credits and the end-card footer have a soft dark backing over the gold.

7. **Pass 7 (ending-2, D-032/D-034):**
   - Removed the mock chat (window, server and channel names, handles, reactions, typing indicator, message bar) and its CSS and cue code. FUSE now speaks three captions over warm gold light, with a quiet crowd murmur.
   - New title card, credits and end-card copy (above). The three-line title collided with the safety slip; moved the title up to 92 and tightened the follow-up lines.
   - Ko-fi link on the title and the end card (D-034). Captures: `scripts/playtest/ending-2.spec.ts`.

## Open issues

- A gamepad A press on a link calls `click()`; browsers may not count a gamepad press as user activation, so the new tab can be blocked. Mouse, touch and keyboard Enter open it normally.
- The ending runs about 2 minutes 20 seconds with normal captions. There is no pacing tune per caption speed beyond `fuse.say`.
