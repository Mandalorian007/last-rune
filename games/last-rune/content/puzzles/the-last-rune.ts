import {
  altar8x6,
  altar10x8,
  definePuzzle,
  gem,
  machineAt,
  storm2,
  storm4,
  stormAt,
} from './define';

/**
 * Finale, the only 10×8 puzzle. The rune's frame (its first split, the emerald and the corner
 * amethysts) is carved in place; the player supplies the rest.
 */
export default definePuzzle({
  id: 'the-last-rune',
  altar: '10x8',
  board: [
    '. # # # # # # # # #',
    '*└ . . . . . . *┐ # #',
    '# . . # # . # . # .',
    '. *S # . # . # *G1 . .',
    '# . # . . . . *┘ # .',
    '# *└ . . # . # # # #',
    '# # . . . # # # # #',
    '# # # # . # # # # #',
  ],
  storm: stormAt('W', 3, '10x8', 4),
  machines: [
    machineAt('N', 0, '10x8', 4),
    machineAt('S', 4, '10x8', 2),
    machineAt('E', 3, '10x8', 20),
  ],
  tray: { channel: 15, bend: 2, split: 3, amplify: 1, capacitor: 1 },
  pulses: 2,
  insight:
    'Amplify the bolt you bank: the ice keeps the amber’s work, and the emerald adds it to the rest.',
  minutes: 8,
  assumes: [
    gem('bend'),
    gem('amplify'),
    gem('split'),
    gem('gate'),
    gem('capacitor'),
    storm2,
    storm4,
    altar8x6,
    altar10x8,
  ],
  essential: ['split', 'amplify', 'capacitor'],
  solution: [
    '= # . # . # . # # #',
    '*└ S A = C = = *┐ # #',
    '# = . # # . # = # .',
    '= *S # . # . # *G1 = =',
    '# = # ┌ = = = *┘ # .',
    '# *└ = S # . # . # #',
    '# # . S ┐ # . # # #',
    '# # # . = # # # # #',
  ],
});
