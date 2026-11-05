# The Last Rune: rules spec (charge simulation)

Owner: rules-puzzles. Implemented by `games/last-rune/rules/sim.ts`. Every statement below is
covered by a test in `games/last-rune/rules/sim.test.ts`. If code and spec disagree, the code
is wrong.

Design goals: each gem fits on one codex page; the whole thing is deterministic; charge is
always a whole number; order matters in ways a player can be told in one sentence ("amber
before magenta").

**Words the player sees (D-040 addendum 4).** This spec says "bolt", "fizzle", "stem" and
"arms" because they are precise for engineers. On screen the one noun is **charge**: "the
charge", "a double charge", "Charge entering any other side is lost". Tray tips, teach cards,
verdicts, the Codex, the journal and FUSE's lines never say bolt, fizzle, stem or arms (nor
"joined sides") unless the screen teaches the word first. The lightning you see is still drawn
as a bolt; only the words change.

## 1. The altar

- The altar is a grid of sockets, `W × H` = `6×4`, `8×6` or `10×8`. Cell `(x, y)`, `x` grows
  east, `y` grows south. `(0, 0)` is the north-west socket.
- A socket is one of: **empty**, **blocked** (carved stone, can never hold a gem), **fixed**
  (a gem pre-set by the puzzle; the player cannot move or rotate it) or **placed** (a gem the
  player set from the tray).
- The tray gives a count per gem kind. The player may place up to that many of each kind.
- The **storm cell** sits just outside the altar, next to one edge socket, and fires into the
  altar. The **machines** (one or more) sit just outside the altar, each next to one edge
  socket. Corners are not valid positions. No two of them share a position.

## 2. Charge units

- Charge is counted in whole **sparks**.
- A storm cell fires a bolt of `4 × strength` sparks: 1× = 4, 2× = 8, 4× = 16.
- Each machine has a **full charge** (`need`), usually 4 sparks (one 1× bolt). The gauge shows
  `need` as 100%. Other values (2, 3, 6, 8, 16 ...) make arithmetic puzzles.
- Halving keeps charge whole as long as it is even. A Split that receives an odd bolt (1, 3,
  5 ...) shorts out: the bolt fizzles inside it. ("Can't split a spark.")

## 3. Bolts and movement

- A bolt has: a position, a travel direction, a charge, and an **amber mark** (has it passed an
  Amplify yet?).
- Bolts move one socket per **tick**. When a bolt enters a socket:
  - **empty socket** or **blocked socket**: the bolt fizzles. The circuit is broken; every path
    must be built.
  - **gem**: the gem handles it (section 4).
- When a bolt leaves the altar across an edge: if a machine sits there, the machine receives
  the charge; otherwise the bolt grounds harmlessly into the floor.
