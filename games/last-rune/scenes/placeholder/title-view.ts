/**
 * Placeholder title backdrop (art replaces it through `ctx.views.title`):
 * night stone, a violet storm glow, the Last Rune as a big amethyst gem on a
 * plinth, two candles, rising embers. Title text and buttons are DOM.
 */
import { flicker, ParticleEmitter, pulse } from '@thunderclap-engine/engine/fx';
import type { Frame } from '@thunderclap-engine/engine/render';
import type { TitleView, TitleViewFrame, ViewContext } from '../views';
import { CANDLE, GOLD, Painter, SOCKET_RGBA, STONE } from './shapes';

const GEM_X = 960;
const GEM_Y = 470;
const CANDLES = [
  [380, 900, 170],
  [520, 920, 120],
  [1400, 920, 130],
  [1540, 900, 180],
] as const;

export class PlaceholderTitleView implements TitleView {
  private readonly paint: Painter;
  private readonly embers: ParticleEmitter;
  private knockAt = -10;
  private time = 0;

  constructor(private readonly vc: ViewContext) {
    this.paint = new Painter(vc.renderer);
    this.embers = new ParticleEmitter(
      vc.particles,
      {
        x: 0,
        y: 1080,
        shape: { kind: 'line', dx: vc.width, dy: 0 },
        angle: -Math.PI / 2,
        spread: 0.6,
        speed: [40, 160],
        life: [3, 6],
        size: [3, 0.5],
        colorStart: [2.0, 0.9, 0.35, 1],
        colorEnd: [0.5, 0.2, 0.9, 0],
        gravity: [0, -20],
        drag: 0.2,
        emissive: 1,
      },
      60,
    );
  }

  knock(): void {
    this.knockAt = this.time;
    this.vc.particles.emit(
      {
        x: GEM_X,
        y: GEM_Y,
        shape: { kind: 'circle', radius: 40 },
        speed: [120, 520],
        life: [0.5, 1.2],
        size: [5, 0],
        colorStart: [3, 1.6, 6, 1],
        colorEnd: [0.4, 0.2, 1, 0],
        gravity: [0, 300],
        drag: 1.4,
        emissive: 2,
      },
      400,
    );
  }

  update(dt: number, s: TitleViewFrame): void {
    this.time = s.time;
    this.embers.update(dt);
  }

  render(frame: Frame, s: TitleViewFrame): void {
    const { width: W, height: H } = this.vc;
    const p = this.paint;
    const t = s.reducedMotion ? 0 : s.time;
    const knock = Math.max(0, 1 - (s.time - this.knockAt) / 0.6);
    frame.clear(0, 0, 0, 1);
    p.backdrop(frame, W, H, 1);

    // Plinth.
    p.rect(frame, GEM_X, 860, 520, 60, { color: STONE, radius: 10 });
    p.rect(frame, GEM_X, 760, 300, 160, { color: STONE, radius: 8, k: 0.8 });
    p.rect(frame, GEM_X, 680, 380, 36, { color: STONE, radius: 8, k: 1.1 });
    p.rect(frame, GEM_X, 680, 380, 36, { color: GOLD, radius: 8, outline: 2, alpha: 0.6 });

    // The Last Rune: a big amethyst gem.
    const am = SOCKET_RGBA.amethyst;
    const breathe = 0.6 + 0.4 * pulse(t, { period: 4 });
    const shake = knock > 0 ? Math.sin(s.time * 90) * 6 * knock : 0;
    const bob = Math.sin(t * 0.8) * 6;
    p.glow(frame, GEM_X, GEM_Y, 900, am, 0.25 * breathe + knock, 2, 0.4);
    p.rect(frame, GEM_X + shake, GEM_Y + bob, 210, 210, {
      color: am,
      k: 1.3 + knock * 2,
      radius: 26,
      rotation: Math.PI / 4,
      emissive: 1.2 * breathe + knock * 3,
    });
    p.rect(frame, GEM_X + shake, GEM_Y + bob, 120, 120, {
      color: [1, 0.8, 1, 1],
      k: 1,
      radius: 14,
      rotation: Math.PI / 4,
      alpha: 0.25,
      outline: 4,
    });
    p.rect(frame, GEM_X - 40 + shake, GEM_Y - 40 + bob, 34, 34, {
      color: [1, 1, 1, 1],
      k: 1.6,
      radius: 8,
      rotation: Math.PI / 4,
      alpha: 0.65,
    });

    for (const [x, y, h] of CANDLES) {
      const f = flicker(t, { seed: x, amount: 0.35 });
      p.glow(frame, x, y - h - 20, 360 * f, CANDLE, 0.3 * f, 2.2);
      p.rect(frame, x, y - h / 2, 40, h, { color: [0.85, 0.78, 0.62, 1], k: 0.55, radius: 6 });
      p.ellipse(frame, x, y - h - 18, 18, 40 * (0.9 + 0.2 * f), {
        color: [1, 0.75, 0.4, 1],
        k: 3 * f,
        emissive: 2,
      });
    }
    frame.drawable(this.vc.particles);
  }

  dispose(): void {
    this.paint.shapes.destroy();
    this.paint.glowMat.destroy();
    this.paint.backdropMat.destroy();
  }
}

export const placeholderTitleView = (vc: ViewContext): TitleView => new PlaceholderTitleView(vc);
