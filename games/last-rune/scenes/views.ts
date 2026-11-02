/**
 * Swap-in points for the art workstreams. Scenes own logic, input and DOM;
 * views own pixels. A view gets the renderer and the shared particle system,
 * and is handed a read-only snapshot each frame.
 *
 * To replace a placeholder, set the factory on `ctx.views` before the scene is
 * entered (e.g. in main.ts):
 *
 *   ctx.views.hall = (vc) => new CathedralHallView(vc);
 */
import type { ParticleSystem } from '@engine/fx';
import type { Frame, Renderer } from '@engine/render';
import type { MachineId } from '../rules/types';
import type { HallModel } from './hall/hall-state';

export interface ViewContext {
  readonly renderer: Renderer;
  /** Shared GPU particle pool (drawn by whoever calls `frame.drawable(particles)`; the views do). */
  readonly particles: ParticleSystem;
  /** Design size of the logical canvas. */
  readonly width: number;
  readonly height: number;
}

export interface ViewFrame {
  /** Seconds since the scene was entered. */
  readonly time: number;
  readonly reducedMotion: boolean;
}

// ─── Hall ────────────────────────────────────────────────────────────────────

export interface HallViewFrame extends ViewFrame {
  readonly model: HallModel;
  /** Alcove under the pointer. */
  readonly hover: MachineId | null;
  /** Alcove with keyboard/pad focus (draw a focus ring). */
  readonly focus: MachineId | null;
}

export interface HallView {
  update(dt: number, s: HallViewFrame): void;
  render(frame: Frame, s: HallViewFrame): void;
  /**
   * A solve just restored `machine` and opened `unlocked`. Optional: play the
   * gem settling into its alcove and the doors' sockets lighting.
   */
  onRestored?(machine: MachineId, unlocked: readonly MachineId[]): void;
  dispose(): void;
}

export type HallViewFactory = (vc: ViewContext) => HallView;

// ─── Title ───────────────────────────────────────────────────────────────────

export interface TitleViewFrame extends ViewFrame {
  /** True once the player has a save (Continue shown). */
  readonly returning: boolean;
}

export interface TitleView {
  update(dt: number, s: TitleViewFrame): void;
  render(frame: Frame, s: TitleViewFrame): void;
  /** The title-knock beat: something hits the gem from inside. Optional. */
  knock?(): void;
  dispose(): void;
}

export type TitleViewFactory = (vc: ViewContext) => TitleView;

export interface ViewFactories {
  hall: HallViewFactory;
  title: TitleViewFactory;
}
