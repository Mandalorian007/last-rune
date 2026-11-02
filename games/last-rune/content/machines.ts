/**
 * The 16 machines (contract C4). The capability graph is justified in
 * docs/design/progression.md; the API that reads it is rules/progression.ts.
 *
 * Hall layout (1920×1080): intake desk at the front (bottom centre), the Last
 * Rune on the floor at the centre, the control booth on the back wall above it.
 * Heat wing on the left wall, Storm wing on the right wall, Signal wing along
 * the back wall either side of the booth. The lift shaft sits in the top-right
 * corner beside the roof array.
 */
import type { MachineDef } from '../rules/progression';
import type { Capability, MachineId } from '../rules/types';

const bend: Capability = { type: 'gem', gem: 'bend' };
const split: Capability = { type: 'gem', gem: 'split' };
const amplify: Capability = { type: 'gem', gem: 'amplify' };
const gate: Capability = { type: 'gem', gem: 'gate' };
const capacitor: Capability = { type: 'gem', gem: 'capacitor' };
const storm2: Capability = { type: 'storm', strength: 2 };
const storm4: Capability = { type: 'storm', strength: 4 };
const altar8x6: Capability = { type: 'altar', size: '8x6' };
const altar10x8: Capability = { type: 'altar', size: '10x8' };

/** The fourteen regular machines: the control booth needs all of them restored. */
const REGULAR: readonly MachineId[] = [
  'intake-desk',
  'furnace',
  'splitter-mill',
  'relay-tower',
  'conveyor-a',
  'press-unit-4',
  'storm-cell-2',
  'crane',
  'boiler-room',
  'archive',
  'foundry',
  'capacitor-bay',
  'lift-shaft',
  'roof-array',
];

export const MACHINES: readonly MachineDef[] = [
  // ── Tier 1 ────────────────────────────────────────────────────────────────
  {
    id: 'intake-desk',
    name: 'Intake Desk',
    tier: 1,
    branch: 'convergence',
    requires: [],
    grants: bend,
    puzzleId: 'intake-desk',
    alcove: { x: 960, y: 960 },
  },
  {
    id: 'furnace',
    name: 'Furnace',
    tier: 1,
    branch: 'heat',
    requires: [bend],
    grants: amplify,
    puzzleId: 'furnace',
    alcove: { x: 200, y: 840 },
  },
  {
    id: 'splitter-mill',
    name: 'Splitter Mill',
    tier: 1,
    branch: 'storm',
    requires: [bend],
    grants: split,
    puzzleId: 'splitter-mill',
    alcove: { x: 1720, y: 840 },
  },
  {
    id: 'relay-tower',
    name: 'Relay Tower',
    tier: 1,
    branch: 'signal',
    requires: [bend],
    grants: gate,
    puzzleId: 'relay-tower',
    alcove: { x: 420, y: 150 },
  },
  {
    id: 'conveyor-a',
    name: 'Conveyor A',
    tier: 1,
    branch: 'heat',
    requires: [bend],
    grants: null,
    puzzleId: 'conveyor-a',
    alcove: { x: 500, y: 900 },
  },
  // ── Tier 2 ────────────────────────────────────────────────────────────────
  {
    id: 'press-unit-4',
    name: 'Press Unit 4',
    tier: 2,
    branch: 'heat',
    requires: [amplify, split],
    grants: null,
    puzzleId: 'press-unit-4',
    alcove: { x: 200, y: 580 },
  },
  {
    id: 'storm-cell-2',
    name: 'Storm Cell II',
    tier: 2,
    branch: 'storm',
    requires: [split],
    grants: storm2,
    puzzleId: 'storm-cell-2',
    alcove: { x: 1720, y: 580 },
  },
  {
    id: 'crane',
    name: 'Crane',
    tier: 2,
    branch: 'signal',
    requires: [gate],
    grants: altar8x6,
    puzzleId: 'crane',
    alcove: { x: 680, y: 150 },
  },
  {
    id: 'boiler-room',
    name: 'Boiler Room',
    tier: 2,
    branch: 'storm',
    requires: [storm2],
    grants: null,
    puzzleId: 'boiler-room',
    alcove: { x: 1420, y: 900 },
  },
  {
    id: 'archive',
    name: 'Archive',
    tier: 2,
    branch: 'signal',
    requires: [altar8x6],
    grants: null,
    puzzleId: 'archive',
    alcove: { x: 1240, y: 150 },
  },
  {
    id: 'foundry',
    name: 'Foundry',
    tier: 2,
    branch: 'heat',
    requires: [amplify, gate],
    grants: null,
    puzzleId: 'foundry',
    alcove: { x: 200, y: 320 },
  },
  // ── Tier 3 ────────────────────────────────────────────────────────────────
  {
    id: 'capacitor-bay',
    name: 'Capacitor Bay',
    tier: 3,
    branch: 'storm',
    // Pitch: 2×. Added 8×6 so Tier 3 opens only where the Storm and Signal wings meet.
    requires: [storm2, altar8x6],
    grants: capacitor,
    puzzleId: 'capacitor-bay',
    alcove: { x: 1720, y: 340 },
  },
  {
    id: 'lift-shaft',
    name: 'Lift Shaft',
    tier: 3,
    branch: 'storm',
    requires: [capacitor],
    grants: null,
    puzzleId: 'lift-shaft',
    alcove: { x: 1740, y: 130 },
  },
  {
    id: 'roof-array',
    name: 'Roof Array',
    tier: 3,
    branch: 'signal',
    // Pitch: 8×6 + Gate. Added Capacitor: the storm arrives in pulses up there.
    requires: [altar8x6, gate, capacitor],
    grants: storm4,
    puzzleId: 'roof-array',
    alcove: { x: 1500, y: 150 },
  },
  {
    id: 'control-booth',
    name: 'Control Booth',
    tier: 3,
    branch: 'convergence',
    requires: [bend, split, amplify, gate, capacitor, storm2, storm4, altar8x6],
    requiresSolved: REGULAR,
    grants: altar10x8,
    puzzleId: 'control-booth',
    alcove: { x: 960, y: 150 },
  },
  // ── Finale ────────────────────────────────────────────────────────────────
  {
    id: 'the-last-rune',
    name: 'The Last Rune',
    tier: 4,
    branch: 'convergence',
    requires: [bend, split, amplify, gate, capacitor, storm2, storm4, altar8x6, altar10x8],
    grants: null,
    puzzleId: 'the-last-rune',
    alcove: { x: 960, y: 540 },
  },
];
