/**
 * Placeholder hall (art-props/art-materials replace it through `ctx.views.hall`).
 * Flat SDF shapes over a procedural stone backdrop: enough to read every state
 * from pitch screen 2 (solved gem, unlocked gold glow + empty socket in the
 * grant colour, locked padlock + dotted sockets in the needed colours, conduits).
 */
import { flicker, ParticleEmitter, pulse } from '@thunderclap-engine/engine/fx';
import type { Frame } from '@thunderclap-engine/engine/render';
import type { MachineId } from '../../rules/types';
import { ALCOVE_HIT, type AlcoveModel, type ConduitModel } from '../hall/hall-state';
import type { HallView, HallViewFrame, ViewContext } from '../views';
import { CANDLE, GOLD, Painter, SOCKET_RGBA, STONE, STONE_DARK } from './shapes';

const CYAN = SOCKET_RGBA.cyan;
const HORIZON = 250;
const IRON: readonly number[] = [0.32, 0.33, 0.36, 1];
const BLACK: readonly number[] = [0, 0, 0, 1];
const BRAZIERS = [
  [110, 1010],
  [1810, 1010],
  [700, 470],
  [1220, 470],
] as const;

export class PlaceholderHallView implements HallView {
  private readonly paint: Painter;
  private readonly embers: ParticleEmitter[] = [];
  /** Seconds since each machine was restored in this visit (for a flash). */
  private readonly restoredAt = new Map<MachineId, number>();
  private time = 0;

  constructor(private readonly vc: ViewContext) {
    this.paint = new Painter(vc.renderer);
    for (const [x, y] of BRAZIERS) {
      this.embers.push(
        new ParticleEmitter(
          vc.particles,
          {
            x,
            y: y - 40,
            shape: { kind: 'circle', radius: 14 },
            angle: -Math.PI / 2,
            spread: 0.8,
            speed: [30, 90],
            life: [0.8, 1.8],
            size: [4, 0],
            colorStart: [3.2, 1.6, 0.5, 1],
            colorEnd: [0.6, 0.15, 0.05, 0],
            gravity: [0, -50],
            drag: 0.6,
            emissive: 1.4,
          },
          18,
        ),
      );
    }
  }

  update(dt: number, s: HallViewFrame): void {
    this.time = s.time;
    for (const e of this.embers) e.update(dt);
  }

  onRestored(machine: MachineId): void {
    this.restoredAt.set(machine, this.time);
  }

  render(frame: Frame, s: HallViewFrame): void {
    const { width: W, height: H } = this.vc;
    const p = this.paint;
    const t = s.reducedMotion ? 0 : s.time;
    frame.clear(0, 0, 0, 1);
    p.backdrop(frame, W, H, 0, HORIZON);
    // Skirting shadow where wall meets floor.
    p.rect(frame, W / 2, HORIZON + 8, W, 22, { color: BLACK, alpha: 0.55 });

    for (const [x, y] of BRAZIERS) this.brazier(frame, x, y, t);

    for (const c of s.model.conduits) this.conduit(frame, c, s, t);
    for (const a of s.model.alcoves) {
      this.alcove(frame, a, a.id === s.hover, a.id === s.focus, t);
    }
    frame.drawable(this.vc.particles);
  }

  dispose(): void {
    this.paint.shapes.destroy();
    this.paint.glowMat.destroy();
    this.paint.backdropMat.destroy();
  }

  // ── pieces ────────────────────────────────────────────────────────────────

  private brazier(frame: Frame, x: number, y: number, t: number): void {
    const p = this.paint;
    const f = flicker(t, { seed: x, amount: 0.3 });
    p.glow(frame, x, y - 50, 420 * f, CANDLE, 0.22 * f, 2.2);
    p.rect(frame, x, y - 10, 70, 40, { color: IRON, radius: 8 });
    p.ellipse(frame, x, y - 34, 80, 22, { color: [0.15, 0.15, 0.17, 1] });
    p.glow(frame, x, y - 50, 70, [1, 0.7, 0.35, 1], 2.5 * f, 3, 1.5);
  }

