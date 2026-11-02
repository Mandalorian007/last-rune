import { definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/** A double bolt and four small boilers. */
export default definePuzzle({
  id: 'boiler-room',
  altar: '6x4',
  board: ['# . . . . .', '. . . . # #', '# . # . . #', '# # . . . .'],
  storm: stormAt('W', 1, '6x4', 2),
  machines: [
    machineAt('N', 2, '6x4', 2),
    machineAt('N', 5, '6x4', 2),
    machineAt('S', 2, '6x4', 2),
    machineAt('E', 3, '6x4', 2),
  ],
  tray: { channel: 7, bend: 3, split: 3 },
  insight: 'A double bolt feeds four boilers: a tree of three splits.',
  minutes: 4,
  assumes: [gem('bend'), gem('split'), storm2],
  essential: ['split'],
  solution: ['# . └ S0 = ┘', '= = = S1 # #', '# . # = . #', '# # ┌ S2 = ='],
});
