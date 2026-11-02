import { definePuzzle, gem, machineAt, stormAt } from './define';

/** Amber before magenta. */
export default definePuzzle({
  id: 'press-unit-4',
  altar: '6x4',
  board: ['# # # . . #', '. . . . . .', '# . . . . #', '# . # # # #'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('N', 4, '6x4'), machineAt('S', 1, '6x4')],
  tray: { channel: 7, bend: 3, amplify: 1, split: 1 },
  insight: 'Amber before magenta: amplify once, then split, so both halves are full.',
  minutes: 3,
  assumes: [gem('bend'), gem('amplify'), gem('split')],
  essential: ['amplify', 'split'],
  solution: ['# # # . = #', '= A = = S1 .', '# ┌ = = ┘ #', '# = # # # #'],
});
