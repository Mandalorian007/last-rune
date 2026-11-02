import { definePuzzle, gem, machineAt, stormAt } from './define';

/** Halves of halves. */
export default definePuzzle({
  id: 'storm-cell-2',
  altar: '6x4',
  board: ['# # # . # #', '. . . . . #', '# . . . . .', '# . # # # #'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('N', 3, '6x4', 2), machineAt('E', 2, '6x4', 1), machineAt('S', 1, '6x4', 1)],
  tray: { channel: 8, bend: 2, split: 2 },
  insight: 'Split a split: one half goes up whole, the other is halved again.',
  minutes: 3,
  assumes: [gem('bend'), gem('split')],
  essential: ['split'],
  solution: ['# # # = # #', '= = = S1 . #', '# ┌ = S2 = =', '# = # # # #'],
});
