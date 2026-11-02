import { altar8x6, definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/** Two panels on the roof: a small one now, a big one on the second strike. */
export default definePuzzle({
  id: 'roof-array',
  altar: '8x6',
  board: [
    '. # # # . # # #',
    '. . . . . . # #',
    '# . # # # . # #',
    '. . # # # . # #',
    '# . . . . . # #',
    '# # # # # # # #',
  ],
  storm: stormAt('W', 3, '8x6', 2),
  machines: [machineAt('N', 0, '8x6', 2), machineAt('N', 4, '8x6', 10)],
  tray: { channel: 10, bend: 4, split: 2, gate: 1, capacitor: 1 },
  pulses: 2,
  insight:
    'The emerald waits for the ice: alone on the first strike, it adds to the release on the second.',
  minutes: 6,
  assumes: [gem('bend'), gem('split'), gem('gate'), gem('capacitor'), storm2, altar8x6],
  essential: ['split', 'gate', 'capacitor'],
  solution: [
    '= # # # = # # #',
    '└ S0 = = G0 ┐ # #',
    '# = # # # = # #',
    '= S1 # # # = # #',
    '# └ = C = ┘ # #',
    '# # # # # # # #',
  ],
});
