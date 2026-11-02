/**
 * One puzzle per machine. Design notes, assumed capabilities and solution counts are in
 * docs/design/puzzles.md.
 */
import type { PuzzleDef } from '../../rules/model';
import type { MachineId } from '../../rules/types';
import archive from './archive';
import boilerRoom from './boiler-room';
import capacitorBay from './capacitor-bay';
import controlBooth from './control-booth';
import conveyorA from './conveyor-a';
import crane from './crane';
import foundry from './foundry';
import furnace from './furnace';
import intakeDesk from './intake-desk';
import liftShaft from './lift-shaft';
import pressUnit4 from './press-unit-4';
import relayTower from './relay-tower';
import roofArray from './roof-array';
import splitterMill from './splitter-mill';
import stormCell2 from './storm-cell-2';
import theLastRune from './the-last-rune';

export const PUZZLES: Record<MachineId, PuzzleDef> = {
  'intake-desk': intakeDesk,
  furnace,
  'splitter-mill': splitterMill,
  'relay-tower': relayTower,
  'conveyor-a': conveyorA,
  'press-unit-4': pressUnit4,
  'storm-cell-2': stormCell2,
  crane,
  'boiler-room': boilerRoom,
  archive,
  foundry,
  'capacitor-bay': capacitorBay,
  'lift-shaft': liftShaft,
  'roof-array': roofArray,
  'control-booth': controlBooth,
  'the-last-rune': theLastRune,
};

export function puzzleFor(id: MachineId): PuzzleDef {
  return PUZZLES[id];
}
