import { altar8x6, definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/**
 * Teaches Capacitor (granted here) with a pre-set one and two strikes. The storm comes up the
 * one lane under the bay and the tray holds a single Bend, so the first try (turn east, straight
 * through the ice) keeps 8, then lets out 16 into a machine needing 8: over. Split where the lane
 * meets the row instead: half goes to the ice, and the spare half is halved again for the small
 * machine (its last quarter fizzles on the stone below).
 */
export default definePuzzle({
  id: 'capacitor-bay',
  altar: '8x6',
  board: [
    '# # # . # # # #',
    '# # # . . # # #',
    '# # # . . *C . .',
    '# # # # . # # #',
    '# # # # . # # #',
    '# # # # . # # #',
  ],
  storm: stormAt('S', 4, '8x6', 2),
  machines: [machineAt('N', 3, '8x6', 2), machineAt('E', 2, '8x6', 8)],
  tray: { channel: 8, bend: 1, split: 2, gate: 1 },
  pulses: 2,
  insight:
    'The ice hands its whole first strike to the second: give it half, and it gives the machine double.',
  minutes: 5,
  assumes: [gem('bend'), gem('split'), gem('gate'), storm2, altar8x6],
  essential: ['split'],
  solution: [
    '# # # = # # # #',
    '# # # = . # # #',
    '# # # S3 S0 *C = =',
    '# # # # = # # #',
    '# # # # = # # #',
    '# # # # = # # #',
  ],
});
