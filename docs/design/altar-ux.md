# Altar UX

Owner: altar-scene. Code: `games/last-rune/scenes/altar/`. Screens: `docs/design/screens/altar-*.png`.

The altar has to read for someone who has never seen the rules. The board is the centre of
attention. Text is short, sits around the board, and never covers it.

## Screen

| Where | What |
|---|---|
| Top centre | Machine name; subtitle `Storm ×N gives 4N · K strikes` (the storm states its charge in the same units as `Needs`) (hidden while a verdict shows). If a north gauge would sit under it, the title and verdict move to the widest clear gap (`layout.titleX`). |
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
| Place | click a socket, or drag and drop | arrows/WASD move the gold cursor (skipping carved stone), `Enter` | d-pad/stick, A |
| Go to the wire's end | (the amber socket is in view) | `G`: the wire's open end; again for the next end | R3 |
| Turn the gem under the pointer | scroll, or `R` / `Q` | `R` / `Q` at the cursor | RB |
| Pick up / move | click a placed gem (keeps its turn); drag it; drop it off the altar to return it | `Enter` on a placed gem picks it up, keeping its turn | A |
| Remove | right-click | `X` | X |
| Undo / clear | buttons | `Z` / `Del` | Back |
| Strike | Strike button | `F` (hold to fast-forward) | Start |
| Skip strike | click | `Enter` / `Esc` | A / B |
| Leave | Back | `Esc` (drops the gem in hand first) | B |

**One input rule (turn-clarity, turn-2).** The same for mouse, keyboard and pad:

- **Click / `Enter` / A picks up and sets down. It never turns anything.** On a placed gem with
  an empty hand it picks that gem up, keeping its turn. With a gem in hand it sets the held gem
  down in an empty socket. On one of the player's gems of another kind it swaps them (that gem
  goes back to the tray); on one of the same kind it does nothing and says so (`Bend already
  here: R or scroll turns it`).
