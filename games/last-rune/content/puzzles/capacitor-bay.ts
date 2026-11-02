import { altar8x6, definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/**
 * Teaches Capacitor (granted here) with a pre-set one and two strikes. The pre-set ice sits on
 * the straight line to the big machine, so the first try (storm straight through it) reads
 * double on the second strike: over. Halving first fixes it, and the spare half has to be
 * halved again for the small machine.
 */
export default definePuzzle({
  id: 'capacitor-bay',
  altar: '8x6',
  board: [
    '# # # . # # # #',
    '# . . . . # # #',
    '. . . . . *C . .',
    '# . . . . # # #',
    '# # # # # # # #',
    '# # # # # # # #',
  ],
  storm: stormAt('W', 2, '8x6', 2),
  machines: [machineAt('N', 3, '8x6', 2), machineAt('E', 2, '8x6', 8)],
  tray: { channel: 8, bend: 4, split: 2, gate: 1 },
  pulses: 2,
  insight:
    'The ice hands its whole first strike to the second: give it half, and it gives the machine double.',
  minutes: 5,
  assumes: [gem('bend'), gem('split'), gem('gate'), storm2, altar8x6],
  essential: ['split'],
  solution: [
    '# # # = # # # #',
    '# ┌ = S . # # #',
    '= S . . ┌ *C = =',
    '# └ = = ┘ # # #',
    '# # # # # # # #',
    '# # # # # # # #',
  ],
});
