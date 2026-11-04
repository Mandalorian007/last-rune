/**
 * Game flow: Title → Hall ⇄ Puzzle → Solve moment → Hall (→ Ending).
 *
 * Owns every scene transition and every progress write, so scenes stay dumb:
 * a scene asks the flow (`openPuzzle`, `completePuzzle`, …) and the flow
 * decides. Scene construction is injected (`FlowScenes`), which keeps this
 * file free of GPU/DOM and unit-testable with a fake stack.
 *
 * Stack shape:
 *   title                       (replaced by hall)
 *   hall                        (bottom while playing)
 *   hall, puzzle(id)            (hall paused underneath)
 *   hall, solve(moment)         (solve replaces the puzzle; pop returns to hall)
 *   hall, journal               (journal desk pushed over the hall)
 *   hall, ending(moment)        (the final solve moment hands over to the ending)
 */
import { type JournalPage, pagesUnlockedBy } from '../content/journal';
import { getMachine, isComplete, isSolved, isUnlocked, solveMachine } from '../rules/progression';
import type { Capability, MachineId } from '../rules/types';
import { newlyUnlocked } from '../scenes/hall/hall-state';
import {
  type GameSave,
  gemsAt,
  markGemsMet,
  metGems,
  newGameData,
  progressOf,
  type SaveData,
  type SavedPlacement,
} from './save';

export type FlowState = 'boot' | 'title' | 'hall' | 'puzzle' | 'solve' | 'journal' | 'ending';

/** Outcome of firing the bolt (mirrors rules C2 `SimResult.outcome`). */
export type BoltOutcome = 'dead' | 'under' | 'exact' | 'over';

/** Everything the solve-moment scene needs (pitch screen 5). */
export interface SolveMoment {
  readonly machine: MachineId;
  /** Capability handed over (the gem badge), or null for no-grant machines. */
  readonly grants: Capability | null;
  /** Doors that opened because of this solve ("names what it unlocks"). */
  readonly unlocked: readonly MachineId[];
  /** Journal pages that land bottom-left. */
  readonly pages: readonly JournalPage[];
  /** False when replaying an already-restored machine (no grant, no pages). */
  readonly firstTime: boolean;
  /** This solve completed the facility (the ending follows). */
  readonly complete: boolean;
}

export interface FlowScenes<S> {
  title(): S;
  hall(): S;
  /** Hook for rules-puzzles' altar scene. */
  puzzle(machine: MachineId): S;
  /** Hook for the solve-moment scene. */
  solve(moment: SolveMoment): S;
  /** Hook for the journal desk (story-scenes). Optional: without it the journal never opens. */
  journal?(): S;
  /** Hook for the ending (story-scenes). Optional: without it a complete solve returns to the hall. */
  ending?(moment: SolveMoment): S;
}

export interface StackLike<S> {
  push(scene: S): void;
  pop(): void;
  replace(scene: S): void;
  clear(): void;
}

export type FlowListener = (state: FlowState, prev: FlowState) => void;

/** Play time is committed to the save at most this often (seconds). */
const COMMIT_EVERY = 10;

export class GameFlow<S> {
  private _state: FlowState = 'boot';
  private _machine: MachineId | null = null;
  private _journalFrom: 'hall' | 'puzzle' = 'hall';
  private pendingPlay = 0;
  private lastMoment: SolveMoment | null = null;
  private readonly listeners = new Set<FlowListener>();

  constructor(
    private readonly stack: StackLike<S>,
    private readonly save: GameSave,
    private readonly scenes: FlowScenes<S>,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): FlowState {
    return this._state;
  }

  /** Machine of the open puzzle or solve moment. */
  get machine(): MachineId | null {
    return this._machine;
  }

