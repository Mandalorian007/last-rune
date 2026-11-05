import { describe, expect, it } from 'vitest';
import type { GemKind } from '../rules/types';
import { GEM_WGSL } from '../shaders/gem-wgsl';
import { GEM_CUT, gemCutPoints } from './gem-cut';
import { GEM_INDEX } from './materials/palette';

describe('gem cut outline (held-gem: the held ring follows the gem)', () => {
  const src = GEM_WGSL.slice(GEM_WGSL.indexOf('fn g_cut('), GEM_WGSL.indexOf('struct Facet'));
  it('has the sides the shader cuts for every kind', () => {
    for (const kind of Object.keys(GEM_CUT) as GemKind[]) {
      const i = GEM_INDEX[kind];
      // The branch for this kind: `kind == i` up to the next branch (or the default `else`).
      const at = i === 5 ? src.lastIndexOf('} else {') : src.indexOf(`kind == ${i})`);
      expect(at, kind).toBeGreaterThan(0);
      const branch = src.slice(at, src.indexOf('\n', src.indexOf('\n', at) + 1));
      const sides = Number(/c\.sides = ([\d.]+)/.exec(branch)?.[1]);
      expect(sides, kind).toBe(GEM_CUT[kind].sides);
    }
  });
  it('puts every corner on the gem, and `grow` pushes them out', () => {
    for (const kind of Object.keys(GEM_CUT) as GemKind[]) {
      for (const [x, y] of gemCutPoints(kind)) expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.1);
      const a = gemCutPoints(kind)[0]!;
      const b = gemCutPoints(kind, 0.1)[0]!;
      expect(Math.hypot(...b) - Math.hypot(...a)).toBeCloseTo(0.1, 5);
    }
  });
});
