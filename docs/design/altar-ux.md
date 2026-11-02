# Altar UX

Owner: altar-scene. Code: `games/last-rune/scenes/altar/`. Screens: `docs/design/screens/altar-*.png`.

The altar has to read for someone who has never seen the rules. The board is the centre of
attention. Text is short, sits around the board, and never covers it.

## Screen

| Where | What |
|---|---|
| Top centre | Machine name; subtitle `Storm ×N · K strikes` (hidden while a verdict shows). If a north gauge would sit under it, the title and verdict move to the widest clear gap (`layout.titleX`). |
| Top right | `Undo Z` · `Clear Del` · `Back Esc` · **`Strike F`** (gold, the largest control) |
| Below the title | Verdict after a strike (`Not enough: needs 2, got 0`). On exact it is FUSE's `exactLine(tier)`. The numbers match a need label, so multi-machine verdicts carry no ordinal. In a narrow title gap (finale) it drops to 24 px. |
| Next to each machine | A large `Needs N` (40 px number), then `got M` after a strike, plus `Strike k: r` pips on multi-strike altars. Border and numbers are cyan for exact, amber for under and red for over. North and south machines put the label beside the cabinet (a south label sits level with the cabinet's top half); east and west machines put it below. A notch on the label points at its machine. Machines are 180–230 px and sit against the exit socket. |
| Bottom row, left of centre | Tray: one gem per kind, with `slot ×count`, between FUSE's sprite and the caption (slot centres x 470–1070; six slots close up to 120 px). Hover or hold a gem to see a one-line rule (`Bend Turns the bolt 90°.`); the tip is clamped between FUSE and the caption and its pointer still marks the slot. |
| Bottom right | FUSE caption card. It owns the caption lane (`CAPTION_LANE`: x ≥ 1130, y ≥ 820). No tray slot, count, label or tooltip may enter it (tested in `clarity.test.ts`). |
| Bottom line | One line of controls in small type. |

Layout (`layout.ts`) is computed from the puzzle alone: board size, storm side and machine
sides. It fits every puzzle from 4×4 up to the 10×8 finale.

## Controls

| | Pointer | Keyboard | Pad |
|---|---|---|---|
| Take a gem | click it in the tray | `1`–`6`, `T` cycles | LB cycles |
| Place | click a socket, or drag and drop | arrows/WASD move the gold cursor, `Enter` | d-pad/stick, A |
| Turn (Bend, Gate) | click the placed gem, or scroll | `R` / `Q` (also turns the gem in hand) | RB |
| Pick up / move | drag a placed gem; drop it off the altar to return it | `Enter` on any placed gem picks it up, keeping its turn | A |
| Remove | right-click | `X` | X |
| Undo / clear | buttons | `Z` / `Del` | Back |
| Strike | Strike button | `F` (hold to fast-forward) | Start |
| Skip strike | click | `Enter` / `Esc` | A / B |
| Leave | Back | `Esc` (drops the gem in hand first) | B |

`Enter` acts where the player is looking: the hovered socket, otherwise the cursor. On the
keyboard the rule is one rule: `Enter` picks up and puts down, `R`/`Q` turn. Only a mouse click
turns a placed Bend or Gate, since the mouse has no `R` to hand.

After `Enter` fills a socket, taking the next gem by key (`1`–`6`, `T`) moves the cursor on to
the nearest open end of the route, so a long route costs a gem key and `Enter` per socket. The
cursor is exposed as `data-cursor="x,y"` on `.lr-altar` for tests and tools.

## Board as a circuit (altar-clarity)

- **Blocked sockets** are sealed with a pale, flush capstone with a deep X cut across it. Open
  sockets keep a dark bowl and rim; the veil over quiet sockets stops inside the rim, so a quiet
  open socket never reads as a blocked one.
- **Light:** a work light over the slab and a lamp over each machine (`altar-view.ts`), so the
  lower rows of big boards and every machine cabinet read before the first strike.
- **Fizzle tags** name the cause, then fade after about 3 s; the red ring stays.

- **Quiet sockets.** Only sockets that matter right now stay bright: the storm entry, each
  machine's exit socket, fixed and placed gems with their four neighbours, and the route's open
  end. Every other empty socket gets a dark stone skim (`CircuitOverlay.veil`) and recedes. It
  still accepts a gem, and it brightens as soon as a gem lands next to it. The rules do not
  change (`circuit-model.ts: liveSockets`).
- **Conduits.** Brass-wired grooves run from the storm to its entry socket and from each exit
  socket to its machine's port. The storm conduit glows when a strike starts. A machine's
  conduit glows in the bolt colour as charge arrives, then settles cyan, amber or red.
- **Route preview** (`PREVIEW_PATH`, on by default; PM decision). While editing, the route
  strike 1 would take through gems already set lies faintly in the grooves, and the empty socket
  it reaches next glows amber. It shows direction only, never charge.

## Affordances

- **While a gem is held, the live sockets it can go in hum** in that gem's colour. Quiet
  (veiled) legal sockets hum faintly, so the circuit stays the loudest thing on the board. The
  socket under the pointer or cursor hums brighter. An illegal socket glows red and gets a
  short tag explaining why (`Carved stone: nothing fits here`, `Part of the machine: it stays`,
  `None left in the tray`).
- Fixed gems and hint-locked gems wear a gold ring.
- **First altar (`intake-desk`, until it is solved):** the socket next to the storm pulses gold
  and the first tray gem bobs, until a gem goes into that socket. After 9 s with no board change
  on an empty board, FUSE nudges once (`TEACH_NUDGE`, `nudge.teach`).
- **First appearance of a gem** (any altar, `teach.ts`). A kind is new when no solved altar had
  it. A new fixed gem pulses and wears a card with its rule's first sentence (`Bend Turns the
  bolt 90° between its two joined sides.`) until the first strike. A new tray gem bobs until
  it is first picked up. FUSE says `gemNudge(gem)` (`nudge.<gem>`) once, queued after the
  arrival line, for fixed gems on arrival and for tray gems on first pickup. Channel's line is
  `nudge.channel`.

## Strike

The bolt plays the sim trace in time order (0.15 s per tick), coloured per gem. Gems energise
as it passes. Multi-strike puzzles play each strike in turn, and each machine's needle and
reading update per strike. Hold `F` to fast-forward at 3×; click, `Enter` or `Esc` to skip at 10×.

| Outcome | What the player sees |
|---|---|
| exact | Gauges settle cyan, the board flares white-hot, the machine wakes; solve moment |
| under | Amber needle short of the mark; the machine's conduit and label turn amber; verdict gives both numbers |
| over | Breaker trips: red flash (softened by `reduceFlashes`), shake (off in reduced motion), spark burst. Funny, never punishing: nothing is lost. |
| dead | Fizzle ring and tag at the cell where the bolt stopped (`Empty socket: the bolt fizzled`) |

**Charge chips** (`chargeChips`) label the bolt on the board as it plays: the storm's charge as
it enters, every place the charge changes (Amplify, Split, Gate, Capacitor), and what lands at
each machine, in the outcome colour. Channels and Bends get no chip, so a long route stays clean.
Chips scale with the board pitch (16–24 px).

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

- `altar-board.png`: furnace on arrival. The quiet board, the storm and machine conduits, and the new Amplify's rule card.
- `altar-intake-held.png`: first altar with a Channel in hand. Live sockets hum, the Bend card shows, and the tray tooltip is visible.
- `altar-strike.png`: the finale mid-strike, with charge chips.
- `altar-exact.png`: intake-desk exact, showing the `exactLine` verdict and the label lit cyan.
- `altar-solve.png`: capacitor-bay solve moment.
- `altar-under.png`: furnace with both Amplifies skipped (needs 8, got 4). The chips show the 4 all the way.
- `altar-over.png`: conveyor-a doubled past its need (needs 4, got 8). The chips show 4, then 8 at the Amplify.
- `altar-multistrike.png`: the finale one gem short, with per-strike pips on each label.
