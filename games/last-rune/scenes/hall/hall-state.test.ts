import { describe, expect, it } from 'vitest';
import { MACHINES } from '../../content/machines';
import { initialState, solveMachine } from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import {
  ALCOVE_HIT,
  alcoveAt,
  alcoveNote,
  deriveHall,
  firstFocus,
  focusOrder,
  type HallModel,
  lineForAlcove,
  lockedNote,
  newlyUnlocked,
} from './hall-state';

const solvedAfter = (...ids: MachineId[]) =>
  ids.reduce((s, id) => solveMachine(s, id), initialState());
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
    const m = deriveHall(solvedAfter('intake-desk', 'furnace'));
    expect(byId(m, 'press-unit-4').missing.map((s) => s.capability)).toEqual(['gem:split']);
    expect(byId(m, 'furnace').status).toBe('solved');
    const lit = m.conduits.filter((c) => c.lit);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.every((c) => c.from === 'intake-desk' || c.from === 'furnace')).toBe(true);
  });

  it('storm sockets carry their ring count; the booth counts missing machines', () => {
    const m = deriveHall(initialState());
    expect(byId(m, 'boiler-room').missing).toEqual([
      { capability: 'storm:2', colour: 'cyan', label: 'Storm ×2', rings: 2, from: 'Storm Cell II' },
    ]);
    expect(byId(m, 'control-booth').missingMachines).toBe(14);
    expect(byId(m, 'the-last-rune').floor).toBe(true);
  });

  it('the name plate names what a locked door needs, not just its colour', () => {
    const m = deriveHall(initialState());
    expect(alcoveNote(byId(m, 'intake-desk'))).toBe('Open · try this one next');
    const furnace = byId(m, 'furnace');
    expect(alcoveNote(furnace)).toMatch(/^Locked · needs \S/);
    expect(alcoveNote(furnace)).toContain(furnace.missing[0]!.label);
    // ...and where to earn it.
    expect(alcoveNote(furnace)).toBe('Locked · needs Bend (from Intake Desk)');
    expect(alcoveNote(byId(deriveHall(solvedAfter('intake-desk')), 'intake-desk'))).toBe(
      'Restored',
    );
    const booth = m.alcoves.find((a) => a.missingMachines > 0);
    if (booth) expect(alcoveNote(booth)).toMatch(/\d+ more machines?$/);
  });

  it('a phone card says in plain words what opens a locked door, names unbroken', () => {
    const m = deriveHall(initialState());
    const nb = (s: string) => s.replace(/ /g, ' ');
    expect(lockedNote(byId(m, 'furnace'))).toBe(`Locked: solve ${nb('Intake Desk')} first`);
    expect(lockedNote(byId(m, 'control-booth'))).toBe('Locked: solve 14 more machines first');
    expect(lockedNote(byId(m, 'the-last-rune'))).toBe('Locked: earn these gems first');
    expect(lockedNote(byId(m, 'intake-desk'))).toBe('Open · try this one next');
    for (const a of m.alcoves) expect(lockedNote(a)).not.toMatch(/·.*·|\(|\+/);
  });

  it('suggests exactly one open door: the next in story order', () => {
    const fresh = deriveHall(initialState());
    expect(fresh.alcoves.filter((a) => a.suggested).map((a) => a.id)).toEqual(['intake-desk']);
    const after = deriveHall(solvedAfter('intake-desk'));
    expect(after.alcoves.filter((a) => a.suggested).map((a) => a.id)).toEqual(['furnace']);
    expect(alcoveNote(byId(after, 'furnace'))).toBe('Open · try this one next');
    expect(alcoveNote(byId(after, 'splitter-mill'))).toBe('Open · click or Enter to restore');
    expect(firstFocus(after)).toBe('furnace');
  });

  it('newlyUnlocked lists doors opened by a solve', () => {
    expect(newlyUnlocked(initialState(), solvedAfter('intake-desk')).sort()).toEqual(
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
    // The intake's arrive line is an altar instruction ("Step one: gem from the tray"), so
    // the hall says its own line; other open doors say their arrive line.
    const intake = lineForAlcove(byId(m, 'intake-desk'))!;
    expect(intake.kind).toBe('door');
    expect(intake.text).not.toMatch(/tray|socket|Step one/);
    expect(lineForAlcove(byId(deriveHall(solvedAfter('intake-desk')), 'furnace'))!.kind).toBe(
      'arrive',
    );
    expect(lineForAlcove(byId(m, 'press-unit-4'))!.kind).toBe('locked');
    expect(lineForAlcove(byId(m, 'furnace'))!.kind).toBe('socket');
    const solved = deriveHall(solvedAfter('intake-desk'));
    expect(lineForAlcove(byId(solved, 'intake-desk'))!.kind).toBe('solve');
  });

  it('focus order starts at the entrance and covers every alcove', () => {
    const order = focusOrder(deriveHall(initialState()));
    expect(order[0]).toBe('intake-desk');
    expect(new Set(order).size).toBe(MACHINES.length);
  });
});
