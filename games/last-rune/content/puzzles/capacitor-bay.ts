import { definePuzzle, gem, machineAt, storm2, stormAt } from './define';

/** Teaches Capacitor (granted here) with a pre-set one and two strikes. */
export default definePuzzle({
  id: 'capacitor-bay',
  altar: '6x4',
  board: ['# # . # # #', '. . . . . #', '# . . . *C .', '# # . . . #'],
  storm: stormAt('W', 1, '6x4', 2),
  machines: [machineAt('N', 2, '6x4', 4), machineAt('E', 2, '6x4', 8)],
  tray: { channel: 5, bend: 3, split: 1, gate: 1 },
  pulses: 2,
  insight: 'The ice keeps a half from the first strike and adds it to the second.',
  minutes: 4,
  assumes: [gem('bend'), gem('split'), gem('gate'), storm2],
  essential: ['split'],
  solution: ['# # = # # #', '= = S . . #', '# . └ = *C =', '# # . . . #'],
});
