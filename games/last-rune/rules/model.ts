/**
 * Puzzle data model (contract C2). Pure data + small helpers, no DOM/GPU.
 * Spec: docs/design/rules.md.
 */
import type { AltarSize, Capability, Cell, Dir, GemKind, MachineId, StormStrength } from './types';

export type Rot = 0 | 1 | 2 | 3;

/** One gem set into one socket. `rot` only matters for Bend, Gate and Split. */
export interface Placement {
  gem: GemKind;
  cell: Cell;
  rot: Rot;
}

/** The storm cell: just outside the altar, firing `dir` into it. */
export interface StormDef {
  at: Cell;
  dir: Dir;
  strength: StormStrength;
}

/** A machine: just outside the altar; wakes at exactly `need` sparks in one strike. */
export interface MachineTarget {
  at: Cell;
  need: number;
}

/** Designer notes, carried with the puzzle for docs, hints and tests. */
export interface PuzzleDesign {
  /** The one-sentence "aha". */
  insight: string;
  /** Rough target solve time for a first-time player. */
  minutes: number;
  /** Capabilities the puzzle assumes the player has when it unlocks (for PM reconciliation). */
  assumes: Capability[];
  /** Gem kinds the puzzle cannot be solved without (tested by removing each from the tray). */
  essential: GemKind[];
  /** A known solution (tested). Used as the last-resort hint. */
  intended: Placement[];
}

/** A serialisable puzzle. One per machine; `id` doubles as the puzzle id. */
export interface PuzzleDef {
  id: MachineId;
  altar: AltarSize;
  /** Carved-stone sockets that can never hold a gem. */
  blocked: Cell[];
  /** Pre-set gems: lit like any other gem, but the player cannot move them. */
  fixed: Placement[];
  storm: StormDef;
  machines: MachineTarget[];
  /** How many of each gem the player may place. Missing kinds = 0. */
  tray: Partial<Record<GemKind, number>>;
  /** Number of storm strikes per attempt (1 unless capacitors are in play). */
  pulses: number;
  design: PuzzleDesign;
}

/** Sparks in a 1x bolt. Storm strength multiplies it. */
export const SPARKS_PER_BOLT = 4;

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export function dirIndex(d: Dir): number {
  return DIRS.indexOf(d);
}

export function altarDims(size: AltarSize): { w: number; h: number } {
  const [w, h] = size.split('x').map(Number) as [number, number];
  return { w, h };
}

export function stormCharge(strength: StormStrength): number {
  return SPARKS_PER_BOLT * strength;
}

/** Gems whose behaviour depends on rotation. */
export function isRotational(gem: GemKind): boolean {
  return gem === 'bend' || gem === 'gate' || gem === 'split';
}

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}
