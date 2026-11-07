import { Renderer } from '@thunderclap-engine/engine/render';
import { createFakeDevice, fakeRendererGpu } from '@thunderclap-engine/engine/testing';
import { describe, expect, it } from 'vitest';
import { Fuse } from './fuse';

describe('Fuse.destroy', () => {
  it('frees the material uniform buffer', () => {
    const fake = createFakeDevice();
    const renderer = new Renderer(fakeRendererGpu(fake));
    const before = fake.buffers.length;
    const fuse = new Fuse(renderer, { x: 100, y: 800 });
    const owned = fake.buffers.slice(before);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every((b) => !b.destroyed)).toBe(true);
    fuse.destroy();
    expect(owned.every((b) => b.destroyed)).toBe(true);
  });
});
