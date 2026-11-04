import { rng } from '@thunderclap/engine/audio';
import { describe, expect, it } from 'vitest';
import { BANK } from './bank';
import { fuseBlip, fuseModeForTier, newFuseState, vowelFor } from './fuse';
import { resolveSfx, SFX_NAMES } from './index';
import {
  barSeconds,
  eventChance,
  MOOD_IDS,
  MOODS,
  moodFor,
  planBar,
  planTransition,
} from './moods';
import { boltMix, boltStepParams, degreeToSemis, GEM_VOICES, SCALES } from './theory';

describe('theory', () => {
  it('degrees wrap into octaves both ways', () => {
    expect(degreeToSemis(SCALES.majorPent, 0)).toBe(0);
    expect(degreeToSemis(SCALES.majorPent, 5)).toBe(12);
    expect(degreeToSemis(SCALES.majorPent, -1)).toBe(-3);
  });

  it('every gem note sits on D major pentatonic', () => {
    const pent = new Set([2, 4, 6, 9, 11]); // D E F# A B
    for (const v of Object.values(GEM_VOICES))
      for (const n of v.notes) expect(pent.has(n % 12)).toBe(true);
  });

  it('bolt step and mix stay in range for any input', () => {
    for (const c of [0, 0.5, 1, 2, 4, 100, Number.NaN, -3]) {
      const s = boltStepParams(c);
      expect(s.gain).toBeGreaterThan(0);
      expect(s.gain).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.rate)).toBe(true);
    }
    expect(boltStepParams(4).gain).toBeGreaterThan(boltStepParams(1).gain);
    expect(boltMix(0).high).toBeCloseTo(0);
    expect(boltMix(1).high).toBeCloseTo(1);
    expect(boltMix(Number.NaN)).toEqual(boltMix(0));
  });
});

