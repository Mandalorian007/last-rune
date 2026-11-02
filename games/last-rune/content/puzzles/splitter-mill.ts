import { definePuzzle, gem, machineAt, stormAt } from './define';

/** Teaches Split (granted here) with a pre-set magenta between two half-size machines. */
export default definePuzzle({
  id: 'splitter-mill',
  altar: '6x4',
  board: ['. . . . . .', '. . *S2 . . .', '. . . . . .', '. . . . . .'],
  storm: stormAt('N', 0, '6x4'),
  machines: [machineAt('E', 1, '6x4', 2), machineAt('W', 1, '6x4', 2)],
  tray: { channel: 8, bend: 4 },
  insight: 'A split sends halves out of its sides, never straight on: feed it from above.',
  minutes: 2,
  assumes: [gem('bend')],
  essential: ['bend'],
  solution: ['└ = ┐ . . .', '= = *S2 = = =', '. . . . . .', '. . . . . .'],
});
