import { altar8x6, definePuzzle, gem, machineAt, storm2, storm4, stormAt } from './define';

/** The 4× storm and every gem. The Capacitor is a red herring: there is only one strike. */
export default definePuzzle({
  id: 'control-booth',
  altar: '8x6',
  board: [
    '# # # . # # # #',
    '# . . . . . . #',
    '. . . . # # . .',
    '# . # . . . . #',
    '# . . . # # # #',
    '# # # . # # # #',
  ],
  storm: stormAt('W', 2, '8x6', 4),
  machines: [machineAt('S', 3, '8x6', 4), machineAt('E', 2, '8x6', 20)],
  tray: { channel: 10, bend: 5, split: 2, amplify: 1, gate: 1, capacitor: 1 },
  insight: 'Twenty from sixteen: amplify one half, split the other, and merge.',
  minutes: 7,
  assumes: [
    gem('bend'),
    gem('amplify'),
    gem('split'),
    gem('gate'),
    gem('capacitor'),
    storm2,
    storm4,
    altar8x6,
  ],
  essential: ['split', 'amplify', 'gate'],
  solution: [
    '# # # . # # # #',
    '# ┌ A = = = ┐ #',
    '= S . . # # G1 =',
    '# = # ┌ = = ┘ #',
    '# └ = S # # # #',
    '# # # = # # # #',
  ],
});
