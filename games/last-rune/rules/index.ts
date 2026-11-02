/**
 * Rules API (contract C2). Pure TS: safe to import from scenes, tests and Node scripts.
 * Spec: docs/design/rules.md.
 */
export {
  altarDims,
  DIRS,
  dirIndex,
  isRotational,
  type MachineTarget,
  type Placement,
  type PuzzleDef,
  type PuzzleDesign,
  type Rot,
  SPARKS_PER_BOLT,
  type StormDef,
  stormCharge,
} from './model';
export {
  type MachineResult,
  type Outcome,
  type SegmentEnd,
  type SimResult,
  simulate,
  type TraceSegment,
} from './sim';
export {
  essentialGems,
  fixedEssential,
  isSolvable,
  type SolveOptions,
  type SolveResult,
  solve,
} from './solver';
export {
  type PlacementCheck,
  type PlacementError,
  puzzleProblems,
  trayRemaining,
  validatePlacement,
} from './validate';
