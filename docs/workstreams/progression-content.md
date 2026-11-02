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
