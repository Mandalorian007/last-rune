import { describe, expect, it } from 'vitest';
import { defaultSave, SaveV1 } from './save';
import { resolveReduceFlashes } from './settings';

describe('reduce flashes setting', () => {
  it('auto and missing follow reduced motion; on/off override it', () => {
    expect(resolveReduceFlashes('auto', true)).toBe(true);
    expect(resolveReduceFlashes('auto', false)).toBe(false);
    expect(resolveReduceFlashes(undefined, true)).toBe(true);
    expect(resolveReduceFlashes(undefined, false)).toBe(false);
    expect(resolveReduceFlashes('on', false)).toBe(true);
    expect(resolveReduceFlashes('off', true)).toBe(false);
  });

  it('saves written before the field existed still validate', () => {
    const old = defaultSave();
    delete (old.settings as { reduceFlashes?: unknown }).reduceFlashes;
    expect(SaveV1.validate(old)).toBeNull();
  });

  it('rejects unknown values', () => {
    const bad = defaultSave();
    (bad.settings as { reduceFlashes?: unknown }).reduceFlashes = 'sometimes';
    expect(SaveV1.validate(bad)).not.toBeNull();
  });
});

describe('text size setting', () => {
  it('saves written before the field existed still validate (missing means 100%)', () => {
    const old = defaultSave();
    delete (old.settings as { textScale?: unknown }).textScale;
    expect(SaveV1.validate(old)).toBeNull();
    expect(old.settings.textScale ?? 100).toBe(100);
  });

  it('accepts 100, 125 and 150 only', () => {
    for (const v of [100, 125, 150] as const) {
      const s = defaultSave();
      s.settings.textScale = v;
      expect(SaveV1.validate(s)).toBeNull();
    }
    const bad = defaultSave();
    (bad.settings as { textScale?: unknown }).textScale = 200;
    expect(SaveV1.validate(bad)).not.toBeNull();
  });
});
