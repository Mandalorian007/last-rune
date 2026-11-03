# Progression: the capability graph

Owner: progression-content. The data is in `games/last-rune/content/machines.ts`, the
API (C3) in `games/last-rune/rules/progression.ts`, and the exhaustive tests in
`rules/progression.test.ts`. Every number in this doc is checked by those tests.

## 1. The graph

Nine capabilities: five gems (Bend, Split, Amplify, Gate, Capacitor), two storm strengths
(×2, ×4) and two altar sizes (8×6, 10×8). Channel is always owned. **Each capability is
granted by exactly one machine.** A machine opens when the player owns every capability it
`requires` (and, for the booth, every machine in `requiresSolved`).

| Machine | Tier | Wing | Requires | Grants | Source |
|---|---|---|---|---|---|
| Intake Desk | 1 | centre | — | Bend | pitch |
| Furnace | 1 | heat | Bend | Amplify | pitch |
| Splitter Mill | 1 | storm | Bend | Split | pitch |
| Relay Tower | 1 | signal | Bend | Gate | pitch grant; requirement **new** |
| Conveyor A | 1 | heat | Bend | — | pitch |
| Press Unit 4 | 2 | heat | Amplify + Split | — | pitch |
| Storm Cell II | 2 | storm | Split | Storm ×2 | pitch |
| Crane | 2 | signal | Gate | Altar 8×6 | pitch |
| Boiler Room | 2 | storm | Storm ×2 | — | pitch |
| Archive | 2 | signal | Altar 8×6 | — (2 journal pages) | pitch |
| Foundry | 2 | heat | Amplify + Gate | — | pitch |
| Capacitor Bay | 3 | storm | Storm ×2 + **Altar 8×6** | Capacitor | pitch + **added lock** |
| Lift Shaft | 3 | storm | Capacitor | — | pitch |
| Roof Array | 3 | signal | Altar 8×6 + Gate + **Capacitor** | Storm ×4 | **gap filled** + added lock |
| Control Booth | 3 | centre | 8 capabilities (all but 10×8) + all 14 regular machines | Altar 10×8 | **gap filled** |
| The Last Rune | 4 | centre | all 9 | — | pitch |

### Gaps filled, and why

- **Relay Tower requires Bend only.** The pitch doesn't say. Bend keeps it in Tier 1 and
  gives the start three branches (heat, storm, signal) instead of two. Note for
  rules-puzzles: the relay hands out Gate, so its own puzzle can't need Split from the
  player. It needs two signals at once from pre-set gems or two emitters.
