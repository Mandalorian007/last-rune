import { definePuzzle, gem, machineAt, stormAt } from './define';

/**
 * Teaches Amplify (granted here) with two pre-set ambers off the straight road. The first try
 * (the shortest route) misses both and reads half; any route through one amber is enough.
 */
export default definePuzzle({
  id: 'furnace',
  altar: '6x4',
  board: ['. . . # . .', '. # . . *A .', '. *A . . # .', '# . . . . .'],
  storm: stormAt('W', 0, '6x4'),
  machines: [machineAt('E', 3, '6x4', 8)],
  tray: { channel: 7, bend: 4 },
  insight: 'Amber doubles a bolt: the short road reads half, so bend through one amber.',
  minutes: 2,
  assumes: [gem('bend')],
  essential: ['bend'],
  solution: ['┐ . . # . .', '= # . . *A .', '└ *A = ┐ # .', '# . . └ = ='],
});
