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
 * Finale, the only 10×8 puzzle. The rune's frame (its first split, the emerald, the corner
 * amethysts and the rails of both arms) is carved in place; the player supplies the rest.
 * Twenty is 16 + 4 on the second strike: the two open sockets on the upper arm must hold the
 * amber and the ice together (either order). Everything else is forced, so the space is tight
 * (4 solutions: amber/ice order × how the last half reaches the small machine).
 */
export default definePuzzle({
  id: 'the-last-rune',
  altar: '10x8',
  board: [
    '. # # # # # # # # #',
    '*└ . . . *= *= *= *┐ # #',
    '# . . # # . # *= # .',
    '. *S # . # . # *G1 . .',
    '# . # . *= *= *= *┘ # .',
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
  tray: { channel: 9, bend: 3, split: 3, amplify: 1, capacitor: 1 },
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
    '*└ S A C *= *= *= *┐ # #',
    '# = . # # . # *= # .',
    '= *S # . # . # *G1 = =',
    '# = # ┌ *= *= *= *┘ # .',
    '# *└ = S # . # . # #',
    '# # . S ┐ # . # # #',
    '# # # . = # # # # #',
  ],
});