  private conduit(frame: Frame, c: ConduitModel, s: HallViewFrame, t: number): void {
    const p = this.paint;
    // L-route along the floor: out of the source vertically, then across.
    const midY = c.y1;
    const bothLit = c.lit && s.model.alcoves.some((a) => a.id === c.to && a.status === 'solved');
    const colour = bothLit ? CYAN : c.lit ? SOCKET_RGBA[c.colour] : SOCKET_RGBA.slate;
    const k = bothLit ? 1.6 + 0.4 * pulse(t, { period: 2.4 }) : c.lit ? 0.8 : 0.35;
    const alpha = bothLit ? 0.9 : c.lit ? 0.7 : 0.35;
    const width = bothLit ? 7 : 5;
    const em = bothLit ? 1.2 : c.lit ? 0.4 : 0;
    p.line(frame, c.x0, c.y0, c.x0, midY, width, { color: colour, k, alpha, emissive: em });
    p.line(frame, c.x0, midY, c.x1, midY, width, { color: colour, k, alpha, emissive: em });
  }

  private alcove(frame: Frame, a: AlcoveModel, hover: boolean, focus: boolean, t: number): void {
    if (a.floor) {
      this.floorRune(frame, a, hover || focus, t);
      return;
    }
    const p = this.paint;
    const w = ALCOVE_HIT.w - 30;
    const h = ALCOVE_HIT.h - 20;
    const hi = hover || focus;
    const since = this.restoredAt.get(a.id);
    const flash = since === undefined ? 0 : Math.max(0, 1 - (this.time - since) / 1.5);

    if (a.status === 'unlocked') {
      const g = 0.35 + 0.25 * pulse(t, { period: 2.2, phase: a.x * 0.01 });
      p.glow(frame, a.x, a.y, w * 2.2, GOLD, g * (hi ? 1.6 : 1), 2.4, 0.6);
    }
    if (a.status === 'solved' && a.grantColour) {
      p.glow(frame, a.x, a.y, w * 1.8, SOCKET_RGBA[a.grantColour], 0.25 + flash, 2.6, 0.5);
    }
    // Stone arch frame + dark niche.
    const frameCol = a.status === 'locked' ? STONE_DARK : STONE;
    p.rect(frame, a.x, a.y + 6, w + 14, h + 14, { color: BLACK, alpha: 0.5, radius: 26 });
    p.rect(frame, a.x, a.y, w, h, { color: frameCol, radius: 22 });
    p.rect(frame, a.x, a.y + 8, w - 40, h - 36, { color: [0.03, 0.03, 0.045, 1], radius: 40 });
    const edge =
      a.status === 'unlocked'
        ? GOLD
        : a.status === 'solved'
          ? a.grantColour
            ? SOCKET_RGBA[a.grantColour]
            : GOLD
          : SOCKET_RGBA.slate;
    p.rect(frame, a.x, a.y, w, h, {
      color: edge,
      radius: 22,
      outline: hi ? 5 : 3,
      k: hi ? 1.8 : a.status === 'locked' ? 0.6 : 1,
      emissive: hi ? 0.8 : 0,
    });
    if (focus) {
      p.rect(frame, a.x, a.y, w + 22, h + 22, {
        color: [1, 1, 1, 1],
        radius: 30,
        outline: 3,
        dashes: 0,
        alpha: 0.9,
      });
    }

    if (a.status === 'solved') this.gem(frame, a, t, flash);
    else if (a.status === 'unlocked') this.emptySocket(frame, a, t);
    else this.locked(frame, a, t);
  }

  private gem(frame: Frame, a: AlcoveModel, t: number, flash: number): void {
    const p = this.paint;
    const c = a.grantColour ? SOCKET_RGBA[a.grantColour] : GOLD;
    const bob = Math.sin(t * 1.4 + a.x) * 3;
    p.glow(frame, a.x, a.y + 8 + bob, 120, c, 0.8 + flash * 2, 2.4, 1.5);
    p.rect(frame, a.x, a.y + 8 + bob, 46, 46, {
      color: c,
      k: 1.4,
      radius: 8,
      rotation: Math.PI / 4,
      emissive: 1.4 + flash * 3,
    });
    p.rect(frame, a.x - 6, a.y + 2 + bob, 14, 14, {
      color: [1, 1, 1, 1],
      k: 1.5,
      radius: 4,
      rotation: Math.PI / 4,
      alpha: 0.7,
    });
  }

