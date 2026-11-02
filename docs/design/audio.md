# Audio: sonic identity and mix plan

Every sound is synthesised in the browser (D-001). Nothing is fetched or decoded. The bank is in
`games/last-rune/audio/`. You can audition it at `?demo=audio` (dev only), and `pnpm audio:check`
verifies it.

## Identity

**A lightning factory inside stone halls.** The building is old, cold and huge, and it hums. The
storm is always overhead. The player's hands make glass sounds, and the machines answer with
electricity and brass.

- **The key is D.** The factory hum is a D (36.75 Hz sub, with its harmonics). Every gem rings on
  the D major pentatonic (D E F# A B), so the bolt can pass through gems in any order and the
  result is still consonant. A solved machine plays a small tune you built. The music never
  changes key. Tiers change the *mode* instead.
- **Gems are glass bells.** Each kind has its own note and its own timbre family. The family says
  something about the gem's rule:

  | Gem | Note(s) | Family | What you hear |
  |---|---|---|---|
  | Channel | A5 | clear | near-harmonic, pure, carries straight through |
  | Bend | F#5 | bent | glassy partials that bend up into the note |
  | Split | D6 + A5 | split | two bells a fifth apart, panned apart |
  | Amplify | D5 + D4 | doubled | warm bell doubled an octave below |
  | Gate | E5, B5 | twin | two quick strikes, as if it needs both |
  | Capacitor | A6 + E7 | stored | soft swelling attack, highest note, longest ring |

  Placing a gem plays the bell plus a stone seat thud. When the bolt steps through a gem it plays
  the same bell an octave up, short, with a spark. The step gets louder and a touch higher as
  charge rises (`boltStepParams`), saturating so that 4× is not deafening.
- **Lightning has weight.** The bolt loop has two layers: a low hum-and-crackle bed and a dense
  high sizzle. An equal-power `intensity` control crossfades between them. Storm cells hum at 1×,
  2× and 4×. Each strength adds a harmonic and makes the crackle denser, with tremolo locked to
  the loop. The solve fanfare opens with a real thunder crack, then the machine spins up on D and
  a stack of gem bells climbs the pentatonic.
- **FUSE is a brass reed with a servo.** He speaks in blips, one per typed character of a caption.
  Each blip goes through vowel formants (a e i o u) on a warm buzzy reed at G3, which sits below
  the gems. A hash of the letter picks the pitch on the pentatonic, so a word always sounds the
  same. A sentence drifts down about 2 semitones, a question lifts its last words, capitals
  push a little, and digits sit higher (he likes numbers). His "bzzt" is a buzz followed by a
  proud servo whirr.
- **Stone and paper are the warm room.** The codex, journal and UI live in a small, close room
  with little reverb: a leather creak, riffled pages, a parchment flutter, and a stone tick with a
  glint of glass for clicks.

### Rooms (game-side reverb)

The engine has no reverb, so the game renders it offline. `post.ts` is a pure Freeverb that is
loop-aware: on a loop it runs two periods and keeps the second, so the tail wraps seamlessly.

| Room | Used for | Character |
|---|---|---|
| `hall` | door, gem granted, page found | long, cool, a little dark |
| `altar` | machine sounds, socket, solve | closer walls |
| `small` | gem pick/place/rotate, UI, codex | a small warm room |
| `music` | pads, notes, thunder, drips | big and soft |

## Tier arc (music and FUSE)

| | Mode | Music | FUSE |
|---|---|---|---|
| Title | major pent | soft open pad, a few glass notes, storm, distant knocks | - |
| Tier 1 | major pentatonic | bright pad with shimmer, bouncy music box, 92 bpm, the most notes | `normal`: chatty |
| Tier 2 | mixolydian | the flat 7th creeps into the pad (C natural), fewer notes, more thunder | `normal` |
| Tier 3 | dorian | dark low pad, sparse low mallet, long rests, storm louder | `quiet`: lower, softer, faster |
| Last Rune | none | **no music**: the storm, the hum and the player | `silent` until the last line |
| Ending | major | gold pad, warm horn-ish notes, the ending swell | `quiet` (soft, intimate) |

The generative bed (`moods.ts`) runs one bar at a time on an eighth-note grid. Downbeats are more
likely than offbeats, the melody moves mostly by step inside each voice's range, and whole bars
rest now and then. Tier 3 plays less than half as many notes per second as tier 1 (there is a
unit test for this). All note samples are Ds, and the sequencer pitches them by playback rate.

## Mix plan per scene

Bus defaults (engine): master 0.8, music 0.7, sfx 0.9, ui 0.8. Every rendered sound peaks at or
below -1.5 dBFS on its own. Gem bells and the bolt own the foreground, and the bed stays well
under them. The table gives layer gains inside the music bus.

| Mood (`setMood`) | Loops | Notes | Events |
|---|---|---|---|
| `title` | storm .7, pad.title .55 | glass, sparse | far thunder 1.5/min |
| `hall-t1` | storm .55, hum .32, pad.t1 .45 | box, glass, low | drips 7/min, thunder 1.2/min |
| `hall-t2` | storm .55, hum .32, pad.t2 .45 | glass, box, low (thinner) | drips, thunder 1.8/min |
| `hall-t3` | storm .7, hum .38, pad.t3 .5 | low, glass (sparse) | drips 4/min, thunder 2.5/min |
| `altar-t1..3` | storm drops to .3-.45, hum comes up to .4-.45, pad ~.32 | very sparse or none | fewer |
| `codex` | hum .25, pad.journal .3 | none | none |
| `journal` | candle .7, storm .18, pad.journal .4 | warm, very sparse | none |
| `last-rune` | storm .85, hum .45 | **none** | thunder 3/min |
| `ending` | pad.ending .6, storm .15 | warm, glass, low | none |

- Moving between moods keeps shared beds playing and only re-gains them. For example, the storm
  doesn't restart between the hall and the altar.
- **The solve moment** (`machineExact`): call `music.duck(0.35, 3)` so the fanfare reads. With
  the bolt at full intensity, a 4× cell, six gem places, four 4× bolt steps and the fanfare over
  `altar-t3`, the master measured -3.7 dBFS peak in Chromium.
- **Breaker trip** is the loudest single sound (-1.5 dBFS). It is rounded off with saturation, so
  it is loud without being harsh.
- **FUSE** is on the sfx bus at about -7.5 dBFS per blip, so he sits above the bed and under gem
  bells.

## Using it (game code)

```ts
import { createGameAudio, moodFor, fuseModeForTier } from '@game/audio';

const audio = createGameAudio(engine);                  // define only: renders on first unlock
audio.sfx.play('gemPlace', { gem: 'split' });
audio.sfx.play('boltStep', { gem: 'amplify', charge: 4 });
const bolt = audio.sfx.bolt(0.2);  bolt.setIntensity(charge / max);  bolt.stop();
const cell = audio.sfx.stormCell(2);  cell.setStrength(4);  cell.stop();
audio.music.setMood(moodFor('hall', tier));             // crossfades
audio.music.duck(0.35, 3);                              // under the solve fanfare
ui.caption.say(line, { speaker: 'FUSE', onChar: audio.fuse.onChar(fuseModeForTier(tier), line) });
```

## Verification

- `pnpm test`: pure DSP and logic (reverb tail and loop wrap, edge fades, the analyser itself,
  every spec validates, loops use whole-cycle frequencies, gems sit on the pentatonic, the
  sequencer stays in range and tier 3 is sparser, the FUSE voice, sfx resolution).
- `pnpm audio:check`: renders every sound in headless Chromium and checks peak ≤ -1 dBFS, NaN, DC,
  start and end samples of one-shots (no clicks), cut-off tails, and loop seams (wrap jump
  against local slope, and level jump against the material's own variation). It then opens
  `?demo=audio`, unlocks audio, times the real pre-render and reads a master peak meter through
  three scenes. `--out <dir>` writes a WAV per sound for listening.
