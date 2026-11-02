import { altar8x6, definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/**
 * The storm is in the basement, the lift motor on the roof, and it wants twelve. The shaft's
 * rails are pre-set, so the work is the idea, not the channels: two halves meet at the gate as
 * 4 + 4 = 8 on both strikes until one of them is banked.
 */
export default definePuzzle({
  id: 'lift-shaft',
  altar: '8x6',
  board: [
    '. *= . . *= . # #',
    '*= # # # # *= # #',
    '. # . . # . . #',
    '*= # . . # *= # #',
    '. . *= *= *= . . #',
    '# . # # # # # #',
  ],
  storm: stormAt('S', 1, '8x6', 2),
  machines: [machineAt('N', 3, '8x6', 12)],
  tray: { channel: 5, bend: 5, split: 1, gate: 1, capacitor: 1 },
  pulses: 2,
  insight:
    'Twelve from eight: bank one half, and on the second strike merge the release with the other.',
  minutes: 6,
  assumes: [gem('bend'), gem('split'), gem('gate'), gem('capacitor'), storm2, altar8x6],
  essential: ['split', 'gate', 'capacitor'],
  solution: [
    '┌ *= = G0 *= ┐ # #',
    '*= # # # # *= # #',
    'C # . . # = . #',
    '*= # . . # *= # #',
    '└ S0 *= *= *= ┘ . #',
    '# = # # # # # #',
  ],
});