- **Scroll / `R` / `Q` / RB turns the gem the player sees under the pointer** (the cursor on
  keys and pad). **A turn you see is a turn that sticks:** it is saved at once, with no click
  or `Enter`.
  - A gem on the board (the player's own) turns in place, whatever is in hand. The hand is
    not turned.
  - Over an empty socket, a gem in hand is drawn there, at its real turn, with the route
    preview running through it, and R turns that held gem.
  - While dragging a placed gem, the dragged gem turns; dropping it back where it came from
    keeps the turn.
- **The held gem is drawn only in empty sockets.** Over a placed gem it waits beside the socket,
  so the placed gem stays in plain sight at its real turn; its card (not the hand's) shows, and
  the turn arrow badge hides. Placing keeps the same kind in hand (stamping a route stays one
  click per socket); a turn made right after placing turns the gem just placed.
- **A gem that cannot turn says so, at that gem**, with the deny sound and the announcer, and
  nothing else turns in its place: Split `Can't turn: the bolt splits left and right`; Channel,
  Amplify, Capacitor `Can't turn: the bolt goes straight through`; a fixed Bend or Gate
  `Can't turn: fixed in place`. Over a fixed gem this holds even with a Bend in hand.
- **A socket that will not take the held gem** (fixed gem, carved stone) shows why in a tag above
  it while hovered, and the held gem is drawn beside the socket, not on it, so the gem or stone
  underneath stays in sight. The turn arrow badge hides there, since R would not turn the hand.

`Enter` acts where the player is looking: the hovered socket, otherwise the cursor. The hint
lane says it in one line: `Click a gem below, then a socket · R or scroll turns the gem you
point at · Right-click removes` (keys: `1–6 pick a gem · Arrows move · Enter place / pick up ·
R turns · G end of the route`; strike: `Hold F to speed up · Click or Enter to skip`). Turns are
announced with the sides used (`Bend turned: joins north and east.`, `Bend in hand: joins north
and east.`).

After `Enter` fills a socket, taking the next gem by key (`1`–`6`, `T`) moves the cursor on to
the nearest open end of the route, so a long route costs a gem key and `Enter` per socket. The
cursor is exposed as `data-cursor="x,y"` on `.lr-altar` for tests and tools.

Moving the cursor (polish-1): arrows never stop on carved stone, they slide to the next socket
that can take a gem (or stay put at the edge), and `G` jumps to the wire's open end, cycling
through the ends in the order the bolt reaches them. Both are pure functions in
`scenes/altar/cursor.ts`; `planCursor` gives the fewest presses for the e2e builders.

The key-hint line under the tray shows one short line for the current input: the mouse line
until the player uses a key, then the keyboard line, and the fast-forward line during a strike.
It sits between FUSE (x ≤ 410) and his caption card; the altar passes its measured box to
`fuse.avoid()` with the tray band, and at 125/150% text the caption lifts above it.

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
  short tag explaining why (`Solid stone: nothing goes here`, `Fixed: can't be moved or
  replaced`, `None left in the tray`).
- **Fixed gems** (and hint-locked gems) are part of the machine: iron corner brackets with a
  hex bolt head over the socket, and a cold iron ring (gold marks where the player acts).
  Hovering one, or putting the keyboard cursor on it, shows its card with a `Fixed in place`
  tag; the cursor also reads it through the announcer.
- **Gem info card** (one card, `.lr-altar-tip`). It never covers the board: it sits over the
  tray band, just above the slots, between FUSE and the caption. It shows, first match wins:
  the hovered or held tray gem (full rule, notch at its slot); the board gem under the pointer
  or cursor (first sentence, `Fixed in place` when fixed); on arrival, this altar's new gems for
  7 s, cut to a 0.5 s fade by the first placement (no fade under reduced motion). The briefing
  read on arrival ends with the same text; taking a gem announces its rule.
- **Turning.** A held Bend or Gate on the altar that first puts one in the tray (`turns` in
  `teach.ts`) wears a turn arrow with `R / Scroll` (`R / Q` on keys) until the player turns
  it once. Its card is tagged `R or scroll to turn`; a placed Bend or Gate's card is tagged
  `R or scroll to turn · Click to pick up` (`R or Q to turn · Enter to pick up` on keys; only
  `R or scroll to turn` with a gem in hand). Held over an empty socket it fits, the gem is tried
  there in the route preview, so the preview and every Split's glyph swing as it turns. Linking
  and Strike-ready ignore the held gem.
- **Split input.** A Split never turns, so it shows how it is fed: its glyph's apex and a small
  `in` pill sit on the side the bolt comes in by (the real feed, the held gem's would-be feed,
  or the storm's travel when nothing reaches it yet); the halves leave by the two sides beside
  it (rules.md section 4). Its card reads `The bolt can come in any side. It splits left and
  right, half the charge each way.`
- **Storm and needs.** Every altar shows `Gives N` by the storm and `Needs N` by each machine.
- **Strike-ready.** Strike glows on any altar once the route (over all strikes) reaches every
  machine. Reaching is not exact: the glow says the bolt has somewhere to go, not that the
  charge is right. Steady under reduced motion.
- **First altar (`intake-desk`, until it is solved):** the socket next to the storm pulses gold
  and the first tray gem bobs, until a gem goes into that socket. After 9 s with no board change
  on an empty board, FUSE nudges once (`TEACH_NUDGE`, `nudge.teach`).
- **First appearance of a gem** (any altar, `teach.ts`). A kind is new when no solved altar had
  it. A new fixed gem pulses (with guide stubs for Bend and Gate) until the first strike; a new
  tray gem bobs until first picked up. Until the first strike the route preview carries charge
  chips (dashed) into and out of each new gem it passes through, e.g. `4 → Amplify → 8`. FUSE
  says `gemNudge(gem)` (`nudge.<gem>`) once per new gem, one at a time when he is free after
  the arrival line, and skips it if the gem is already in use (the route reaches the new fixed
  gem, or a new tray gem is on the board). Channel's line is `nudge.channel`.

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
