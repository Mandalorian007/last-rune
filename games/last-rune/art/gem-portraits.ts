/**
 * Gem portraits for the Codex: each gem drawn by the real altar gem material
 * (`shaders/gem-wgsl.ts`, same cut, colour and glyph, rotation 0 as in rules.md §4) on dark
 * stone, with the altar's bloom. Baked once into a sheet on a `SnapshotRenderer` that shares
 * the game's GPU device, then copied into a small 2D canvas per Codex page.
 *
 * ```ts
 * const portraits = createGemPortraits(renderer);
 * page.append(portraits.canvas('split', 200)); // a fresh <canvas>, 200 CSS px square
 * ```
 */
import { PostStack } from '@thunderclap-engine/engine/post';
import { type Renderer, SnapshotRenderer } from '@thunderclap-engine/engine/render';
import { GEM_KINDS, type GemKind } from '../rules/types';
import { addGemLight, type GemInstance, GemRenderer } from './materials/gems';
import { LIGHT_HEIGHT, LightSet } from './materials/lights';
import { pitch } from './props/palette';

/** Pixel size of one portrait cell in the sheet. */
export const PORTRAIT_PX = 384;
/** Gem diameter inside a cell, as a fraction of the cell. */
const GEM_FRACTION = 0.5;
/** Stone behind the gem (linear rgb). Matches the Codex plate's CSS colour. */
const STONE: readonly [number, number, number] = [0.018, 0.02, 0.028];

export interface GemPortraits {
  /** A new canvas showing `gem`, `cssPx` square. Null if the GPU could not draw it. */
  canvas(gem: GemKind, cssPx: number): HTMLCanvasElement | null;
  destroy(): void;
}

export function createGemPortraits(main: Renderer): GemPortraits {
  let sheet: ImageBitmap | null = null;
  let failed = false;

  const bake = (): ImageBitmap | null => {
    if (sheet || failed) return sheet;
    try {
      const n = GEM_KINDS.length;
      const shot = new SnapshotRenderer(main.device, main.format, {
        width: PORTRAIT_PX * n,
        height: PORTRAIT_PX,
      });
      const r = shot.renderer;
      // The altar's bloom and grade, without its room effects (mist, rays, vignette).
      r.post = new PostStack(r, {
        bloom: { enabled: true, intensity: 0.85, threshold: 1.4, scatter: 0.7, emissiveWeight: 1 },
        mist: { enabled: false },
        godRays: { enabled: false },
        vignette: { enabled: false },
        grade: {
          enabled: true,
          exposure: 1,
          saturation: 1.15,
          contrast: 1.05,
          lift: [0.002, 0.003, 0.01],
          gamma: [1, 1, 1],
          gain: [1.02, 1, 0.98],
        },
      });
      const gems = new GemRenderer(r);
      const lights = new LightSet();
      const list: GemInstance[] = GEM_KINDS.map((kind, i) => ({
        kind,
        x: PORTRAIT_PX * (i + 0.5),
        y: PORTRAIT_PX * 0.5,
        size: PORTRAIT_PX * GEM_FRACTION,
        state: 'placed',
        rot: 0,
        seed: i * 0.37 + 0.11,
      }));
      lights.begin(0.075, 0.078, 0.105, 0, 1);
      for (const g of list) {
        // A warm candle up and to the left of each gem (as on the altar), plus its own glow.
        lights.add(
          g.x - PORTRAIT_PX * 0.45,
          g.y - PORTRAIT_PX * 0.5,
          PORTRAIT_PX * 0.9,
          pitch('warm'),
          1.1,
          LIGHT_HEIGHT.candle,
        );
        addGemLight(lights, g, 0.8);
      }
      gems.light(lights);
      sheet = shot.capture((frame) => {
        frame.clear(STONE[0], STONE[1], STONE[2]);
        gems.drawUnder(frame, list);
        gems.drawGems(frame, list);
      }, 1.5);
      gems.destroy();
      shot.destroy();
    } catch (e) {
      console.warn('gem portraits unavailable:', e);
      failed = true;
    }
    return sheet;
  };

  return {
    canvas(gem, cssPx) {
      const src = bake();
      if (!src) return null;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const px = Math.min(PORTRAIT_PX, Math.round(cssPx * dpr));
      const c = document.createElement('canvas');
      c.width = px;
      c.height = px;
      const g = c.getContext('2d');
      if (!g) return null;
      g.imageSmoothingQuality = 'high';
      const i = GEM_KINDS.indexOf(gem);
      g.drawImage(src, i * PORTRAIT_PX, 0, PORTRAIT_PX, PORTRAIT_PX, 0, 0, px, px);
      return c;
    },
    destroy() {
      sheet?.close();
      sheet = null;
    },
  };
}
