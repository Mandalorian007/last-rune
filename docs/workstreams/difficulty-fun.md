# Workstream: difficulty-fun (recurring: wave 2 → M4)

**Goal:** the game must be *fun to play*, not just correct. Own the difficulty curve and puzzle quality across all 16 machines, and keep re-tuning as the game and playtest data grow.

**Owns:** `games/last-rune/content/puzzles/`, `games/last-rune/rules/solver.ts` + new `rules/difficulty.ts` (metrics), `docs/design/puzzles.md`, `docs/design/difficulty-curve.md`, `tools/` (dev-only puzzle tooling).
**Read-only:** `rules/sim.ts` semantics (spec changes need PM approval via report), `rules/types.ts`, progression graph (D-014).

## Phase 1 (now)
1. **Difficulty model** (`rules/difficulty.ts`): metrics that predict human difficulty better than solution count, e.g.:
   - search-space size / solver nodes explored; ratio of solutions to legal placements
   - minimum gems; tray slack (extra gems offered beyond what's needed: decoys)
   - "insight" markers: requires a non-local move (gem far from the obvious path), requires a counter-intuitive gem (e.g. Split to *reduce* charge, Amplify after a Split, Capacitor timing), requires using the board's blocked cells
   - near-miss density: how many placements land on *under*/*over* (good: informative failures) vs *dead* (frustrating)
   - path length and number of simultaneous constraints (multiple machines, exact charges)
   Produce a single difficulty score with a documented formula, calibrated against your own judgement of each puzzle.
2. **Novice bot**: a heuristic player (greedy/local search with limited lookahead, which gives up after N tries) as a second difficulty signal. Puzzles the bot solves instantly are too easy past Tier 1.
3. **Target curve** (`docs/design/difficulty-curve.md`): per-machine target score and minutes. Tier 1 is gentle teaching (1–3 min each); Tier 2 combines ideas with real "aha" (3–5 min); Tier 3 is demanding (5–8 min); the finale is the hardest and most satisfying, a **tight** solution space with one big insight that uses everything (the current finale has 72 solutions: too loose). Branch choice matters: since players pick order, avoid big spikes between machines in the same open set.
4. **Retune/redesign puzzles** to hit the curve: use bigger altars where capabilities allow, decoy gems, blocked sockets that shape the routing, multiple machines with different needs, required pre-set gems that must be routed *around*. Keep the elegance rule: one clear insight per puzzle, no busywork. Keep all existing invariants (essential gems, guaranteed capabilities only, solvable, tests under ~5 s; long checks behind `FULL=1`).
5. **Puzzle viewer tool** (dev only): `pnpm puzzle <machineId>` prints an ASCII/Unicode render of the board, tray, metrics, and one solution, so the PM/user can review puzzles before the altar scene exists.

## Phase 2 (after the altar scene + alpha): playtest loop
- In-game, dev-only and local-only: per-puzzle time, attempts, breaker trips, resets, and hint requests, saved to localStorage and exportable as JSON. **No network telemetry.**
- A hint ladder design (FUSE-voiced, three steps: nudge → highlight a socket → reveal one gem). Implementation coordinated with the PM.
- Retune from user/friend playtest data; log every change and why in `docs/design/difficulty-curve.md`.

## Log

### 2026-11-02 — Phase 1 done (branch `worktree-agent-a60fe6a51069ad7a9`)
- **Built**: `rules/difficulty.ts` (flow markers, novice bot, `measure`, `scoreOf`), solver now
  reports failed-leaf kinds (dead/under/over), `pnpm puzzle <id|all|table ids…> [--json]
  [--solutions N]` (`tools/puzzle.ts`, tsx devDep), `content/puzzles/targets.ts` (score bands),
  `content/puzzles/difficulty.test.ts` (fast unit tests + FULL=1 curve check, ~4 s).
- **Decision: score reads as minutes on a by-hand scale.** Weights fitted to my estimate of the
  16 original puzzles, then rounded. The pitch's `minutes` (finale 8) run about 1.25 × score. The
  curve's shape is the contract until Phase 2 playtests refit. Details: `docs/design/difficulty-curve.md`.
- **Decision: bot = build by following the bolt, then edit the best board from gauge readings.**
  A rebuild-from-scratch bot with a tabu memory couldn't assign credit and solved nothing past Tier 1.
- **Retuned**: furnace (first try reads under), capacitor-bay (8×6; first try reads over),
  lift-shaft (pre-set rails, 12 → 3 solutions), control-booth (amber lure + rails, 6 → 1),
  the-last-rune (arm rails pre-set, 72 → 4 solutions, finale checks ~1 s). All invariants and
  tests kept; puzzle ids and the `PUZZLES`/`puzzleFor` API unchanged.
- **Open**: conveyor-a (8) / press-unit-4 (9) / capacitor-bay (11) solution counts; the bot
  can't plan Gate meetings (hits its 300 cap on most Gate puzzles); STATUS.md and
  rules-puzzles.md still quote the finale's 72 solutions (PM-owned files, not edited).
