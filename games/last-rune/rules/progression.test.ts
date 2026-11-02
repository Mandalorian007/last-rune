import { describe, expect, it } from 'vitest';
import { MACHINES } from '../content/machines';
import {
  ALL_CAPABILITIES,
  analyseChoices,
  availableMachines,
  type CapabilityKey,
  capabilitiesOf,
  capabilityFromKey,
  capabilityKey,
  conduits,
  dependentsOf,
  enumerateReachableStates,
  FINALE,
  getMachine,
  granterOf,
  initialState,
  isComplete,
  isRegular,
  isUnlocked,
  type MachineDef,
  missingFor,
  missingMachinesFor,
  type ProgressState,
  parseProgressState,
  solveMachine,
  storyTier,
} from './progression';
import { MACHINE_IDS, type MachineId } from './types';

const keys = (m: MachineDef) => m.requires.map(capabilityKey);
const state = (...solved: MachineId[]): ProgressState => ({ solved });

describe('machine data', () => {
  it('has exactly the 16 machines from types.ts, in order, with puzzleId = id', () => {
    expect(MACHINES.map((m) => m.id)).toEqual([...MACHINE_IDS]);
    for (const m of MACHINES) expect(m.puzzleId).toBe(m.id);
  });

  it('grants every capability exactly once', () => {
    const granted = MACHINES.flatMap((m) => (m.grants ? [capabilityKey(m.grants)] : []));
    expect(granted.sort()).toEqual(ALL_CAPABILITIES.map(capabilityKey).sort());
  });

  it('matches the pitch where the pitch is explicit', () => {
    const grant = (id: MachineId) => {
      const g = getMachine(id).grants;
      return g ? capabilityKey(g) : null;
    };
    expect(grant('intake-desk')).toBe('gem:bend');
    expect(grant('furnace')).toBe('gem:amplify');
    expect(grant('splitter-mill')).toBe('gem:split');
    expect(grant('relay-tower')).toBe('gem:gate');
    expect(grant('conveyor-a')).toBeNull();
    expect(grant('storm-cell-2')).toBe('storm:2');
    expect(grant('crane')).toBe('altar:8x6');
    expect(grant('capacitor-bay')).toBe('gem:capacitor');
    const req = (id: MachineId) => keys(getMachine(id));
    expect(req('intake-desk')).toEqual([]);
    expect(req('press-unit-4')).toEqual(['gem:amplify', 'gem:split']);
    expect(req('storm-cell-2')).toEqual(['gem:split']);
    expect(req('crane')).toEqual(['gem:gate']);
    expect(req('boiler-room')).toEqual(['storm:2']);
    expect(req('archive')).toEqual(['altar:8x6']);
    expect(req('foundry')).toEqual(['gem:amplify', 'gem:gate']);
    // Pitch requirements kept as a subset where we added a cross-wing lock.
    expect(req('capacitor-bay')).toContain('storm:2');
    expect(req('lift-shaft')).toEqual(['gem:capacitor']);
    expect(req('roof-array')).toEqual(expect.arrayContaining(['altar:8x6', 'gem:gate']));
  });

  it('control booth needs every regular machine and every capability but the one it grants', () => {
    const booth = getMachine('control-booth');
    expect([...(booth.requiresSolved ?? [])].sort()).toEqual(MACHINE_IDS.filter(isRegular).sort());
    const others = ALL_CAPABILITIES.map(capabilityKey).filter(
      (k) => k !== capabilityKey(booth.grants!),
    );
    expect(keys(booth).sort()).toEqual(others.sort());
  });

  it('the Last Rune needs everything', () => {
    expect(keys(getMachine('the-last-rune')).sort()).toEqual(
      ALL_CAPABILITIES.map(capabilityKey).sort(),
    );
  });

  it('every requirement is granted by an earlier-or-equal tier and never by itself', () => {
    for (const m of MACHINES) {
      for (const c of m.requires) {
        const g = granterOf(c);
        expect(g, `${m.id} needs ${capabilityKey(c)}`).toBeDefined();
        expect(g!.id).not.toBe(m.id);
        expect(g!.tier).toBeLessThanOrEqual(m.tier);
      }
    }
  });

  it('places every alcove inside the hall with room between them', () => {
    for (const m of MACHINES) {
      expect(m.alcove.x).toBeGreaterThanOrEqual(80);
      expect(m.alcove.x).toBeLessThanOrEqual(1840);
      expect(m.alcove.y).toBeGreaterThanOrEqual(80);
      expect(m.alcove.y).toBeLessThanOrEqual(1000);
    }
    for (let i = 0; i < MACHINES.length; i++) {
      for (let j = i + 1; j < MACHINES.length; j++) {
        const a = MACHINES[i]!.alcove;
        const b = MACHINES[j]!.alcove;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(180);
      }
    }
  });

  it('puts the Last Rune at the centre and the intake desk at the front', () => {
    expect(getMachine('the-last-rune').alcove).toEqual({ x: 960, y: 540 });
    expect(getMachine('intake-desk').alcove.y).toBe(Math.max(...MACHINES.map((m) => m.alcove.y)));
  });
});

