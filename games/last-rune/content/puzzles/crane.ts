import { definePuzzle, gem, machineAt, stormAt } from './define';

/**
 * Three from four. Split is not guaranteed here (only Gate and Bend are), so the two magentas
 * are pre-set; the player's job is choosing which half and which quarter meet in the emerald.
 */
export default definePuzzle({
  id: 'crane',
  altar: '6x4',
  board: ['# # . . . #', '. . *S . . #', '# . . *S . .', '# # . . . #'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('E', 2, '6x4', 3)],
  tray: { channel: 5, bend: 5, gate: 1 },
  insight: 'Three from four: merge a half with a quarter in the emerald, let the last quarter go.',
  minutes: 4,
  assumes: [gem('bend'), gem('gate')],
  essential: ['gate'],
  solution: ['# # ┌ = ┐ #', '= = *S . = #', '# . └ *S G1 =', '# # . └ ┘ #'],
});
