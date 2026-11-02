/**
 * The altar's editable state: the player's placements plus an undo stack. Pure TS (no DOM/GPU),
 * so it is unit-tested directly. Fixed gems belong to the puzzle and never enter this list.
 *
 * Every edit goes through `validatePlacement` (rules), so the board can never hold a placement
 * the sim would ignore. A move is "remove, then place" as one undo step.
 *
 * Locked gems (`lock`, used by the hint mechanism) are player placements the player cannot
 * move, turn or remove: they count against the tray, go to the sim and the save like any
 * placement, survive clear and undo, and read as "fixed" to the edit methods. The lock itself
 * is not saved; a reopened puzzle treats a former hint gem as an ordinary placement.
 */
import {
  isRotational,
  type Placement,
  type PuzzleDef,
  type Rot,
  validatePlacement,
} from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import { GEM_KINDS } from '../../rules/types';

export type EditError = 'out-of-bounds' | 'blocked' | 'fixed' | 'occupied' | 'tray-empty' | 'empty';

export type EditResult = { ok: true } | { ok: false; reason: EditError };

const OK: EditResult = { ok: true };
const UNDO_LIMIT = 200;

function rotOf(n: number): Rot {
  return (((n % 4) + 4) % 4) as Rot;
}

function copy(p: Placement): Placement {
  return { gem: p.gem, cell: { x: p.cell.x, y: p.cell.y }, rot: p.rot };
}

function samePlacements(a: readonly Placement[], b: readonly Placement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.gem !== y.gem || x.rot !== y.rot || x.cell.x !== y.cell.x || x.cell.y !== y.cell.y) {
      return false;
    }
  }
  return true;
}

export class BoardState {
  private list: Placement[] = [];
  private locked: Placement[] = [];
  private readonly undoStack: Placement[][] = [];
  /** Bumped on every successful edit (cheap change detection for views). */
  revision = 0;

  constructor(readonly puzzle: PuzzleDef) {}

  /** Current player placements, locked hint gems included (do not mutate). */
  get placements(): readonly Placement[] {
    return this.locked.length === 0 ? this.list : [...this.locked, ...this.list];
  }

