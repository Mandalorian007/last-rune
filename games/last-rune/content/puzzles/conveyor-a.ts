import { definePuzzle, gem, machineAt, stormAt } from './define';

/** A stuck amber right at the storm: too much charge unless something halves it. */
export default definePuzzle({
  id: 'conveyor-a',
  altar: '6x4',
  board: ['. . . . . .', '*A . . . . .', '. . . *S2 . .', '. . . . . .'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('E', 3, '6x4', 4)],
  tray: { channel: 8, bend: 4 },
  insight: 'The stuck amber doubles the charge; route it through the old magenta to halve it again.',
  minutes: 2,
  assumes: [gem('bend')],
  essential: ['bend'],
  solution: ['. . . . . .', '*A = = ┐ . .', '. . . *S2 = ┐', '. . . . . └'],
});