  private emptySocket(frame: Frame, a: AlcoveModel, t: number): void {
    const p = this.paint;
    const c = a.grantColour ? SOCKET_RGBA[a.grantColour] : GOLD;
    const k = 0.9 + 0.4 * pulse(t, { period: 1.8, phase: a.y * 0.01 });
    p.disc(frame, a.x, a.y + 8, 64, { color: [0.02, 0.02, 0.03, 1] });
    p.disc(frame, a.x, a.y + 8, 64, { color: c, outline: 5, k, emissive: 0.6 });
  }

  private locked(frame: Frame, a: AlcoveModel, t: number): void {
    const p = this.paint;
    // Sockets in the colours still needed, along the arch's foot.
    const n = a.missing.length;
    const gap = 46;
    const x0 = a.x - ((n - 1) * gap) / 2;
    a.missing.forEach((sock, i) => {
      const x = x0 + i * gap;
      const y = a.y + ALCOVE_HIT.h / 2 - 34;
      const c = SOCKET_RGBA[sock.colour];
      for (let r = 0; r < sock.rings; r++) {
        p.disc(frame, x, y, 34 - r * 10, { color: c, outline: 3, dashes: 6, k: 0.8, alpha: 0.9 });
      }
    });
    // Control booth: a lamp per machine still dark.
    if (a.missingMachines > 0) {
      const total = 14;
      const lit = total - a.missingMachines;
      for (let i = 0; i < total; i++) {
        const x = a.x - 78 + (i % 7) * 26;
        const y = a.y - 50 + Math.floor(i / 7) * 20;
        const on = i < lit;
        p.disc(frame, x, y, 12, {
          color: on ? CYAN : SOCKET_RGBA.slate,
          k: on ? 1.6 : 0.5,
          emissive: on ? 1 : 0,
        });
      }
    }
    // Padlock.
    const wob = Math.sin(t * 0.7 + a.x) * 0.03;
    p.disc(frame, a.x, a.y - 4, 40, { color: IRON, outline: 7, rotation: wob });
    p.rect(frame, a.x, a.y + 14, 48, 38, {
      color: [0.62, 0.48, 0.22, 1],
      radius: 6,
      rotation: wob,
    });
    p.disc(frame, a.x, a.y + 12, 9, { color: BLACK });
  }

  private floorRune(frame: Frame, a: AlcoveModel, hi: boolean, t: number): void {
    const p = this.paint;
    const d = ALCOVE_HIT.h * 1.2;
    const open = a.status !== 'locked';
    p.disc(frame, a.x, a.y, d + 20, { color: BLACK, alpha: 0.5 });
    p.disc(frame, a.x, a.y, d, { color: STONE_DARK });
    p.disc(frame, a.x, a.y, d, {
      color: open ? GOLD : SOCKET_RGBA.slate,
      outline: hi ? 6 : 4,
      k: hi ? 1.6 : 0.8,
    });
    p.disc(frame, a.x, a.y, d * 0.72, {
      color: open ? GOLD : SOCKET_RGBA.amethyst,
      outline: 3,
      dashes: 12,
      k: open ? 1.4 : 0.5,
      rotation: t * 0.1,
    });
    const k = 0.2 + 0.1 * pulse(t, { period: 4 });
    p.glow(
      frame,
      a.x,
      a.y,
      d * 1.8,
      open ? GOLD : SOCKET_RGBA.amethyst,
      k * (hi ? 2 : 1),
      2.2,
      0.4,
    );
    // Six missing sockets ring the disc in their colours.
    a.missing.forEach((sock, i) => {
      const ang = -Math.PI / 2 + (i / Math.max(1, a.missing.length)) * Math.PI * 2;
      const x = a.x + Math.cos(ang) * d * 0.36;
      const y = a.y + Math.sin(ang) * d * 0.36;
      p.disc(frame, x, y, 22, { color: SOCKET_RGBA[sock.colour], outline: 3, dashes: 5, k: 0.9 });
    });
  }
}

export const placeholderHallView = (vc: ViewContext): HallView => new PlaceholderHallView(vc);
