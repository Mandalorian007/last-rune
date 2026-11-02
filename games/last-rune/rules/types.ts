/**
 * Shared game vocabulary: the contract between workstreams.
 * Owned by the PM. Changing it requires a DECISIONS.md entry and PM merge.
 * Pure data types only: no DOM, no engine imports.
 */

/** The six gems. Channel is available from the start; the others are earned. */
export const GEM_KINDS = ['channel', 'bend', 'split', 'amplify', 'gate', 'capacitor'] as const;
export type GemKind = (typeof GEM_KINDS)[number];

/** Storm cell strength multiplier. */
export type StormStrength = 1 | 2 | 4;

/** Altar sizes from the pitch (columns × rows). */
export const ALTAR_SIZES = ['6x4', '8x6', '10x8'] as const;
export type AltarSize = (typeof ALTAR_SIZES)[number];

/** A capability is anything a machine can require or grant. */
export type Capability =
  | { type: 'gem'; gem: Exclude<GemKind, 'channel'> }
  | { type: 'storm'; strength: Exclude<StormStrength, 1> }
  | { type: 'altar'; size: Exclude<AltarSize, '6x4'> };

/** The 16 machines in the pitch. Order is roughly tier order. */
export const MACHINE_IDS = [
  // Tier 1
  'intake-desk',
  'furnace',
  'splitter-mill',
  'relay-tower',
  'conveyor-a',
  // Tier 2
  'press-unit-4',
  'storm-cell-2',
  'crane',
  'boiler-room',
  'archive',
  'foundry',
  // Tier 3
  'capacitor-bay',
  'lift-shaft',
  'roof-array',
  'control-booth',
  // Finale
  'the-last-rune',
] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

export type Tier = 1 | 2 | 3 | 4;

/** Grid direction. Altar sockets are addressed on an integer grid; rendering may lay them out as round carved sockets. */
export type Dir = 'N' | 'E' | 'S' | 'W';
export interface Cell {
  x: number;
  y: number;
}
