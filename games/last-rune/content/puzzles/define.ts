/**
 * Authoring helper: puzzles are drawn as ASCII (see rules/ascii.ts) and compiled to PuzzleDef.
 * The `solution` drawing is the full intended board; only its non-fixed gems become
 * `design.intended`.
 */
import { parseBoard } from '../../rules/ascii';
import type { MachineTarget, PuzzleDef, StormDef } from '../../rules/model';
import type { AltarSize, Capability, Cell, Dir, GemKind, MachineId } from '../../rules/types';

export interface PuzzleSpec {
  id: MachineId;
  altar: AltarSize;
  /** Board drawing: `.` open, `#` blocked, `*X` fixed gem. */
  board: string[];
  storm: StormDef;
  machines: MachineTarget[];
  tray: Partial<Record<GemKind, number>>;
  pulses?: number;
  insight: string;
  minutes: number;
  assumes: Capability[];
  essential: GemKind[];
  /** The intended solution drawn over the board. */
  solution: string[];
}

export function definePuzzle(spec: PuzzleSpec): PuzzleDef {
  const board = parseBoard(spec.board);
  const [w, h] = spec.altar.split('x').map(Number) as [number, number];
  if (board.w !== w || board.h !== h)
    throw new Error(`${spec.id}: board is ${board.w}x${board.h}, altar is ${spec.altar}`);
  const sol = parseBoard(spec.solution);
  return {
    id: spec.id,
    altar: spec.altar,
    blocked: board.blocked,
    fixed: board.fixed,
    storm: spec.storm,
    machines: spec.machines,
    tray: spec.tray,
    pulses: spec.pulses ?? 1,
    design: {
      insight: spec.insight,
      minutes: spec.minutes,
      assumes: spec.assumes,
      essential: spec.essential,
      intended: sol.placements,
    },
  };
}

// Small constructors to keep puzzle files readable.
export const gem = (g: Exclude<GemKind, 'channel'>): Capability => ({ type: 'gem', gem: g });
export const storm2: Capability = { type: 'storm', strength: 2 };
export const storm4: Capability = { type: 'storm', strength: 4 };
export const altar8x6: Capability = { type: 'altar', size: '8x6' };
export const altar10x8: Capability = { type: 'altar', size: '10x8' };

/** A storm cell outside the altar. `side` is the altar edge it sits on; `i` the row/column. */
export function stormAt(
  side: Dir,
  i: number,
  altar: AltarSize,
  strength: StormDef['strength'] = 1,
): StormDef {
  const at = outside(side, i, altar);
  const dir: Dir = ({ N: 'S', S: 'N', E: 'W', W: 'E' } as const)[side];
  return { at, dir, strength };
}

/** A machine outside the altar on edge `side` at row/column `i`. */
export function machineAt(side: Dir, i: number, altar: AltarSize, need = 4): MachineTarget {
  return { at: outside(side, i, altar), need };
}

function outside(side: Dir, i: number, altar: AltarSize): Cell {
  const [w, h] = altar.split('x').map(Number) as [number, number];
  switch (side) {
    case 'N':
      return { x: i, y: -1 };
    case 'S':
      return { x: i, y: h };
    case 'W':
      return { x: -1, y: i };
    case 'E':
      return { x: w, y: i };
  }
}