- Wasted charge is allowed. A bolt that fizzles or grounds does nothing else. ("Visitor set a
  Bend facing a wall. Outcome: wall remains unpowered.")
- **Sides.** A bolt travelling east enters a socket through its west side, and so on.

## 4. The gems

Rotation `rot ∈ {0,1,2,3}` turns a gem clockwise by `rot × 90°`. Bend, Gate and Split care
about rotation (D-031); for the other three `rot` is ignored (treated as 0).

| Gem | Colour | Rule |
|---|---|---|
| **Channel** | cyan | Carries the bolt straight on, whichever way it enters. Charge unchanged. |
| **Bend** | amethyst | An elbow joining two neighbouring sides. `rot 0` joins N–E, `1` E–S, `2` S–W, `3` W–N. Enter one joined side, leave by the other. Entering any other side: fizzle ("facing a wall"). |
| **Split** | magenta | One input, two outputs: the inverse of a Gate. Input side is `S/W/N/E` for `rot 0/1/2/3` (rot 0: input S, outputs W and E), so `rot` names the way the bolt travels as it enters. The bolt leaves by **both perpendicular sides** (its left and right), each with **half** the charge. Odd charge: fizzle. Both halves keep the amber mark. A bolt entering any other side (either output side, or the side opposite the input) fizzles, as at a Bend. |
| **Amplify** | amber | Carries straight on, like a Channel, and **doubles** the charge, **once** ("once per path" in older copy; teach-8 dropped the word): if the bolt already carries the amber mark it passes through unchanged. The bolt now carries the amber mark. |
| **Gate** | emerald | Two inputs, one output. Output side is `N/E/S/W` for `rot 0/1/2/3`; the two inputs are the sides perpendicular to it (rot 0: inputs W and E, output N). The gate fires only when **both** inputs are live **in the same strike**. It then sends one bolt out of its output side carrying the **sum** of the two inputs, with the amber mark if either input had it. A bolt entering the output side or the side opposite it fizzles. A lone input waits until the end of the strike, then fizzles. |
| **Capacitor** | ice | Straight-through, like a Channel. If it is **empty** when a bolt arrives, it **stores** the bolt (charge and amber mark) and nothing comes out. If it is **charged** when a bolt arrives, it **releases**: one bolt leaves straight on carrying **stored + incoming** charge (amber mark if either had it), and the capacitor is empty again. Its charge persists between strikes, not between attempts. |

### Order matters (the teachable consequences)

- **Amber before magenta.** Amplify then Split: `4 → 8 → 4 + 4`. Split then Amplify (one amber):
  `4 → 2 + 2 → 4 + 2`. Both halves of an amplified bolt are already marked, so a second
  Amplify after the split does nothing.
- **Stack two and the second one just feels important.** Amplify → Amplify: `4 → 8 → 8`.
- **The Gate re-joins a Split.** `4 → 2 + 2 → (gate) 4`. With an amber on one branch:
  `4 → 2 + 2 → 4 + 2 → (gate) 6`.
- **The Capacitor cheats.** It adds two strikes together, and that is not an Amplify, so it
  ignores "once per path": `4 → amber 8 → capacitor (8 + 8) 16`.

## 5. Strikes (pulses) and machines

- The storm fires a fixed number of **strikes** per attempt (`pulses`, shown as pips on the storm's
  Gives card and the Strike button; 1 unless the puzzle has capacitors in mind). Every strike starts with one bolt
  from the storm at tick 0.
- A strike runs until no bolt is moving. Then each machine reads its gauge for **that strike
  only**: the sum of all charge it received during the strike.
  - reading 0: nothing (dead).
  - reading < need: nothing (under). The gauge falls back.
  - reading = need: the machine **wakes**. It stays awake for the rest of the attempt and
    ignores later strikes.
  - reading > need: the **breaker trips**. The attempt ends immediately as a failure, even if
    other machines were awake.
- The attempt **succeeds** when every machine is awake. The storm stops striking as soon as
  that happens. If the strikes run out first, it fails.
- Without capacitors every strike is identical, so `pulses` only matters when a capacitor is
  on the board.

Outcome per machine: `exact` (woke), `over` (tripped its breaker), `under` (received charge on
some strike but never exactly `need`), `dead` (never received anything). Overall outcome:
`over` if any machine tripped, else `exact` if all woke, else `dead` if none received
anything, else `under`.

## 6. Collisions, loops and timing

- **One bolt per gem per strike.** Every gem except the Gate handles at most one bolt per
  strike. A second bolt that reaches an already-used gem fizzles there (the first bolt's work
  stands). If two bolts reach the same unused gem on the same tick, both fizzle (short), and
  the gem is used.
- A bolt that hits a side a gem does not accept (the back of a Bend, a Gate's output or back
  side, any side of a Split but its input) bounces off and fizzles **without** using the gem
  up; a later bolt from a proper side still works.
- **Gate:** each of its two input sides accepts one bolt per strike; a second bolt on the same
  side fizzles. Once fired, any further bolt fizzles.
- Because each gem is used at most once (twice for a Gate) per strike, every strike ends; there
  are no infinite loops. A bolt that loops back into its own path simply fizzles.
- A machine's edge socket handles one bolt per strike, so at most one bolt reaches a machine
  per strike. Combining charge is the Gate's job (or the Capacitor's, across strikes).
- **Determinism.** Within a tick, bolts are processed in the order they were created; the two
  halves of a Split are created left side first, then right side, relative to travel. A Split
  only takes a bolt travelling its `rot` way, so that is always `rot + 3` then `rot + 1` (rot 0:
  west, then east).

## 7. Render trace

`simulate()` returns, besides the outcome, an ordered list of segments, one per bolt hop:
`{ from, to, charge, colour, pulse, tick, t0, t1, end }`.

- `from` / `to` are cells (the storm and machine positions are outside the grid, e.g. `x = -1`).
- `colour` is the gem kind the bolt last passed (`channel` for the bolt straight out of the
  storm), so the ribbon changes colour at every gem.
- `tick` is the hop's start tick within its strike; `t0`/`t1` are normalised to `[0, 1]` over
  the whole attempt (strikes laid end to end, one tick of rest between strikes).
- `end` says what happened at `to`: `gem` (handled and passed on), `store` (capacitor stored
  it), `wait` (gate input; gate fired later), `fizzle`, `machine`, `ground`.

## 8. Placement legality (`validatePlacement`)

A gem may be placed on a cell that is inside the altar, not blocked, not fixed, not already
holding a placed gem, and only while the tray still has one of that kind left. (Moving a gem is
remove + place.)

## 9. Solver (`rules/solver.ts`)

`solve(p)` searches by following the bolts. A gem is only ever decided on a cell that a bolt
reaches, so empty sockets elsewhere are never enumerated. It counts **canonical** solutions:
every placed gem must carry charge that ends up in a machine. Solutions that only add idle
gems, such as a spare channel the bolt never reaches or a gem whose output fizzles, are not
counted separately. Within one search the solver drops a branch as soon as a placed gem has been
lit but can no longer reach a machine. Brute-force enumeration on small boards matches its counts
(`solver.test.ts`).

`isSolvable` and `essentialGems` use the same canonical search with `maxSolutions: 1`. In rare
cases a board is only solvable with an idle gem that changes things just by being there (for
example, it catches a stray bolt that would otherwise collide). The canonical search does not
look for those boards.
