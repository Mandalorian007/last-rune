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