  /** Locked (hint) gems. */
  get lockedPlacements(): readonly Placement[] {
    return this.locked;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get isEmpty(): boolean {
    return this.list.length === 0;
  }

  /** The editable player gem on `cell`, if any (locked gems excluded). */
  at(cell: Cell): Placement | undefined {
    return this.list.find((p) => p.cell.x === cell.x && p.cell.y === cell.y);
  }

  /** The fixed gem on `cell`, if any: the puzzle's own, or a locked hint gem. */
  fixedAt(cell: Cell): Placement | undefined {
    const same = (p: Placement) => p.cell.x === cell.x && p.cell.y === cell.y;
    return this.puzzle.fixed.find(same) ?? this.locked.find(same);
  }

  /** The locked hint gem on `cell`, if any. */
  lockedAt(cell: Cell): Placement | undefined {
    return this.locked.find((p) => p.cell.x === cell.x && p.cell.y === cell.y);
  }

  /**
   * Put a gem on `cell` and lock it there (hint mechanism). Whatever player gem sat on the cell
   * goes back to the tray; if the tray has none of `gem` left, the most recently placed one is
   * taken off the board to pay for it. Clears undo (a hint is a commit point).
   */
  lock(cell: Cell, gem: GemKind, rot: number = 0): EditResult {
    if (this.lockedAt(cell)) return { ok: false, reason: 'fixed' };
    const before = this.list;
    this.list = this.list.filter((p) => p.cell.x !== cell.x || p.cell.y !== cell.y);
    if (this.remaining(gem) <= 0) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        if (this.list[i]!.gem === gem) {
          this.list.splice(i, 1);
          break;
        }
      }
    }
    const r = validatePlacement(this.puzzle, this.placements, cell, gem);
    if (!r.ok) {
      this.list = before;
      return { ok: false, reason: r.reason ?? 'occupied' };
    }
    this.locked.push({
      gem,
      cell: { x: cell.x, y: cell.y },
      rot: isRotational(gem) ? rotOf(rot) : 0,
    });
    this.undoStack.length = 0;
    this.revision++;
    return OK;
  }

  isBlocked(cell: Cell): boolean {
    return this.puzzle.blocked.some((b) => b.x === cell.x && b.y === cell.y);
  }

  /** Gems of `gem` left in the tray. */
  remaining(gem: GemKind): number {
    let used = 0;
    for (const p of this.list) if (p.gem === gem) used++;
    for (const p of this.locked) if (p.gem === gem) used++;
    return (this.puzzle.tray[gem] ?? 0) - used;
  }

  /** Tray kinds in canonical order (only those the puzzle offers). */
  get trayKinds(): GemKind[] {
    return GEM_KINDS.filter((k) => (this.puzzle.tray[k] ?? 0) > 0);
  }

  /** Would placing `gem` on `cell` be legal right now? */
  check(cell: Cell, gem: GemKind): EditResult {
    const r = validatePlacement(this.puzzle, this.placements, cell, gem);
    return r.ok ? OK : { ok: false, reason: r.reason ?? 'occupied' };
  }

  place(cell: Cell, gem: GemKind, rot: number = 0): EditResult {
    const r = this.check(cell, gem);
    if (!r.ok) return r;
    this.push();
    this.list.push({
      gem,
      cell: { x: cell.x, y: cell.y },
      rot: isRotational(gem) ? rotOf(rot) : 0,
    });
    this.revision++;
    return OK;
  }

  /** Take the player gem off `cell` back to the tray. Returns it, or null. */
  remove(cell: Cell): Placement | null {
    const i = this.list.findIndex((p) => p.cell.x === cell.x && p.cell.y === cell.y);
    if (i < 0) return null;
    this.push();
    const [p] = this.list.splice(i, 1);
    this.revision++;
    return p!;
  }

  /** Turn the gem on `cell` a quarter clockwise (`by` quarters). Only Bend, Gate and Split turn. */
  rotate(cell: Cell, by = 1): EditResult {
    const p = this.at(cell);
    if (!p) return { ok: false, reason: this.fixedAt(cell) ? 'fixed' : 'empty' };
    if (!isRotational(p.gem)) return OK;
    this.push();
    p.rot = rotOf(p.rot + by);
    this.revision++;
    return OK;
  }

  /** Move the gem on `from` to `to` (one undo step). Same cell is a no-op. */
  move(from: Cell, to: Cell): EditResult {
    const p = this.at(from);
    if (!p) return { ok: false, reason: this.fixedAt(from) ? 'fixed' : 'empty' };
    if (from.x === to.x && from.y === to.y) return OK;
    const rest = this.placements.filter((q) => q !== p);
    const r = validatePlacement(this.puzzle, rest, to, p.gem);
    if (!r.ok) return { ok: false, reason: r.reason ?? 'occupied' };
    this.push();
    p.cell = { x: to.x, y: to.y };
    this.revision++;
    return OK;
  }

  /** Return every unlocked player gem to the tray (one undo step). */
  clear(): boolean {
    if (this.list.length === 0) return false;
    this.push();
    this.list = [];
    this.revision++;
    return true;
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.list = prev;
    this.revision++;
    return true;
  }

  /** Placements for the sim and the save file (copies; locked gems included). */
  serialise(): Placement[] {
    return this.placements.map(copy);
  }

  /**
   * Restore saved placements, dropping any that are no longer legal (the puzzle may have been
   * retuned since the save was written). Clears undo. Returns how many were dropped.
   */
  restore(saved: readonly Placement[]): number {
    this.list = [];
    this.locked = [];
    this.undoStack.length = 0;
    let dropped = 0;
    for (const s of saved) {
      const r = validatePlacement(this.puzzle, this.list, s.cell, s.gem);
      if (!r.ok) {
        dropped++;
        continue;
      }
      this.list.push({
        gem: s.gem,
        cell: { x: s.cell.x, y: s.cell.y },
        rot: isRotational(s.gem) ? rotOf(s.rot) : 0,
      });
    }
    this.revision++;
    return dropped;
  }

  /** Same placements as `other` (order-insensitive). */
  equals(other: readonly Placement[]): boolean {
    const key = (p: Placement) => `${p.cell.x},${p.cell.y}:${p.gem}:${p.rot}`;
    const a = this.placements.map(key).sort();
    const b = other.map(key).sort();
    return a.length === b.length && a.every((k, i) => k === b[i]);
  }

  private push(): void {
    const snap = this.list.map(copy);
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && samePlacements(top, snap)) return;
    this.undoStack.push(snap);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
  }
}
