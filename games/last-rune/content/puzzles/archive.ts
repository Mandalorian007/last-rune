import { altar8x6, definePuzzle, gem, machineAt, stormAt } from './define';

/**
 * Filing cabinets. Split is not guaranteed here (only 8×6, Gate and Bend are), so the two
 * magentas are pre-set in the stacks; the player threads the halves through the maze.
 */
export default definePuzzle({
  id: 'archive',
  altar: '8x6',
  board: [
    '. . . . . . # .',
    '. *S1 # . # . # .',
    '# . # . # . . .',
    '. *S2 . . . . . .',
    '. # # # . . # .',
    '. # . . . # # #',
  ],
  storm: stormAt('W', 1, '8x6'),
  machines: [machineAt('E', 3, '8x6', 3), machineAt('S', 0, '8x6', 1)],
  tray: { channel: 13, bend: 6, gate: 1 },
  insight: 'Every spark has a drawer: two and one for the big cabinet, one for the small.',
  minutes: 5,
  assumes: [gem('bend'), gem('gate'), altar8x6],
  essential: ['gate'],
  solution: [
    '. ┌ = = = ┐ # .',
    '= *S1 # . # = # .',
    '# = # . # = . .',
    '┌ *S2 = = ┐ G1 = =',
    '= # # # └ ┘ # .',
    '= # . . . # # #',
  ],
});
