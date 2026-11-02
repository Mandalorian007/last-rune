import { definePuzzle, gem, machineAt, stormAt } from './define';

/**
 * Teaches Gate (granted here). The player may own only Bend, so the Split that makes the two
 * inputs is pre-set along with the Gate.
 */
export default definePuzzle({
  id: 'relay-tower',
  altar: '6x4',
  board: ['. . . . . .', '. . . *S1 . *G1', '. . . . . .', '. . . . . .'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('E', 1, '6x4', 4)],
  tray: { channel: 8, bend: 4 },
  insight: 'The emerald fires only when both sides are live: bring both halves of the split home.',
  minutes: 2,
  assumes: [gem('bend')],
  essential: ['bend'],
  solution: ['. . . ┌ = ┐', '= = = *S1 . *G1', '. . . └ = ┘', '. . . . . .'],
});
