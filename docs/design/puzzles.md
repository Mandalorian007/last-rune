# Puzzles

The 16 machine puzzles live in `games/last-rune/content/puzzles/<machineId>.ts`, one per
`MachineId`. `PUZZLES` / `puzzleFor(id)` in `content/puzzles/index.ts` is the lookup. Rules are in
`docs/design/rules.md`. Charge is in sparks: 1 bolt = 4 sparks, a 2× storm gives 8 and a 4× storm 16.

Each puzzle file holds the board as ASCII, the tray, the intended solution, a one-line insight, a
time estimate, the capabilities it assumes, and the gems it can't be solved without. The suite
(`content/puzzles/*.test.ts`) checks every claim below.

## Capabilities: assumed vs guaranteed

"Guaranteed" means the machine's requirements plus everything granted by machines that have to
come first in the progression-content capability graph (PM update). Channel is always available.
Each puzzle assumes only guaranteed capabilities. `puzzles.test.ts` enforces this from the
`GUARANTEED` table in `content/puzzles/expectations.ts`. It also checks the other direction: the
tray, the storm strength and the altar size never use anything the puzzle doesn't list as assumed.

| Machine | Guaranteed | Assumes | OK |
|---|---|---|---|
| intake-desk | nothing | nothing (Channel) | yes |
| furnace | Bend | Bend | yes |
| splitter-mill | Bend | Bend | yes |
| relay-tower | Bend | Bend | yes |
| conveyor-a | Bend | Bend | yes |
| press-unit-4 | Bend, Amplify, Split | Bend, Amplify, Split | yes |
| storm-cell-2 | Bend, Split | Bend, Split | yes |
| crane | Bend, Gate | Bend, Gate | yes |
| boiler-room | Bend, Split, storm 2× | Bend, Split, storm 2× | yes |
| archive | Bend, Gate, altar 8×6 | Bend, Gate, altar 8×6 | yes |
| foundry | Bend, Amplify, Gate | Bend, Amplify, Gate | yes |
| capacitor-bay | Bend, Split, Gate, storm 2×, altar 8×6 | Bend, Split, Gate, storm 2×, altar 8×6 | yes |
| lift-shaft | + Capacitor | Bend, Split, Gate, Capacitor, storm 2×, altar 8×6 | yes |
| roof-array | + Capacitor | Bend, Split, Gate, Capacitor, storm 2×, altar 8×6 | yes |
| control-booth | Bend, Amplify, Split, Gate, Capacitor, storm 2×, storm 4×, altar 8×6 | all of these | yes |
| the-last-rune | everything | everything, including altar 10×8 | yes |

When a puzzle teaches a gem the player doesn't own yet, the gem is **pre-set** (fixed) on the
altar. The suite checks that each of these pre-set gems is essential: take it away and the puzzle
can't be solved.

- furnace: two pre-set Amplifies, both off the shortest road (the first try reads under).
- splitter-mill, conveyor-a: a pre-set Split.
- relay-tower: a pre-set Split and a pre-set Gate. The player owns neither Split nor Amplify, so
  the Gate's two inputs come from the fixed Split.