describe('moods', () => {
  it('maps scenes and tiers', () => {
    expect(moodFor('hall', 2)).toBe('hall-t2');
    expect(moodFor('altar', 9)).toBe('altar-t3');
    expect(moodFor('last-rune', 3)).toBe('last-rune');
    for (const id of MOOD_IDS) expect(MOODS[id]).toBeDefined();
  });

  it('the Last Rune has no music', () => {
    const m = MOODS['last-rune'];
    expect(m.seq).toBeUndefined();
    expect(m.layers.every((l) => l.sound.startsWith('amb.'))).toBe(true);
  });

  it('plans transitions that keep shared beds playing', () => {
    const p = planTransition(MOODS['hall-t1'], MOODS['hall-t2']);
    expect(p.start.map((l) => l.sound)).toEqual(['pad.t2']);
    expect(p.stop).toEqual(['pad.t1']);
    expect(p.retune.map((l) => l.sound).sort()).toEqual(['amb.hum', 'amb.storm']);
    expect(planTransition(null, MOODS.title).start).toHaveLength(2);
    expect(planTransition(MOODS.title, MOODS.silence).stop).toHaveLength(2);
  });

  it('generates in-range notes inside the bar, deterministically', () => {
    for (const id of MOOD_IDS) {
      const seq = MOODS[id].seq;
      if (!seq) continue;
      const run = () => {
        const rand = rng(7);
        const state = { last: {} };
        return Array.from({ length: 40 }, () => planBar(seq, rand, state)).flat();
      };
      const notes = run();
      expect(notes).toEqual(run());
      expect(notes.length, id).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.t).toBeGreaterThanOrEqual(0);
        expect(n.t).toBeLessThan(barSeconds(seq));
        expect(n.rate, `${id} ${n.sound}`).toBeGreaterThan(0.45);
        expect(n.rate, `${id} ${n.sound}`).toBeLessThan(2.3);
        expect(Math.abs(n.pan)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('tier 3 is sparser than tier 1', () => {
    const perSecond = (id: 'hall-t1' | 'hall-t3') => {
      const rand = rng(3);
      const state = { last: {} };
      const seq = MOODS[id].seq!;
      const n = Array.from({ length: 200 }, () => planBar(seq, rand, state)).flat().length;
      return n / (200 * barSeconds(seq));
    };
    expect(perSecond('hall-t3')).toBeLessThan(perSecond('hall-t1') / 2);
  });

  it('Poisson event chance', () => {
    expect(eventChance(60, 1)).toBeCloseTo(1 - Math.exp(-1));
    expect(eventChance(0, 1)).toBe(0);
  });
});

describe('FUSE voice', () => {
  it('blips letters, skips spaces and punctuation, and respects spacing', () => {
    const s = newFuseState();
    expect(fuseBlip(' ', 0, 0, 'normal', s)).toBeNull();
    expect(fuseBlip('.', 0, 0, 'normal', s)).toBeNull();
    expect(fuseBlip('a', 0, 1000, 'normal', s)?.sound).toBe('fuse.a');
    expect(fuseBlip('b', 1, 1010, 'normal', s)).toBeNull();
    expect(fuseBlip('b', 1, 1100, 'normal', s)).not.toBeNull();
  });

  it('same letter, same pitch; every blip names a bank sound', () => {
    const text = 'Regulation 12. Someone wrote Regulation 12 while having a day?';
    for (const mode of ['normal', 'quiet'] as const) {
      for (let i = 0; i < text.length; i++) {
        const b = fuseBlip(text[i]!, i, i * 1000, mode, newFuseState(), text);
        if (!b) continue;
        expect(BANK[b.sound], b.sound).toBeDefined();
        expect(b.rate).toBeGreaterThan(0.5);
        expect(b.rate).toBeLessThan(2.5);
        expect(b.gain).toBeGreaterThan(0);
      }
    }
    expect(fuseBlip('k', 0, 0, 'normal', newFuseState())).toEqual(
      fuseBlip('k', 0, 0, 'normal', newFuseState()),
    );
  });

  it('questions rise at the end', () => {
    const at = (t: string) => fuseBlip('t', 4, 0, 'normal', newFuseState(), t)!.rate;
    expect(at('is it?')).toBeGreaterThan(at('is it.'));
  });

  it('quiet uses the quiet bank and is softer; the Last Rune is silent', () => {
    expect(vowelFor('e', 'quiet')).not.toBe('e');
    const q = fuseBlip('a', 0, 0, 'quiet', newFuseState())!;
    const n = fuseBlip('a', 0, 0, 'normal', newFuseState())!;
    expect(q.sound.startsWith('fuse.quiet.')).toBe(true);
    expect(q.gain).toBeLessThan(n.gain);
    expect(fuseBlip('a', 0, 0, fuseModeForTier('last-rune'), newFuseState())).toBeNull();
    expect(fuseModeForTier(1)).toBe('normal');
    expect(fuseModeForTier(3)).toBe('quiet');
  });
});

describe('resolveSfx', () => {
  const fixed = () => 0.5;

  it('every sfx resolves to a bank sound', () => {
    for (const name of SFX_NAMES) {
      const r = resolveSfx(name, { gem: 'split' } as never, fixed);
      expect(BANK[r.key], `${name} → ${r.key}`).toBeDefined();
    }
  });

  it('keys gem sounds per kind and scales bolt steps by charge', () => {
    expect(resolveSfx('gemPlace', { gem: 'amplify' }).key).toBe('gemPlace.amplify');
    const one = resolveSfx('boltStep', { gem: 'bend', charge: 1 }, fixed);
    const four = resolveSfx('boltStep', { gem: 'bend', charge: 4 }, fixed);
    expect(four.gain).toBeGreaterThan(one.gain);
    expect(four.rate).toBeGreaterThan(one.rate);
  });

  it('applies per-call gain and clamps pan', () => {
    const r = resolveSfx('uiClick', { gain: 0.5, pan: 3 }, fixed);
    expect(r.gain).toBeCloseTo(0.5);
    expect(r.pan).toBe(1);
  });
});
