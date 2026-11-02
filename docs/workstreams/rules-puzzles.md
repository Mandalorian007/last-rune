# Workstream: rules-puzzles

**Owns:** `games/last-rune/rules/` (except `types.ts` which is PM-owned and `progression.ts` which progression-content owns), `games/last-rune/content/puzzles/`, `docs/design/rules.md`, `docs/design/puzzles.md`.
**Contracts:** C1 (read only), C2 (you own it), C4 puzzles.

## Deliver
1. **`docs/design/rules.md` first**: a precise, unambiguous spec of the charge simulation, consistent with the pitch:
   - Altar = grid of sockets (6×4 / 8×6 / 10×8), some sockets blocked or pre-set. A storm cell on the edge emits the bolt in a direction; one or more machines on the edge need **exactly full charge**. Under = nothing; over = breaker trips (a distinct, readable failure).
   - **Channel** carries straight. **Bend** turns 90° (rotation picks the turn). **Split** gives two outputs at half charge. **Amplify** doubles charge, *once per path*: a second Amplify on the same path does nothing. ("Stack two and the second one just feels important.") **Gate** fires only when both inputs are live. Decide and document what it outputs. **Capacitor** stores a bolt and releases it on the next one: model the storm as a sequence of pulses and define the timing exactly.
   - Order matters and must be teachable: Press Unit 4's hint is "amber before magenta, never after" (Amplify then Split ≠ Split then Amplify).
   - Charge must stay in clean numbers (pick units so halves stay integral, e.g. full = 4 or 8 units; storm strength 1×/2×/4× multiplies).
   - Define empty-socket behaviour (does the bolt travel through empty sockets? We recommend no: an empty socket breaks the circuit, so every path is built), edges, loops/cycles (must terminate deterministically), collisions (two bolts into one gem).
   Keep it simple enough that a casual player understands each gem from one codex page.
2. **`rules/sim.ts`**: pure deterministic `simulate()` producing the outcome plus a **render trace** (segments with charge, colour = last gem passed, pulse index, normalised timing) per contract C2. No DOM/GPU imports.
3. **`rules/solver.ts`**: exhaustive or BFS/DFS with pruning. Returns solutions, counts them, and gives difficulty metrics (minimum gems, branching factor, number of solutions, "uses gem X essentially"). Must be fast enough to run all 16 puzzles in the unit tests (< 5 s total).
4. **`content/puzzles/<machineId>.ts`**: 16 puzzles, one per `MachineId` in `rules/types.ts`. Each puzzle may only use capabilities the player can have when it unlocks. **Coordinate with the progression requirements in the pitch** (pitch §4 scripts list `needs ...` for many machines). Where the pitch is silent, assume: intake-desk needs nothing (Channel only, a teaching puzzle); Tier 1 teaches one gem each; Tier 2 combines; Tier 3 uses Capacitor and 2×/4× storm; the Last Rune uses everything on 10×8. progression-content owns the final graph. Read `docs/workstreams/progression-content.md` and keep your puzzles' assumed capabilities in a table in `docs/design/puzzles.md` so the PM can reconcile.
   - Every puzzle: solvable with its assumed capabilities, **not solvable without the gem it is meant to teach or require** (tested), has a short design note (what it teaches, the "aha").
   - Difficulty curve: early puzzles take 1–2 minutes, late ones 5–8 minutes. The whole game is about 1 hour.
5. **`rules/index.ts`** barrel exporting the C2 API.
6. **Tests**: sim unit tests per gem and edge case, puzzle-suite tests (solvable, essential-gem, solution count sane, trace well-formed).

## Quality bar
Puzzle quality matters most here. Prefer elegant small puzzles with one clear insight over big busy ones. Use the solver to reject puzzles with trivial or too many solutions.

## Log
_(agent appends progress, decisions, open issues here)_

### 2026-11-02 (rules-puzzles agent)

- **Spec**: `docs/design/rules.md` (committed before the code). 1 bolt = 4 sparks; storms 1×/2×/4× = 4/8/16. Empty or blocked socket = fizzle; leaving the altar anywhere but a machine = ground. Gate: the rotation is its output side, the inputs are the two perpendicular sides, it fires once both are live in the same strike and outputs their sum, and a lone input fizzles at the end of the strike. Capacitor: when empty it stores the bolt (no output); when charged it releases stored + incoming; the charge carries across strikes. Machines latch on exact; any over trips the breaker and ends the attempt.
- **Code**: `rules/sim.ts` (simulate + render trace), `rules/solver.ts` (bolt-driven DFS, canonical counting, dead-gem prune, lower-bound prune), `rules/model.ts` (local types: PuzzleDef, Placement, Rot, MachineTarget), `rules/validate.ts`, `rules/ascii.ts` (ASCII boards for puzzles and tests), `rules/index.ts`.
- **Puzzles**: all 16 are in `content/puzzles/`, and `docs/design/puzzles.md` has the table. The capability graph from the PM update is applied: Split is pre-set in relay-tower, crane, archive and foundry, where Split isn't guaranteed; capacitor-bay's Capacitor is pre-set; 10×8 is used only by the-last-rune.
- **Tests**: 234 tests, about 3.5 s. The finale's full solution count (72, about 10 s) only runs with `FULL=1`.
- **Open**: (1) The finale's count of 72 comes mostly from route variations; playtest whether it feels too loose. (2) The canonical `isSolvable` ignores solutions that need an idle gem (rules.md §9). (3) I worked on branch `worktree-agent-…`, not `ws/rules-puzzles`. (4) Proposed `types.ts` additions: none required. PuzzleDef/Placement/Rot live in `rules/model.ts` until the PM wants to promote them.
