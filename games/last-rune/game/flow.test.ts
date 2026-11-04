import { MemoryStorage } from '@thunderclap/engine/save';
import { describe, expect, it } from 'vitest';
import { MACHINE_IDS, type MachineId } from '../rules/types';
import { GameFlow, type SolveMoment } from './flow';
import { createGameSave } from './save';

type FakeScene = { kind: string; id?: MachineId; moment?: SolveMoment };

function setup(withStory = false) {
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
      ...(withStory
        ? {
            journal: () => ({ kind: 'journal' }),
            ending: (moment: SolveMoment) => ({ kind: 'ending', moment }),
          }
        : {}),
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

describe('GameFlow codex sightings', () => {
  it('opening an altar marks its gems as met before they are earned', () => {
    const f = setup();
    f.flow.newGame();
    expect(f.flow.openPuzzle('intake-desk')).toBe(true);
    expect(f.save.get().codex.met).toContain('bend');
    expect(f.save.get().codex.met).not.toContain('amplify');
    f.flow.completePuzzle('intake-desk');
    f.flow.finishSolve();
    expect(f.flow.openPuzzle('furnace')).toBe(true);
    expect(f.save.get().codex.met).toContain('amplify');
    expect(f.save.get().progress.solved).not.toContain('furnace');
  });
});

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

  it('says "a miss costs nothing" on the first miss only, and again after New Game (D-043)', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    expect(f.flow.firstMissDue()).toBe(true);
    f.flow.tellFirstMiss();
    expect(f.flow.firstMissDue()).toBe(false);
    expect(f.save.get().flags.missTold).toBe(true);
    f.flow.newGame();
    expect(f.flow.firstMissDue()).toBe(true);
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

  it('a hidden tab adds no play time: hide commits what was played, the gap counts nothing', () => {
    // Hidden, the engine stops the loop (createGame; engine e2e lifecycle.spec), so no ticks
    // arrive, and hooks.hide calls commitPlayTime. From robustness.spec :133 (test-split).
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    for (let i = 0; i < 60 * 3; i++) f.flow.tick(1 / 60);
    expect(f.save.get().stats.playSeconds).toBe(0);
    f.flow.commitPlayTime(); // hide
    expect(f.save.get().stats.playSeconds).toBeCloseTo(3, 5);
    f.flow.commitPlayTime(); // a second hide (pagehide after visibilitychange) adds nothing
    expect(f.save.get().stats.playSeconds).toBeCloseTo(3, 5);
    for (let i = 0; i < 60 * 2; i++) f.flow.tick(1 / 60); // shown again
    f.flow.toTitle();
    expect(f.save.get().stats.playSeconds).toBeCloseTo(5, 5);
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

  it('reset progress wipes the run, keeps settings, and returns to the title', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    f.save.update((d) => {
      d.settings.captionSpeed = 'fast';
      return undefined;
    });
    solve(f, 'intake-desk');
    f.flow.resetProgress();
    expect(f.kinds()).toEqual(['title']);
    expect(f.flow.state).toBe('title');
    expect(f.save.get().progress.solved).toEqual([]);
    expect(f.save.get().journal.found).toEqual([]);
    expect(f.save.get().settings.captionSpeed).toBe('fast');
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

  it('journal: opens only from the hall, closes back to it, marks only found pages read', () => {
    const f = setup(true);
    f.flow.start();
    expect(f.flow.openJournal()).toBe(false); // title
    f.flow.newGame();
    expect(f.flow.openJournal()).toBe(true);
    expect(f.kinds()).toEqual(['hall', 'journal']);
    expect(f.flow.state).toBe('journal');
    expect(f.flow.openJournal()).toBe(false);
    f.flow.closeJournal();
    expect(f.kinds()).toEqual(['hall']);
    expect(f.flow.state).toBe('hall');
    f.save.update((d) => {
      d.journal.found = [1, 3];
    });
    f.flow.markPagesRead([1, 2, 3, 1]);
    expect(f.save.get().journal.read).toEqual([1, 3]);
  });

  it('journal: without a scene wired, the hall stays put', () => {
    const f = setup();
    f.flow.start();
    f.flow.newGame();
    expect(f.flow.openJournal()).toBe(false);
    expect(f.kinds()).toEqual(['hall']);
  });

  it('the completing solve hands off to the ending; back to the hall keeps the save', () => {
    const f = setup(true);
    f.flow.start();
    f.flow.newGame();
    for (let guard = 0; guard < 20; guard++) {
      const solved = f.save.get().progress.solved;
      const next = MACHINE_IDS.find((id) => !solved.includes(id) && f.flow.canOpen(id));
      if (!next) break;
      f.flow.openPuzzle(next);
      f.flow.completePuzzle(next);
      f.flow.finishSolve();
      if (next !== 'the-last-rune') expect(f.flow.state).toBe('hall');
    }
    expect(f.flow.state).toBe('ending');
    expect(f.kinds()).toEqual(['hall', 'ending']);
    const scene = f.stack[f.stack.length - 1]!;
    expect(scene.moment?.complete).toBe(true);
    expect(scene.moment?.firstTime).toBe(true);
    f.flow.finishEnding();
    expect(f.flow.state).toBe('hall');
    expect(f.save.get().progress.solved).toHaveLength(16);
    expect(f.save.get().stats.completedAt).toBeGreaterThan(0);
  });
});
