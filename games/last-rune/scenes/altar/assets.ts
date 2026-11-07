/**
 * GPU assets the altar and solve scenes share, created once per renderer and kept for the
 * session (puzzles open and close often; baking stone and compiling materials each time
 * would hitch). Per-puzzle things (the slab, sized to the board) are cached by shape.
 */
import type { ParticleSystem } from '@thunderclap-engine/engine/fx';
import type { Renderer } from '@thunderclap-engine/engine/render';
import { CandleRenderer } from '../../art/materials/candles';
import { GemRenderer } from '../../art/materials/gems';
import {
  AltarSlab,
  createStoneFloor,
  createStoneWall,
  type StoneSurface,
  solidMask,
} from '../../art/materials/stone';
import { BoltRibbon } from '../../art/props/bolt';
import { Fuse } from '../../art/props/fuse';
import { CircuitOverlay } from './circuit-overlay';

export interface AltarAssets {
  wall: StoneSurface;
  floor: StoneSurface;
  gems: GemRenderer;
  candles: CandleRenderer;
  fuse: Fuse;
  /** Socket veils and carved conduits (altar-clarity). */
  circuit: CircuitOverlay;
  /** One ribbon per strike (grown on demand). */
  bolts: BoltRibbon[];
  /**
   * A slab; `margin` and `front` override the default border and front face, and `solid`
   * cells are carved with no socket and `hug` shapes the slab round the open cells (phones).
   */
  slab(
    cols: number,
    rows: number,
    pitch: number,
    margin?: number,
    front?: number,
    solid?: readonly { x: number; y: number }[],
    hug?: boolean,
  ): AltarSlab;
}

const cache = new WeakMap<Renderer, AltarAssets>();

export function altarAssets(renderer: Renderer, particles: ParticleSystem): AltarAssets {
  const hit = cache.get(renderer);
  if (hit) return hit;
  const slabs = new Map<string, AltarSlab>();
  const bolts: BoltRibbon[] = [];
  const a: AltarAssets = {
    wall: createStoneWall(renderer),
    floor: createStoneFloor(renderer, { height: 300 }),
    gems: new GemRenderer(renderer),
    candles: new CandleRenderer(renderer),
    fuse: new Fuse(renderer, { x: 300, y: 1046, scale: 112 }),
    circuit: new CircuitOverlay(renderer),
    bolts,
    slab(cols, rows, pitch, margin, front, solid, hug) {
      const mask = solid?.length ? solidMask(cols, solid).join('.') : '';
      const key = `${cols}x${rows}@${pitch}/${margin ?? ''}/${front ?? ''}/${mask}/${hug ? 'h' : ''}`;
      let s = slabs.get(key);
      if (!s) {
        // Keep the cache small: boards come in three sizes, pitch varies with props.
        if (slabs.size >= 6) {
          const [k0, s0] = slabs.entries().next().value as [string, AltarSlab];
          s0.destroy();
          slabs.delete(k0);
        }
        s = new AltarSlab(renderer, {
          cols,
          rows,
          pitch,
          margin,
          front,
          solid,
          hug,
          seed: 5 + cols,
        });
        slabs.set(key, s);
      }
      return s;
    },
  };
  // Bolts need the particle system; create two up front (most puzzles strike once or twice).
  for (let i = 0; i < 2; i++) bolts.push(new BoltRibbon(renderer, { particles }));
  cache.set(renderer, a);
  return a;
}

/** Make sure at least `n` ribbons exist. */
export function ensureBolts(
  a: AltarAssets,
  renderer: Renderer,
  particles: ParticleSystem,
  n: number,
): void {
  while (a.bolts.length < n) a.bolts.push(new BoltRibbon(renderer, { particles }));
}
