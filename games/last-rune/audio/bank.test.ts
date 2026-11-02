import { validateSpec } from '@engine/audio';
import { describe, expect, it } from 'vitest';
import { GEM_KINDS } from '../rules/types';
import { analyze, problems } from './analyze';
import { BANK, isLoop, renderOrder } from './bank';
import { MOODS } from './moods';
import { postProcess } from './render';

describe('sound bank', () => {
  const entries = Object.entries(BANK);

  it('every spec validates', () => {
    for (const [name, def] of entries) expect([name, validateSpec(def.spec)]).toEqual([name, []]);
  });

  it('has per-gem place and bolt-step sounds', () => {
    for (const g of GEM_KINDS) {
      expect(BANK[`gemPlace.${g}`]).toBeDefined();
      expect(BANK[`boltStep.${g}`]).toBeDefined();
    }
  });

  it('target levels leave headroom (≤ -1 dBFS)', () => {
    for (const [name, def] of entries) {
      expect(def.level, name).toBeGreaterThan(0.05);
      expect(def.level, name).toBeLessThanOrEqual(0.891);
    }
  });

  it('loops only use whole-cycle frequencies and modulation rates', () => {
    for (const [name, def] of entries) {
      if (!isLoop(def)) continue;
      const d = def.spec.duration;
      const whole = (hz: number, what: string) => {
        const cycles = hz * d;
        expect(Math.abs(cycles - Math.round(cycles)), `${name} ${what} ${hz}`).toBeLessThan(1e-6);
      };
      for (const l of def.spec.layers) {
        if (l.source.type === 'osc') {
          whole(l.source.freq, 'freq');
          expect(l.source.freqEnd, `${name} glides`).toBeUndefined();
          if (l.source.vibrato) whole(l.source.vibrato.rate, 'vibrato');
        }
        if (l.tremolo) whole(l.tremolo.rate, 'tremolo');
      }
    }
  });

  it('every mood layer and event refers to a bank sound', () => {
    for (const [id, m] of Object.entries(MOODS)) {
      for (const l of m.layers) {
        expect(BANK[l.sound], `${id} ${l.sound}`).toBeDefined();
        expect(isLoop(BANK[l.sound]!), `${id} ${l.sound} loops`).toBe(true);
      }
      for (const e of m.events)
        for (const s of e.sounds) expect(BANK[s], `${id} ${s}`).toBeDefined();
      for (const v of m.seq?.voices ?? []) expect(BANK[v.sound]).toBeDefined();
    }
  });

  it('render order puts interaction sounds first', () => {
    const order = renderOrder();
    expect(order).toHaveLength(entries.length);
    expect(BANK[order[0]!]!.group).toBe(0);
    expect(order.indexOf('gemPlace.channel')).toBeLessThan(order.indexOf('pad.t1'));
  });
});

describe('postProcess (fake dry render)', () => {
  const SR = 8000;

  it('one-shot: hits its level, rings out, no edge clicks', () => {
    const def = BANK['gemPlace.channel']!;
    const dry = Float32Array.from(
      { length: SR },
      (_, i) => 0.3 * Math.sin((2 * Math.PI * 250 * i) / SR) * Math.exp(-i / (SR * 0.2)),
    );
    const out = postProcess(def, [dry], SR);
    const m = analyze(out, SR);
    expect(m.peak).toBeCloseTo(def.level, 3);
    expect(problems(m, false)).toEqual([]);
  });

  it('loop: stays seamless and keeps its length', () => {
    const def = BANK['pad.t1']!;
    const n = Math.round(def.spec.duration * SR);
    const dry = Float32Array.from(
      { length: n },
      (_, i) => 0.3 * Math.sin((2 * Math.PI * 100 * i) / SR),
    );
    const out = postProcess(def, [dry, dry], SR);
    expect(out[0]).toHaveLength(n);
    expect(problems(analyze(out, SR, true), true)).toEqual([]);
  });
});
