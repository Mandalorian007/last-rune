import { definePuzzle, gem, machineAt, stormAt } from './define';

/** Six. Split is not guaranteed here (Amplify, Gate and Bend are), so the magenta is pre-set. */
export default definePuzzle({
  id: 'foundry',
  altar: '6x4',
  board: ['# # . . . .', '. . . *S1 . .', '# # . . . .', '# # # # # #'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('E', 1, '6x4', 6)],
  tray: { channel: 4, bend: 4, amplify: 1, gate: 1 },
  insight: 'Six: amplify only one half of the split, then merge them.',
  minutes: 4,
  assumes: [gem('bend'), gem('amplify'), gem('gate')],
  essential: ['amplify', 'gate'],
  solution: ['# # . ┌ = ┐', '= = = *S1 . G1', '# # . └ A ┘', '# # # # # #'],
});