- crane, archive, foundry: Split isn't guaranteed there, so each has a pre-set Split.
- capacitor-bay: a pre-set Capacitor (it grants Capacitor, so the player doesn't own one yet).
- control-booth, lift-shaft: pre-set rails (Channels) so the work is the idea, not laying
  channel; control-booth also has a pre-set amber lure on the straight road (not essential:
  it must be routed around).
- the-last-rune: a fixed frame (Split, Gate, four Bends, and the Channel rails of both arms)
  that keeps the 10×8 search small and the solution space tight. The
  Gate is the only one the puzzle can't do without, but the test doesn't assert that: the
  player's tray has no Gate, yet proving the puzzle unsolvable without the fixed Gate takes the
  solver about 13 s.

## The puzzles

"Solutions" is the canonical count from `solve()`, where every placed gem carries charge to a
machine and spare gems lying idle don't make a new solution. "Gems" is the number of gems the player places in the intended
solution (the shortest solution can be a gem or two smaller). "Essential" lists tray gems whose removal makes the puzzle unsolvable (tested).
Channel and Bend are left out of that column unless the puzzle is about them.

| # | Machine | Altar | Storm | Machines (need) | Essential | Gems | Solutions | Min | Insight |
|---|---|---|---|---|---|---|---|---|---|
| 1 | intake-desk | 6×4 | 1× | 1 (4) | channel | 5 | 1 | 1 | Channels carry the bolt straight; the pre-set amethyst turns it. |
| 2 | furnace | 6×4 | 1× | 1 (8) | bend | 8 | 3 | 2 | Amber doubles a bolt: the short road reads half, so bend through one amber. |
| 3 | splitter-mill | 6×4 | 1× | 2 (2, 2) | bend | 8 | 2 | A split sends halves out of its sides, never straight on: feed it from above. |
| 4 | relay-tower | 6×4 | 1× | 1 (4) | bend | 9 | 2 | The emerald fires only when both sides are live: bring both halves of the split home. |
| 5 | conveyor-a | 6×4 | 1× | 1 (4) | bend | 6 | 2 | The stuck amber doubles the bolt; route it through the old magenta to halve it again. |
| 6 | press-unit-4 | 6×4 | 1× | 2 (4, 4) | amplify, split | 10 | 2 | 3 | Amber before magenta: amplify once, then split, so both halves are full. |
| 7 | storm-cell-2 | 6×4 | 1× | 3 (2, 1, 1) | split | 11 | 3 | Split a split: one half goes up whole, the other is halved again. |
| 8 | crane | 6×4 | 1× | 1 (3) | gate | 11 | 4 | Three from four: merge a half with a quarter in the emerald, let the last quarter go. |
| 9 | boiler-room | 6×4 | 2× | 4 (2 each) | split | 13 | 4 | A double bolt feeds four boilers: a tree of three splits. |
| 10 | archive | 8×6 | 1× | 2 (3, 1) | gate | 20 | 3 | 5 | Every spark has a drawer: two and one for the big cabinet, one for the small. |
| 11 | foundry | 6×4 | 1× | 1 (6) | amplify, gate | 10 | 4 | Six: amplify only one half of the split, then merge them. |
| 12 | capacitor-bay | 8×6 | 2×, 2 strikes | 2 (2, 8) | split (+ fixed capacitor) | 9 | 1 | 5 | The ice hands its whole first strike to the second: give it half, and it gives the machine double. |
| 13 | lift-shaft | 8×6 | 2×, 2 strikes | 1 (12) | split, gate, capacitor | 10 | 3 | 6 | Twelve from eight: bank one half, and on the second strike merge the release with the other. |
| 14 | roof-array | 8×6 | 2×, 2 strikes | 2 (2, 10) | split, gate, capacitor | 18 | 5 | 6 | The emerald waits for the ice: alone on the first strike, it adds to the release on the second. |
| 15 | control-booth | 8×6 | 4× | 2 (4, 20) | split, amplify, gate | 16 | 1 | 7 | Twenty from sixteen: amplify one half, split the other, and merge. |
| 16 | the-last-rune | 10×8 | 4×, 2 strikes | 3 (4, 2, 20) | split, amplify, capacitor (+ fixed gate) | 15 | 4 | 8 | Amplify the bolt you bank: the ice keeps the amber's work, and the emerald adds it to the rest. |

Total estimated play time is about 64 minutes (design scale; see difficulty-curve.md). The early puzzles are on 6×4 altars with one or
two decisions each. The 8×6 puzzles have mazes of blocked sockets, so routing is a real part of
the work without the search blowing up.

### Notes

- **Tutorials (1–5)** each turn on one gem. The player can only place Channel and Bend, so each
  new gem is pre-set where the bolt has to use it.
- **press-unit-4** is the pitch's "amber before magenta, never after". Split then Amplify gives
  2 and 2 per side, which is enough for one machine, but the second Amplify isn't in the tray.
  Carved stone in the middle of the storm's row turns the bolt down into the one junction, so
  the work is the order of the two gems, not where along a run they sit (2 solutions, was 9).
- **crane** and **foundry** use the Gate to add unequal charges (2 + 1, 4 + 2), which no other
  gem can make.
- **capacitor-bay** grants Capacitor, so its Capacitor is pre-set. The pre-set Capacitor is
  essential: take it away and the puzzle can't be solved.
  The storm comes up a single lane and the tray holds one Bend, so the first try is "turn east
  through the ice": it keeps 8 and lets out 16 (over). The fix is a Split where the lane meets
  the row, and a second Split for the small machine (1 solution, was 11).
- **control-booth** has a Capacitor in the tray as a red herring. There is only one strike, so
  anything banked never comes out. The solver confirms Capacitor isn't essential.
- **the-last-rune** has 4 canonical solutions (was 72, which were variations of where the
  amber and ice sat on long runs). The upper arm's two open sockets must hold the amber and the
  ice together; the 4 are their order × the small machine's last turn. Its full count takes
  about 3 s, so the default suite only checks that it's solvable and which gems it needs. Run
  `FULL=1 pnpm test` to count it.
- **Difficulty** per puzzle (score, bot, required ideas) and the target curve are in
  `docs/design/difficulty-curve.md`; `pnpm puzzle <machineId>` shows any puzzle with its
  metrics and a solution.

## Solver figures

Measured with `solve()` on an M-series laptop. All are uncapped (exhaustive).

| Machine | Nodes | Time |
|---|---|---|
| everything up to foundry | < 30 k | < 130 ms each |
| capacitor-bay | 74 k | 200 ms |
| lift-shaft | 4 k | 12 ms |
| roof-array | 78 k | 210 ms |
| control-booth | 60 k | 120 ms |
| the-last-rune | 0.72 M | 2.7 s (essentials 0.9 s) |

The default suite runs in about 2 s.