- **Roof Array grants Storm ×4.** It's "the storm's right there", and ×4 is the only
  storm left. It is the signal wing's Tier 3 reward. The roof doesn't require the lift
  (sockets can't express "reach the roof"). FUSE's locked line covers the ladder ("This unit
  does not do ladders"), so going up the ladder before the lift is a joke, not a bug.
- **Control Booth grants Altar 10×8.** It is the Builder's own desk, so it gets the
  Builder's slab. It also requires every regular machine, which makes it the 15th machine
  every time and puts page 16 (Day 1) last before the rune. That matches the pitch: the
  booth "needs everything but the Last Rune".
- **Capacitor Bay adds Altar 8×6, and the roof adds Capacitor.** Without these, Tier 3
  opens from one wing alone, and the roof's admission line ("I assumed they meant them")
  could play before most of Tier 2. With them, Tier 3 opens only where the storm wing
  (Storm Cell II) and the signal wing (Crane) meet (tested), and the roof is last in its
  wing. Both pitch requirements are kept as a subset.
- **The 10×8 altar appears only in the Last Rune.** No regular puzzle needs it.

Earliest solve number per machine (fastest beeline): intake 1. All Tier 1 machines 2. Storm
Cell II and crane 3. Press, boiler, archive and foundry 4. Capacitor bay 6. Lift and roof 7.
Booth 15. Rune 16.

## 2. Conduits

There is one conduit per requirement, from granter to requirer (`conduits()`), 35 in total. The booth and the rune take 17 of them, so they converge on the centre.
Restoring a machine lights its outgoing conduits. They are drawn as floor channels (see §4).

## 3. "Always at least two choices", and why the strict form is impossible

**Claim.** With AND-locks and unique grants, any machine X that grants something another
machine needs will, in some play order, be the only open door.

**Proof.** Let D(X) be X plus everything that transitively depends on X. Every machine
outside D(X) can be solved without X: its requirements are granted outside D(X). So
"every machine outside D(X) is solved" is a reachable state. In that state every unsolved
regular machine is in D(X), and every machine in D(X) other than X is locked behind X. Only
X is open. ∎

The start state is the same argument with X = intake desk: one door, which the pitch
wants anyway ("Please touch that. Only that."). The finale (booth, then rune) is
single-door by design. So the rule is enforced in the strongest form that can hold:

| Invariant (tested exhaustively, every play order) | Result |
|---|---|
| Reachable states | 293 (292 open, 1 complete) |
| Softlocks | **0** |
| States with ≥ 2 open doors | 276 of 292 (94.5%) |
| Single-door states with no explanation | **0** |
| Single-door: start | 1 (intake desk) |
| Single-door: gate pinch (player already cleared every door that doesn't need this one) | 6: relay or splitter after 7 solves; crane or Storm Cell II after 9; capacitor bay or furnace after 11 |
| Single-door: last regular machine | 7 (after 13 solves) |
| Single-door: finale | 2 (booth after 14, rune after 15) |
| Earliest gate pinch | after 7 solves. Never in the first half of Tier 1 → 2 |
| Two single-door states in a row before the finale | never |

A pinch only happens to a player who has ignored a door for a long time. When it happens,
that door is the one the hall is already pointing at: its conduits are the only dark ones,
and its locked line has been playing.

## 4. The hall: alcove layout

Coordinates are in a 1920×1080 hall space, with (0,0) top-left, the camera looking north,
and the entrance at the bottom. The rune sits in the centre. Wings fan out from it: heat to
the west, storm to the east, signal across the north. Tiers rise from front to back, so
progress reads as walking deeper into the room. Minimum spacing is 180 (tested).

```
 y≈130-150   relay(420)  crane(680)  booth(960)  archive(1240)  roof(1500)  lift(1740)
 y≈320-340   foundry(200)                                          capbay(1720)
 y≈540-580   press(200)               RUNE(960,540)                storm-cell-2(1720)
 y≈840-900   furnace(200) conveyor(500)                 boiler(1420)  splitter(1720)
 y≈960                              intake(960)   ← entrance
```

| Machine | x | y |
|---|---|---|
| intake-desk | 960 | 960 |
| furnace | 200 | 840 |
| conveyor-a | 500 | 900 |
| press-unit-4 | 200 | 580 |
| foundry | 200 | 320 |
| splitter-mill | 1720 | 840 |
| boiler-room | 1420 | 900 |
| storm-cell-2 | 1720 | 580 |
| capacitor-bay | 1720 | 340 |
| lift-shaft | 1740 | 130 |
| relay-tower | 420 | 150 |
| crane | 680 | 150 |
| archive | 1240 | 150 |
| roof-array | 1500 | 150 |
| control-booth | 960 | 150 |
| the-last-rune | 960 | 540 |

The relay sits in the far north-west, two walks from the intake. That is deliberate: the
signal wing is the one the player has to choose to go and find.

## 5. API summary (C3)

All functions are pure and take an optional `graph` (default `MACHINES`).

- Capabilities: `capabilityKey`, `capabilityFromKey`, `sameCapability`, `capabilityLabel`,
  `socketColour`, `ALL_CAPABILITIES`.
- Queries: `getMachine`, `granterOf`, `isRegular`, `FINALE`.
- State: `initialState`, `isSolved`, `capabilitiesOf`, `hasCapability`, `missingFor`,
  `missingMachinesFor`, `isUnlocked`, `availableMachines`, `solveMachine` (throws if
  locked; idempotent), `isComplete`, `storyTier` (1–4, drives which lines play).
- Saves: `parseProgressState(raw)` repairs any untrusted `localStorage` value to a
  reachable state, dropping unknown ids and anything solved out of order.
- Hall: `conduits()`, `dependentsOf(id)`.
- Analysis: `enumerateReachableStates()`, `analyseChoices()`.

## 6. Notes for other workstreams

- **rules-puzzles.** Each `puzzleId` equals the machine id. A puzzle may use only the
  capabilities its machine `requires`, plus Channel and anything pre-set. The relay puzzle
  can't rely on a player-owned Split. The capacitor bay may use the 8×6 altar. The roof may
  use Capacitor. Nothing but the rune uses 10×8.
- **Hall scene.** Use `lockedLineFor(machine, missing, missingMachines)`. If it returns
  nothing, use `socketLine` for each empty socket. Use `storyTier(state)` to pick hall and
  reaction lines.