describe('progression API', () => {
  it('starts with only the intake desk open', () => {
    expect(availableMachines(initialState()).map((m) => m.id)).toEqual(['intake-desk']);
    expect(capabilitiesOf(initialState())).toEqual([]);
  });

  it('reports missing sockets and missing machines', () => {
    const s = state('intake-desk', 'furnace');
    expect(missingFor('press-unit-4', s).map(capabilityKey)).toEqual(['gem:split']);
    expect(isUnlocked('press-unit-4', s)).toBe(false);
    expect(missingMachinesFor('control-booth', s)).toHaveLength(12);
    expect(missingMachinesFor('furnace', s)).toEqual([]);
  });

  it('solveMachine refuses locked machines and is idempotent', () => {
    const s = solveMachine(initialState(), 'intake-desk');
    expect(() => solveMachine(s, 'crane')).toThrow(/locked/);
    expect(solveMachine(s, 'intake-desk')).toBe(s);
    expect(capabilitiesOf(s).map(capabilityKey)).toEqual(['gem:bend']);
  });

  it('round-trips capability keys', () => {
    for (const c of ALL_CAPABILITIES) expect(capabilityFromKey(capabilityKey(c))).toEqual(c);
    expect(() => capabilityFromKey('gem:nope' as CapabilityKey)).toThrow();
  });

  it('repairs untrusted saves into reachable states', () => {
    expect(parseProgressState(null)).toEqual(initialState());
    expect(parseProgressState({ solved: 'x' })).toEqual(initialState());
    expect(parseProgressState({ solved: ['furnace', 'intake-desk', 'bogus', 'furnace'] })).toEqual(
      state('intake-desk', 'furnace'),
    );
    // crane without the relay is dropped
    expect(parseProgressState({ solved: ['intake-desk', 'crane'] })).toEqual(state('intake-desk'));
  });

  it('tracks the story tier', () => {
    expect(storyTier(state('intake-desk'))).toBe(1);
    expect(storyTier(state('intake-desk', 'splitter-mill', 'storm-cell-2'))).toBe(2);
    const all = MACHINE_IDS.filter((id) => id !== 'the-last-rune');
    expect(storyTier(state(...all.filter((id) => id !== 'control-booth')))).toBe(3);
    expect(storyTier(state(...all))).toBe(4);
  });

  it('derives one conduit per requirement', () => {
    const c = conduits();
    expect(c.length).toBe(MACHINES.reduce((n, m) => n + m.requires.length, 0));
    expect(c).toContainEqual({ from: 'crane', to: 'archive', capability: 'altar:8x6' });
    expect(c).toContainEqual({
      from: 'control-booth',
      to: 'the-last-rune',
      capability: 'altar:10x8',
    });
  });
});

describe('reachability (exhaustive over every play order)', () => {
  const states = enumerateReachableStates();
  const report = analyseChoices();

  it('explores the whole space', () => {
    expect(states.length).toBe(report.stateCount);
    expect(states.length).toBeGreaterThan(200);
  });

  it('can always finish: every machine is reachable and nothing softlocks', () => {
    expect(report.softlocks).toEqual([]);
    const complete = states.filter((s) => isComplete(s));
    expect(complete).toHaveLength(1);
    for (const id of MACHINE_IDS) expect(states.some((s) => s.available.includes(id))).toBe(true);
  });

  it('control booth is always the 15th machine and the Last Rune the 16th', () => {
    for (const s of states) {
      if (s.available.includes('control-booth')) expect(s.solved).toHaveLength(14);
      if (s.available.includes('the-last-rune')) expect(s.solved).toHaveLength(15);
    }
  });

  it('Tier 3 only opens once the Storm and Signal wings have met', () => {
    for (const s of states) {
      for (const id of s.available) {
        if (getMachine(id).tier === 3) {
          expect(s.solved).toEqual(expect.arrayContaining(['storm-cell-2', 'crane']));
        }
      }
    }
  });

  it('ALWAYS A CHOICE: two or more doors in every state, except the explained ones', () => {
    const unexplained = report.singleDoorStates.filter((s) => s.reason === 'unexplained');
    expect(unexplained).toEqual([]);
    // Exactly one start state and two finale states (booth, then the Last Rune).
    const byReason = (r: string) => report.singleDoorStates.filter((s) => s.reason === r);
    expect(byReason('start').map((s) => s.door)).toEqual(['intake-desk']);
    expect(
      byReason('finale')
        .map((s) => s.door)
        .sort(),
    ).toEqual([...FINALE].sort());
  });

  it('a single-door gate state only happens after the player has cleared every door around it', () => {
    // 'gate' means: every regular machine that does not depend on the door is already restored.
    for (const s of report.singleDoorStates.filter((x) => x.reason === 'gate')) {
      const unsolved = MACHINE_IDS.filter((id) => isRegular(id) && !s.solved.includes(id));
      expect(new Set(unsolved)).toEqual(new Set([s.door, ...dependentsOf(s.door)]));
    }
    expect(report.earliestGatePinch).toBeGreaterThanOrEqual(7);
  });

  it('never two single-door states in a row before the finale', () => {
    for (const s of report.singleDoorStates) {
      if (s.reason === 'finale' || s.reason === 'last-regular') continue;
      const next = solveMachine({ solved: s.solved }, s.door);
      const regularLeft = MACHINE_IDS.filter((id) => isRegular(id) && !next.solved.includes(id));
      if (regularLeft.length >= 2) {
        expect(availableMachines(next).length, `after ${s.door}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('two or more doors in at least 90% of open states', () => {
    expect(report.multiDoorStates / report.openStates).toBeGreaterThan(0.9);
  });

  it('the strict rule is impossible with AND-locks: each gate has a reachable pinch', () => {
    // Documented in progression.md §3. If this ever fails, the graph changed shape.
    const gates = MACHINES.filter((m) => isRegular(m.id) && dependentsOf(m.id).length > 0);
    for (const g of gates) {
      const pinch = report.singleDoorStates.find(
        (s) => s.door === g.id && (s.reason === 'gate' || s.reason === 'start'),
      );
      expect(pinch, g.id).toBeDefined();
    }
  });
});