  onChange(fn: FlowListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Title ────────────────────────────────────────────────────────────────

  start(): void {
    this.stack.clear();
    this.stack.push(this.scenes.title());
    this.set('title', null);
  }

  toTitle(): void {
    this.commitPlayTime();
    this.start();
  }

  newGame(): void {
    this.save.set(newGameData(this.save.get(), this.now()));
    this.save.flush();
    this.enterHall();
  }

  /** Settings → Reset progress: wipe (settings kept) and return to the title. */
  resetProgress(): void {
    this.pendingPlay = 0;
    this.save.set(newGameData(this.save.get(), 0));
    this.save.flush();
    this.start();
  }

  continueGame(): void {
    if (this.save.get().stats.startedAt === 0) {
      this.save.update((d) => {
        d.stats.startedAt = this.now();
      });
    }
    this.enterHall();
  }

  private enterHall(): void {
    this.stack.clear();
    this.stack.push(this.scenes.hall());
    this.set('hall', null);
  }

  // ── Puzzles ──────────────────────────────────────────────────────────────

  /** True if the player may open this machine's puzzle now (unlocked; replays allowed). */
  canOpen(machine: MachineId): boolean {
    return isUnlocked(machine, progressOf(this.save.get()));
  }

  /**
   * Hall → puzzle. The hook rules-puzzles' altar scene plugs into via
   * `FlowScenes.puzzle`. Returns false (and does nothing) if locked or not in the hall.
   */
  openPuzzle(machine: MachineId): boolean {
    if (this._state !== 'hall' || !this.canOpen(machine)) return false;
    // Seeing a gem at the altar (fixed on the board or in the tray) opens its Codex page.
    const met = metGems(this.save.get());
    const seen = gemsAt(machine);
    if (seen.some((g) => !met.includes(g))) {
      this.save.update((d) => {
        markGemsMet(d, seen);
      });
    }
    this.stack.push(this.scenes.puzzle(machine));
    this.set('puzzle', machine);
    return true;
  }

  /** Puzzle → hall without solving (Esc / back). Placements are kept. */
  closePuzzle(): void {
    if (this._state !== 'puzzle') return;
    this.stack.pop();
    this.set('hall', null);
  }

  /** Persist the altar as the player leaves it, so it reopens the same way. */
  savePlacements(machine: MachineId, placements: readonly SavedPlacement[]): void {
    this.save.update((d) => {
      const p = puzzleEntry(d, machine);
      p.placements = placements.map((x) => ({ gem: x.gem, cell: { ...x.cell }, rot: x.rot }));
    });
  }

  placementsFor(machine: MachineId): SavedPlacement[] {
    return this.save.get().puzzles[machine]?.placements ?? [];
  }

  /** Count a fired bolt. `over` trips a breaker (safety record). */
  recordAttempt(machine: MachineId, outcome: BoltOutcome): void {
    this.save.update((d) => {
      const p = puzzleEntry(d, machine);
      p.attempts++;
      d.stats.attempts++;
      if (outcome === 'over') d.stats.breakersTripped++;
    });
  }

  /**
   * The bolt landed at exactly full charge: restore the machine, file the
   * journal pages, and swap the puzzle for the solve moment.
   */
  completePuzzle(machine: MachineId): SolveMoment | null {
    if (this._state !== 'puzzle' || this._machine !== machine) return null;
    const before = progressOf(this.save.get());
    const firstTime = !isSolved(machine, before);
    const after = solveMachine(before, machine);
    const pages = firstTime ? pagesUnlockedBy(machine) : [];
    const complete = isComplete(after);
    this.commitPlayTime();
    this.save.update((d) => {
      d.progress.solved = [...after.solved];
      for (const p of pages) if (!d.journal.found.includes(p.page)) d.journal.found.push(p.page);
      if (complete && d.stats.completedAt === 0) d.stats.completedAt = this.now();
    });
    this.save.flush();
    const moment: SolveMoment = {
      machine,
      grants: firstTime ? getMachine(machine).grants : null,
      unlocked: newlyUnlocked(before, after),
      pages,
      firstTime,
      complete,
    };
    this.lastMoment = moment;
    this.stack.replace(this.scenes.solve(moment));
    this.set('solve', machine);
    return moment;
  }

  /** Solve moment → hall, or → the ending when that solve completed the facility. */
  finishSolve(): void {
    if (this._state !== 'solve') return;
    const moment = this.lastMoment;
    this.lastMoment = null;
    if (moment?.complete && this.scenes.ending) {
      this.stack.replace(this.scenes.ending(moment));
      this.set('ending', moment.machine);
      return;
    }
    this.stack.pop();
    this.set('hall', null);
  }

  /** Ending → hall ("Back to the hall"). The save is kept: the hall is post-game now. */
  finishEnding(): void {
    if (this._state !== 'ending') return;
    this.commitPlayTime();
    this.save.flush();
    this.enterHall();
  }

  // ── Journal ──────────────────────────────────────────────────────────────

  /**
   * Hall or altar → journal desk. From an altar the puzzle stays on the stack underneath
   * (paused), so closing returns to the same board. Returns false if not in the hall or a
   * puzzle, or no journal scene is wired.
   */
  openJournal(): boolean {
    if ((this._state !== 'hall' && this._state !== 'puzzle') || !this.scenes.journal) return false;
    this._journalFrom = this._state;
    this.stack.push(this.scenes.journal());
    // The machine stays set while the desk is over an altar (null over the hall).
    this.set('journal', this._machine);
    return true;
  }

  /** Where the open journal goes back to: the hall, or the altar it was opened over. */
  get journalFrom(): 'hall' | 'puzzle' {
    return this._journalFrom;
  }

  /** Journal desk → whatever it was opened over (the hall, or the same altar). */
  closeJournal(): void {
    if (this._state !== 'journal') return;
    const from = this._journalFrom;
    this._journalFrom = 'hall';
    if (from === 'puzzle') {
      // The state first, so the chrome is the altar's again (the desk's docked caption gone)
      // before the altar rebuilds its rails in `resume`, as it is when the pop is deferred.
      this.set('puzzle', this._machine);
      this.stack.pop();
      return;
    }
    this.stack.pop();
    this.set('hall', null);
  }

  /** Mark found pages as read (the desk's "new" highlight clears). Ignores unfound pages. */
  markPagesRead(pages: readonly number[]): void {
    const d0 = this.save.get();
    const todo = pages.filter((p) => d0.journal.found.includes(p) && !d0.journal.read.includes(p));
    if (todo.length === 0) return;
    this.save.update((d) => {
      for (const p of todo) if (!d.journal.read.includes(p)) d.journal.read.push(p);
    });
  }

  // ── Play time ────────────────────────────────────────────────────────────

  /** Call every fixed tick. Counts only while in the hall, a puzzle, or a solve moment. */
  tick(dt: number): void {
    if (this._state === 'boot' || this._state === 'title') return;
    this.pendingPlay += dt;
    if (this.pendingPlay >= COMMIT_EVERY) this.commitPlayTime();
  }

  /** Write accumulated play time (also call on tab hide / page hide). */
  commitPlayTime(): void {
    if (this.pendingPlay <= 0) return;
    const add = this.pendingPlay;
    this.pendingPlay = 0;
    this.save.update((d) => {
      d.stats.playSeconds += add;
    });
  }

  private set(state: FlowState, machine: MachineId | null): void {
    const prev = this._state;
    this._state = state;
    this._machine = machine;
    for (const fn of this.listeners) fn(state, prev);
  }
}

function puzzleEntry(d: SaveData, machine: MachineId): SaveData['puzzles'][string] {
  let p = d.puzzles[machine];
  if (!p) {
    p = { placements: [], attempts: 0 };
    d.puzzles[machine] = p;
  }
  return p;
}
