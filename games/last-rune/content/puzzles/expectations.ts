/**
 * Test fixtures for the puzzle suite: the capability graph from progression-content and the
 * numbers the solver reported when each puzzle was designed (docs/design/puzzles.md).
 */
import type { Capability, GemKind, MachineId } from '../../rules/types';
import { altar8x6, altar10x8, gem, storm2, storm4 } from './define';

const bend = gem('bend');
const split = gem('split');
const amplify = gem('amplify');
const gate = gem('gate');
const capacitor = gem('capacitor');

/**
 * What the player is guaranteed to own when each machine unlocks: its requirements plus
 * everything granted by machines that must come before it.
 */
export const GUARANTEED: Record<MachineId, Capability[]> = {
  'intake-desk': [],
  furnace: [bend],
  'splitter-mill': [bend],
  'relay-tower': [bend],
  'conveyor-a': [bend],
  'press-unit-4': [bend, amplify, split],
  'storm-cell-2': [bend, split],
  crane: [bend, gate],
  'boiler-room': [bend, split, storm2],
  archive: [bend, gate, altar8x6],
  foundry: [bend, amplify, gate],
  'capacitor-bay': [bend, split, gate, storm2, altar8x6],
  'lift-shaft': [bend, split, gate, capacitor, storm2, altar8x6],
  'roof-array': [bend, split, gate, capacitor, storm2, altar8x6],
  'control-booth': [bend, amplify, split, gate, capacitor, storm2, storm4, altar8x6],
  'the-last-rune': [bend, amplify, split, gate, capacitor, storm2, storm4, altar8x6, altar10x8],
};

/** Canonical solution counts (every placed gem carries charge to a machine). */
export const SOLUTION_COUNT: Record<MachineId, number> = {
  'intake-desk': 1,
  furnace: 3,
  'splitter-mill': 1,
  'relay-tower': 2,
  'conveyor-a': 4,
  'press-unit-4': 2,
  'storm-cell-2': 1,
  crane: 2,
  'boiler-room': 1,
  archive: 3,
  foundry: 2,
  'capacitor-bay': 1,
  'lift-shaft': 3,
  'roof-array': 5,
  'control-booth': 1,
  'the-last-rune': 4,
};

/** Pre-set gems the puzzle is built around: removing them must make it unsolvable. */
export const FIXED_ESSENTIAL: Partial<Record<MachineId, GemKind[]>> = {
  'intake-desk': ['bend'],
  furnace: ['amplify'],
  'splitter-mill': ['split'],
  'relay-tower': ['split'],
  'conveyor-a': ['split'],
  crane: ['split'],
  archive: ['split'],
  foundry: ['split'],
  'capacitor-bay': ['capacitor'],
};

/** Puzzles whose full solution count takes seconds; counted only with FULL=1. */
export const SLOW: MachineId[] = ['the-last-rune'];
