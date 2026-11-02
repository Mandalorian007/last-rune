import { MemoryStorage } from '@engine/save';
import { describe, expect, it } from 'vitest';
import { MACHINE_IDS, type MachineId } from '../rules/types';
import { GameFlow, type SolveMoment } from './flow';
import { createGameSave } from './save';

type FakeScene = { kind: string; id?: MachineId; moment?: SolveMoment };

function setup() {
  const stack: FakeScene[] = [];
  const fake = {
    push: (s: FakeScene) => {
      stack.push(s);
    },
    pop: () => {
      stack.pop();
    },
    replace: (s: FakeScene) => {
      stack.pop();
      stack.push(s);
    },
    clear: () => {
      stack.splice(0);
    },
  };
  const save = createGameSave({ storage: new MemoryStorage(), debounceMs: 0, autoFlush: false });
  let t = 100;
  const flow = new GameFlow<FakeScene>(
    fake,
    save,
    {
      title: () => ({ kind: 'title' }),
      hall: () => ({ kind: 'hall' }),
      puzzle: (id) => ({ kind: 'puzzle', id }),
      solve: (moment) => ({ kind: 'solve', moment }),
    },
    () => t++,
  );
  const kinds = () => stack.map((s) => s.kind);
  return { flow, save, stack, kinds };
}

type Setup = ReturnType<typeof setup>;

function solve(f: Setup, id: MachineId): SolveMoment {
  expect(f.flow.openPuzzle(id)).toBe(true);
  const m = f.flow.completePuzzle(id);
  f.flow.finishSolve();
  return m!;
}

describe('GameFlow', () => {
  it('title → new game → hall', () => {
    const f = setup();
    f.flow.start();
    expect(f.kinds()).toEqual(['title']);
    expect(f.flow.state).toBe('title');
    f.flow.newGame();
    expect(f.kinds()).toEqual(['hall']);
    expect(f.flow.state).toBe('hall');
    expect(f.save.get().stats.startedAt).toBeGreaterThan(0);
  });

  it('refuses locked puzzles and only opens from the hall', () => {
    const f = setup();
    f.flow.start();
    expect(f.flow.openPuzzle('intake-desk')).toBe(false); // on the title
    f.flow.newGame();
    expect(f.flow.openPuzzle('furnace')).toBe(false); // needs Bend
    expect(f.flow.openPuzzle('intake-desk')).toBe(true);
    expect(f.kinds()).toEqual(['hall', 'puzzle']);
    expect(f.flow.openPuzzle('intake-desk')).toBe(false); // already in a puzzle
    f.flow.closePuzzle();
    expect(f.kinds()).toEqual(['hall']);
    expect(f.flow.state).toBe('hall');
  });

  it('solve: records progress, grants, unlocks, pages; returns to the hall', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    f.flow.openPuzzle('intake-desk');
    const m = f.flow.completePuzzle('intake-desk')!;
    expect(f.kinds()).toEqual(['hall', 'solve']);
    expect(f.flow.state).toBe('solve');
    expect(m.firstTime).toBe(true);
    expect(m.grants).toEqual({ type: 'gem', gem: 'bend' });
    expect([...m.unlocked].sort()).toEqual(
      ['conveyor-a', 'furnace', 'relay-tower', 'splitter-mill'].sort(),
    );
    expect(m.pages.length).toBeGreaterThan(0);
    expect(f.save.get().journal.found).toEqual(m.pages.map((p) => p.page));
    f.flow.finishSolve();
    expect(f.kinds()).toEqual(['hall']);
    expect(f.save.get().progress.solved).toEqual(['intake-desk']);
  });

  it('replaying a solved machine grants nothing new', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    solve(f, 'intake-desk');
    const again = solve(f, 'intake-desk');
    expect(again.firstTime).toBe(false);
    expect(again.grants).toBeNull();
    expect(again.pages).toEqual([]);
    expect(f.save.get().progress.solved).toEqual(['intake-desk']);
  });

  it('completePuzzle ignores the wrong machine', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    f.flow.openPuzzle('intake-desk');
    expect(f.flow.completePuzzle('furnace')).toBeNull();
    expect(f.flow.state).toBe('puzzle');
  });

  it('counts attempts and breakers; keeps placements', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    f.flow.openPuzzle('intake-desk');
    f.flow.recordAttempt('intake-desk', 'under');
    f.flow.recordAttempt('intake-desk', 'over');
    f.flow.savePlacements('intake-desk', [{ gem: 'channel', cell: { x: 1, y: 0 }, rot: 0 }]);
    f.flow.closePuzzle();
    const d = f.save.get();
    expect(d.stats.attempts).toBe(2);
    expect(d.stats.breakersTripped).toBe(1);
    expect(f.flow.placementsFor('intake-desk')).toHaveLength(1);
  });

  it('play time counts only outside the title and commits in batches', () => {
    const f = setup();
    f.flow.start();
    for (let i = 0; i < 600; i++) f.flow.tick(1 / 60);
    expect(f.save.get().stats.playSeconds).toBe(0);
    f.flow.newGame();
    for (let i = 0; i < 60 * 11; i++) f.flow.tick(1 / 60);
    expect(f.save.get().stats.playSeconds).toBeGreaterThanOrEqual(10);
    f.flow.toTitle();
    expect(f.save.get().stats.playSeconds).toBeCloseTo(11, 5);
  });

  it('continue keeps progress; new game wipes it', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    solve(f, 'intake-desk');
    f.flow.toTitle();
    f.flow.continueGame();
    expect(f.save.get().progress.solved).toEqual(['intake-desk']);
    f.flow.toTitle();
    f.flow.newGame();
    expect(f.save.get().progress.solved).toEqual([]);
  });

  it('a full run through every machine completes the facility', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    let last: SolveMoment | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const solved = f.save.get().progress.solved;
      const next = MACHINE_IDS.find((id) => !solved.includes(id) && f.flow.canOpen(id));
      if (!next) break;
      last = solve(f, next);
    }
    expect(f.save.get().progress.solved).toHaveLength(16);
    expect(last?.machine).toBe('the-last-rune');
    expect(last?.complete).toBe(true);
    expect(f.save.get().stats.completedAt).toBeGreaterThan(0);
  });
});
