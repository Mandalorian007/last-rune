import { definePuzzle, machineAt, stormAt } from './define';

/** Tutorial. Channel only; the pre-set amethyst does the turning. */
export default definePuzzle({
  id: 'intake-desk',
  altar: '6x4',
  board: ['. . . . . .', '. . . *┐ . .', '. . . . . .', '. . . . . .'],
  storm: stormAt('W', 1, '6x4'),
  machines: [machineAt('S', 3, '6x4')],
  tray: { channel: 6 },
  insight: 'Channels carry the charge straight; the pre-set amethyst turns it.',
  minutes: 1,
  assumes: [],
  essential: ['channel'],
  solution: ['. . . . . .', '= = = *┐ . .', '. . . = . .', '. . . = . .'],
});
