# Altar UX

Owner: altar-scene. Code: `games/last-rune/scenes/altar/`. Screens: `docs/design/screens/altar-*.png`.

The altar has to read for someone who has never seen the rules. The board is the centre of
attention. Text is short, sits around the board, and never covers it.

## Screen

| Where | What |
|---|---|
| Top centre | Machine name; subtitle `Storm ×N · K strikes` (hidden while a verdict shows). If a north gauge would sit under it, the title and verdict move to the widest clear gap (`layout.titleX`). |
| Top right | `Undo Z` · `Clear Del` · `Back Esc` · **`Strike F`** (gold, the largest control) |
| Below the title | Verdict after a strike (`Second machine: not enough (needs 2, got 0)`) |
| Next to each machine | `Needs N`, then `Needs N · got M` after a strike (cyan exact, amber under, red over). North machines put it beside the cabinet so it clears the title; east, west and south machines put it below. |
| Bottom row, left of centre | Tray: one gem per kind, with `slot ×count`. Hover or hold a gem to see a one-line rule (`Bend Turns the bolt 90°.`) |
| Bottom right | FUSE caption card. Layout keeps every board 830 px or more above it (`TRAY_BAND`). |
| Bottom line | One line of controls in small type. |

Layout (`layout.ts`) is computed from the puzzle alone: board size, storm side and machine
sides. It fits every puzzle from 4×4 up to the 10×8 finale.

## Controls

| | Pointer | Keyboard | Pad |
|---|---|---|---|
| Take a gem | click it in the tray | `1`–`6`, `T` cycles | LB cycles |
| Place | click a socket, or drag and drop | arrows/WASD move the gold cursor, `Enter` | d-pad/stick, A |
| Turn (Bend, Gate) | click the placed gem, or scroll | `R` / `Q` (also turns the gem in hand) | RB |
| Pick up / move | drag a placed gem; drop it off the altar to return it | `Enter` on a gem | A |
| Remove | right-click | `X` | X |
| Undo / clear | buttons | `Z` / `Del` | Back |
| Strike | Strike button | `F` (hold to fast-forward) | Start |
| Skip strike | click | `Enter` / `Esc` | A / B |
| Leave | Back | `Esc` (drops the gem in hand first) | B |

`Enter` acts where the player is looking: the hovered socket, otherwise the cursor.

## Affordances

- **While a gem is held, every socket it can go in hums** quietly in that gem's colour. The
  socket under the pointer or cursor hums brighter. An illegal socket glows red and gets a
  short tag explaining why (`Carved stone: nothing fits here`, `Part of the machine: it stays`,
  `None left in the tray`).
- Fixed gems and hint-locked gems wear a gold ring.
- **First altar (`intake-desk`, until it is solved):** the socket next to the storm pulses gold
  and the first tray gem bobs, until a gem goes into that socket. After 9 s with no board change
  on an empty board, FUSE nudges once ("Take a gem from the tray. Put it in the glowing
  socket."). This text is provisional instruction copy, not a FUSE line; it is reported as a line
  gap.

## Strike

The bolt plays the sim trace in time order (0.15 s per tick), coloured per gem. Gems energise
as it passes. Multi-strike puzzles play each strike in turn, and each machine's needle and
reading update per strike. Hold `F` to fast-forward at 3×; click, `Enter` or `Esc` to skip at 10×.

| Outcome | What the player sees |
|---|---|
| exact | Gauges settle cyan, the board flares white-hot, the machine wakes; solve moment |
| under | Amber needle short of the mark; verdict names the machine and both numbers |
| over | Breaker trips: red flash (softened by `reduceFlashes`), shake (off in reduced motion), spark burst. Funny, never punishing: nothing is lost. |
| dead | Fizzle ring and tag at the cell where the bolt stopped (`Empty socket: the bolt fizzled`) |

FUSE reacts through `reactionLine(outcome, gems)`. Any edit returns the altar to edit mode.

## Solve moment

About 4.6 s on first solve, 2.6 s on replay. The beats are: light flood and chime (0 s), the
granted gem rising off the altar (0.9 s), the card with `X restored`, `New gem: Y` and its codex
line (1.7 s), then journal pages (2.4 s) and Continue. The first press reveals everything; the
second continues. Reduced motion shows the whole card at once and has no motes or shake.

## Dev hooks

In dev, `window.__altar` provides:

- `onPuzzleEvent(fn)`: `open`, `place`, `remove`, `rotate`, `reset`, `fire` (placements,
  outcome, per-machine readings per strike), `hint` and `close`.
- `hints.highlight(cell)` and `hints.lock(placement)`.

There are no events in production and nothing goes over the network.

## Screens

- `altar-board.png`: first altar (intake-desk), with the teach socket pulsing.
- `altar-intake-held.png`: a gem in hand, every legal socket humming, the rule tooltip.
- `altar-strike.png`, `altar-exact.png` and `altar-solve.png`: furnace, solved.
- `altar-under.png`: splitter-mill, with a socket left empty.
- `altar-over.png`: capacitor-bay, with the breaker tripped.
- `altar-multistrike.png`: the-last-rune, strike 1 of 2.
