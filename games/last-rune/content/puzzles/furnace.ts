import { definePuzzle, gem, machineAt, stormAt } from './define';

/** Teaches Amplify (granted here) with two pre-set ambers: once per path. */
export default definePuzzle({
  id: 'furnace',
  altar: '6x4',
  board: ['. . . # . .', '. # . . . .', '. . *A . # .', '# . . . *A .'],
  storm: stormAt('W', 0, '6x4'),
  machines: [machineAt('E', 3, '6x4', 8)],
  tray: { channel: 6, bend: 4 },
  insight: 'Amber doubles a bolt once. A second amber on the same path does nothing.',
  minutes: 2,
  assumes: [gem('bend')],
  essential: ['bend'],
  solution: ['= = ┐ # . .', '. # = . . .', '. . *A . # .', '# . └ = *A ='],
});
