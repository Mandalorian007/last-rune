import { describe, expect, it } from 'vitest';
import { toTextScale } from './text-scale';

// The scaling maths is the engine's (thunderclap-engine/packages/engine/src/ui/text-scale.test.ts).
describe('text size setting', () => {
  it('unknown saved values mean 100%', () => {
    expect(toTextScale(125)).toBe(125);
    expect(toTextScale(undefined)).toBe(100);
    expect(toTextScale(110)).toBe(100);
    expect(toTextScale('150')).toBe(100);
  });
});
