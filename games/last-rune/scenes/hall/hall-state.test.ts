import { describe, expect, it } from 'vitest';
import { MACHINES } from '../../content/machines';
import { initialState, solveMachine } from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import {
  ALCOVE_HIT,
  alcoveAt,
  deriveHall,
  focusOrder,
  type HallModel,
  lineForAlcove,
  newlyUnlocked,
} from './hall-state';

const after = (...ids: MachineId[]) => ids.reduce((s, id) => solveMachine(s, id), initialState());
const byId = (m: HallModel, id: MachineId) => m.alcoves.find((a) => a.id === id)!;

describe('hall state', () => {
  it('fresh game: only the intake desk is open, everything else locked with sockets', () => {
    const m = deriveHall(initialState());
    expect(m.alcoves).toHaveLength(MACHINES.length);
    expect(m.alcoves.filter((a) => a.status === 'unlocked').map((a) => a.id)).toEqual([
      'intake-desk',
    ]);
    const furnace = byId(m, 'furnace');
    expect(furnace.status).toBe('locked');
    expect(furnace.missing.map((s) => s.colour)).toEqual(['amethyst']);
    expect(byId(m, 'intake-desk').grantColour).toBe('amethyst');
    expect(m.conduits.every((c) => !c.lit)).toBe(true);
  });

  it('missing sockets shrink as capabilities arrive; conduits light from restored machines', () => {
    const m = deriveHall(after('intake-desk', 'furnace'));
    expect(byId(m, 'press-unit-4').missing.map((s) => s.capability)).toEqual(['gem:split']);
    expect(byId(m, 'furnace').status).toBe('solved');
    const lit = m.conduits.filter((c) => c.lit);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.every((c) => c.from === 'intake-desk' || c.from === 'furnace')).toBe(true);
  });

  it('storm sockets carry their ring count; the booth counts missing machines', () => {
    const m = deriveHall(initialState());
    expect(byId(m, 'boiler-room').missing).toEqual([
      { capability: 'storm:2', colour: 'cyan', rings: 2 },
    ]);
    expect(byId(m, 'control-booth').missingMachines).toBe(14);
    expect(byId(m, 'the-last-rune').floor).toBe(true);
  });

  it('newlyUnlocked lists doors opened by a solve', () => {
    expect(newlyUnlocked(initialState(), after('intake-desk')).sort()).toEqual(
      ['conveyor-a', 'furnace', 'relay-tower', 'splitter-mill'].sort(),
    );
  });

  it('hit-testing finds alcoves at their centre and nothing on empty floor', () => {
    const m = deriveHall(initialState());
    for (const a of m.alcoves) expect(alcoveAt(m, a.x, a.y)?.id).toBe(a.id);
    expect(alcoveAt(m, 960 + ALCOVE_HIT.w * 1.5, 760)).toBeNull();
  });

  it('picks the right FUSE line per state', () => {
    const m = deriveHall(initialState());
    for (const a of m.alcoves) expect(lineForAlcove(a), a.id).toBeDefined();
    expect(lineForAlcove(byId(m, 'intake-desk'))!.kind).toBe('arrive');
    expect(lineForAlcove(byId(m, 'press-unit-4'))!.kind).toBe('locked');
    expect(lineForAlcove(byId(m, 'furnace'))!.kind).toBe('socket');
    const solved = deriveHall(after('intake-desk'));
    expect(lineForAlcove(byId(solved, 'intake-desk'))!.kind).toBe('solve');
  });

  it('focus order starts at the entrance and covers every alcove', () => {
    const order = focusOrder(deriveHall(initialState()));
    expect(order[0]).toBe('intake-desk');
    expect(new Set(order).size).toBe(MACHINES.length);
  });
});
