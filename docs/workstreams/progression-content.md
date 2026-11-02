# Workstream: progression-content

**Owns:** `games/last-rune/rules/progression.ts` (+ tests), `games/last-rune/content/machines.ts`, `content/lines.ts`, `content/journal.ts`, `docs/design/progression.md`, `docs/design/script.md`.
**Contracts:** C1 (read only), C3 and C4 (you own them). Puzzle files are owned by rules-puzzles.

## Deliver
1. **`docs/design/progression.md`**: the full capability graph for the 16 machines, built from pitch §2 and §4. Known from the pitch:
   - Grants: intake-desk→Bend, furnace→Amplify, splitter-mill→Split, relay-tower→Gate, conveyor-a→none (1× bolt check), storm-cell-2→2× storm, crane→8×6 altar, capacitor-bay→Capacitor.
   - Requires: press-unit-4 = Amplify+Split · storm-cell-2 = Split · crane = Gate · boiler-room = 2× · archive = 8×6 · foundry = Amplify+Gate · capacitor-bay = 2× · lift-shaft = Capacitor · roof-array = 8×6+Gate · control-booth = everything but the Last Rune · the-last-rune = everything.
   - Gaps you must fill and justify: Tier 1 requirements (intake-desk is the start; keep at least two machines open at all times); who grants **4× storm** and **10×8 altar** (the pitch lists them as capabilities, and the Last Rune needs everything). Choose machines whose story fits (e.g. roof-array → 4× storm since "the whole sky's wired"; control-booth or archive → 10×8).
   - Hard rule: at least two unlocked, unsolved machines at every point before the control booth (pitch: "Always a choice"). Prove it with an exhaustive test over all reachable states.
   - The hall layout: each machine gets an alcove position in the hall (1920×1080 space, three branches plus convergence, per pitch screen 2). Positions are data.
2. **`rules/progression.ts`**: the C3 API (pure TS) plus exhaustive reachability tests.
3. **`content/machines.ts`**: 16 `MachineDef`s (id, display name, tier, requires, grants, puzzleId = id, alcove).
4. **`content/lines.ts`**: every FUSE line from pitch §4 **verbatim** (arrive/solve per machine, locked-door lines, tarp line, title line, Last Rune lines, door beats, chat lines, ending title card, post-credits). Locked-door lines must map to specific machines/missing capabilities. Write the missing lines (Tier 1 locked doors that need mapping, any machine with no line) in FUSE's voice, following pitch rules: ≤ 20 words, never explains mechanics, never mean to the player, rationed "I" that rises by tier.
5. **`content/journal.ts`**: the Builder's 16 journal pages. The pitch provides 8 (Tier 1 ×3, Tier 2 ×4, page 16). Write the remaining 8 in the Builder's voice. Each rhymes with something FUSE says in the same tier, and together they lay the clue ladder (pitch "The clue ladder" 1–5). Map each page to the machine whose solve reveals it. Page 16 comes from the control booth.
6. **`docs/design/script.md`**: a readable full script (all lines, in play order) for PM and user review. Mark which lines are new (not in the pitch).
7. **Tests**: graph invariants, every machine has arrive and solve lines (except the-last-rune's special case), ≤ 20 words, "I" count rises by tier, every journal page reachable, no orphan content.

## Quality bar
The writing must match the pitch's voice: dry, procedural, funny, then not. New lines should be indistinguishable from the pitch's. Clues land in order.

## Log
_(agent appends progress, decisions, open issues here)_

### 2026-11-02 · progression-content agent

**Done.** Capability graph and C3 API (`rules/progression.ts`, `content/machines.ts`), with exhaustive reachability tests over all 293 reachable states. Content: `content/lines.ts` (79 lines: 48 pitch verbatim, 31 new), `content/journal.ts` (16 pages: 8 pitch, 8 new; 15 FUSE plates, all new), `content/ending.ts`. Docs: `docs/design/progression.md`, `docs/design/script.md`. 52 tests. `pnpm check` and `pnpm build` pass.

**Decisions.**
- Gaps: relay requires Bend; roof grants Storm ×4; booth grants Altar 10×8 and requires all 14 regular machines (so it is always 15th and page 16 comes last).
- Added locks: capacitor bay also needs Altar 8×6, and the roof also needs Capacitor. Tier 3 opens only where the storm and signal wings meet. The pitch requirements are kept as subsets.
- **"Always two doors" is mathematically impossible with AND-locks and unique grants.** The proof is in progression.md §3. What the tests enforce instead:
  - 0 softlocks;
  - 0 unexplained single-door states;
  - the earliest gate pinch comes after 7 solves;
  - there are never two single-door states in a row before the finale;
  - 94.5% of open states have 2 or more doors.
- Pitch lines over 20 words (13 of them) are kept verbatim and split at sentence boundaries into ≤ 20-word cards (`cardsOf`). Every new line is ≤ 20 words.
- "I" count by tier (FUSE lines and plates): T1 0, T2 2, T3 16, finale 2. New Tier 2 lines add no "I".
- `DISCORD_INVITE_URL = 'https://discord.gg/thunderclap'` (PM). Blank or non-https URLs hide the button. `TIP_JAR_URL` is empty, so its button is hidden.

**Open issues.**
- The relay puzzle (rules-puzzles) must produce two full signals without a player-owned Split.
- The roof can be solved before the lift. Covered by FUSE's ladder joke.
- The PM should accept the weakened two-choices invariant.
- Optional types.ts proposal: move `CapabilityKey` and `Branch` into types.ts if other workstreams need them.
