import { describe, expect, it } from 'vitest';
import { GEM_KINDS } from '../rules/types';
import {
  CODEX,
  CODEX_CHIP_MAX_CHARS,
  CODEX_MATHS_MAX_CHARS,
  CODEX_RULE_MAX_WORDS,
  CODEX_SPARKS,
  GATE_RULE,
} from './codex';
import { wordCount } from './lines';

describe('codex content', () => {
  it('has an entry for every gem kind, keyed by its own kind', () => {
    for (const gem of GEM_KINDS) {
      expect(CODEX[gem], gem).toBeDefined();
      expect(CODEX[gem].gem).toBe(gem);
    }
    expect(Object.keys(CODEX).sort()).toEqual([...GEM_KINDS].sort());
  });

  it('fits the card limits', () => {
    for (const gem of GEM_KINDS) {
      const e = CODEX[gem];
      expect(wordCount(e.rule), `${gem} rule`).toBeLessThanOrEqual(CODEX_RULE_MAX_WORDS);
      expect(e.rule.length, `${gem} rule`).toBeGreaterThan(0);
      expect(e.maths.length, `${gem} maths`).toBeLessThanOrEqual(CODEX_MATHS_MAX_CHARS);
      expect(e.maths).not.toContain('\n');
      expect(e.chip.length, `${gem} chip`).toBeLessThanOrEqual(CODEX_CHIP_MAX_CHARS);
      expect(e.chip.length, `${gem} chip`).toBeGreaterThan(0);
    }
  });

  it('says "charge", never the untaught bolt, fizzle, stem or arms (mobile-6-moments)', () => {
    const words = /\b(bolts?|fizzl\w*|stem|arms?|joined|sparks?|amber)\b/i;
    expect(CODEX_SPARKS).not.toMatch(words);
    for (const gem of GEM_KINDS) {
      const e = CODEX[gem];
      for (const text of [e.rule, e.chip, e.maths]) expect(text, gem).not.toMatch(words);
    }
  });

  it('counts charge the way the rules do (a 1× storm gives 4)', () => {
    expect(CODEX_SPARKS).toMatch(/charge/);
    expect(CODEX_SPARKS).toContain('4');
    expect(CODEX_SPARKS).toContain('8');
    expect(CODEX_SPARKS).toContain('16');
    expect(CODEX.split.rule).toMatch(/odd/i);
    expect(CODEX.amplify.rule).toMatch(/once per path/i);
    expect(CODEX.gate.rule).toMatch(/same strike/i);
    // teach-7: one sentence everywhere: ports in, the sum out by the arrow, as the gem is drawn.
    expect(CODEX.gate.chip).toBe(GATE_RULE);
    expect(CODEX.gate.rule.startsWith(GATE_RULE)).toBe(true);
    expect(GATE_RULE).toMatch(/Both ports, same strike/);
    expect(GATE_RULE).toMatch(/by the arrow/);
  });

  it('gives every gem a worked example with real numbers (mobile-7-teach)', () => {
    for (const gem of GEM_KINDS) {
      const m = CODEX[gem].maths;
      expect(m, gem).toMatch(/\d → out \d|\d \+ \d → \d/);
      expect(m, gem).toMatch(/\.$/);
    }
    // The numbers are the rules' numbers (rules/sim.ts): a 1× storm's 4 through each gem.
    expect(CODEX.channel.maths).toContain('In 4 → out 4');
    expect(CODEX.bend.maths).toContain('In 4 → out 4');
    expect(CODEX.split.maths).toContain('In 4 → out 2 and 2. Odd charge is lost.');
    expect(CODEX.amplify.maths).toContain('In 4 → out 8');
    expect(CODEX.amplify.maths).toMatch(/8 stays 8/);
    expect(CODEX.gate.maths).toContain('In 4 and 4 → out 8');
    expect(CODEX.gate.maths).toMatch(/only one/i);
    expect(CODEX.capacitor.maths).toBe('Strike 1: stores 4. Strike 2: 4 + 4 → 8.');
    // teach-7: "stores", never "keeps" (blind review 9).
    expect(`${CODEX.capacitor.rule} ${CODEX.capacitor.chip}`).not.toMatch(/\bkeeps?\b/i);
  });
});
