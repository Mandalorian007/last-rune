import { describe, expect, it } from 'vitest';
import { GEM_KINDS } from '../rules/types';
import { CODEX, CODEX_MATHS_MAX_CHARS, CODEX_RULE_MAX_WORDS, CODEX_SPARKS } from './codex';
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
    }
  });

  it('counts charge the way the rules do (1 bolt = 4 sparks)', () => {
    expect(CODEX_SPARKS).toContain('4 sparks');
    expect(CODEX_SPARKS).toContain('8');
    expect(CODEX_SPARKS).toContain('16');
    expect(CODEX.split.maths).toContain('4 → 2 + 2');
    expect(CODEX.split.rule).toMatch(/odd/i);
    expect(CODEX.amplify.maths).toContain('4 → 8');
    expect(CODEX.amplify.rule).toMatch(/once per path/i);
    expect(CODEX.gate.rule).toMatch(/same strike/i);
    expect(CODEX.capacitor.maths).toMatch(/stored \+ in/);
  });
});
