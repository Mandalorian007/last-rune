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
import type { ParticleSystem } from '@thunderclap/engine/fx';
import type { Frame, Renderer } from '@thunderclap/engine/render';
import type { MachineId } from '../rules/types';
import type { HallFrame } from './hall/hall-frame';
import type { HallModel } from './hall/hall-state';

export interface ViewContext {
  readonly renderer: Renderer;
  /** Shared GPU particle pool (drawn by whoever calls `frame.drawable(particles)`; the views do). */
  readonly particles: ParticleSystem;
  /** Design size of the logical canvas. */
  readonly width: number;
  readonly height: number;
  /**
   * Optional sound cues for moments the view owns (a lightning flash it drew, a door it opened).
   * Wired to the game sound bank in game/ctx.ts; views must work without it.
   */
  readonly cue?: (name: ViewCue) => void;
  /** True on a phone-sized screen (mobile-3-chrome): views may drop detail that reads as noise there. */
  readonly phone?: () => boolean;
}

/** Sounds a view can ask for, timed to its own pixels. */
export type ViewCue = 'thunder' | 'thunderNear' | 'doorUnlock';

/** Where FUSE stands in a view's own coordinates: his wheels' centre (x, y) and his height. */
export interface FuseSpot {
  readonly x: number;
  readonly y: number;
  readonly h: number;
}

export interface ViewFrame {
  /** Seconds since the scene was entered. */
  readonly time: number;
  readonly reducedMotion: boolean;
  /** Photosensitivity setting: no sudden full-frame brightness changes, no strobing. */
  readonly reduceFlashes?: boolean;
  /** FUSE's caption is typing a line (animate his mouth / portrait). */
  readonly speaking?: boolean;
}

// ─── Hall ────────────────────────────────────────────────────────────────────

export interface HallViewFrame extends ViewFrame {
  readonly model: HallModel;
  /** Alcove under the pointer. */
  readonly hover: MachineId | null;
  /** Alcove with keyboard/pad focus (draw a focus ring). */
  readonly focus: MachineId | null;
  /**
   * Phones (mobile-5-chrome): the hall zoomed out with its wings widened (`hall-frame.ts`). The
   * model's doors are already spread; the view spreads its props and widens its wall to match.
   * Absent: the design as laid out.
   */
  readonly layout?: HallFrame;
}

export interface HallView {
  update(dt: number, s: HallViewFrame): void;
  render(frame: Frame, s: HallViewFrame): void;
  /**
   * A solve just restored `machine` and opened `unlocked`. Optional: play the
   * gem settling into its alcove and the doors' sockets lighting.
   */
  onRestored?(machine: MachineId, unlocked: readonly MachineId[]): void;
  /** Where FUSE is (world px), so his speech card can point at him (mobile-7-hall). Optional. */
  fuseAt?(): FuseSpot | null;
  dispose(): void;
}

export type HallViewFactory = (vc: ViewContext) => HallView;

// ─── Title ───────────────────────────────────────────────────────────────────

export interface TitleViewFrame extends ViewFrame {
  /** True once the player has a save (Continue shown). */
  readonly returning: boolean;
  /**
   * An upright phone (chrome-polish-3): the picture fills its frame's height and shows only the
   * design's `TITLE_UPRIGHT` slice, so the view draws the name smaller, over that slice.
   */
  readonly upright?: boolean;
  /**
   * A phone on its side (polish-8): the band is cropped to the storm, the candles and all of
   * FUSE, so the view draws the name lower and smaller and leaves the link lane free of candles.
   */
  readonly compact?: boolean;
}

/**
 * The title's slice on an upright phone (a fill band's side crop, `FillWidthOptions`): at least
 * this much of the design's width, centred on the storm cell and FUSE's strolls.
 */
export const TITLE_UPRIGHT = { minVisibleWidth: 740, focusX: 560 } as const;

export interface TitleView {
  /** The view draws the game's name itself; the scene keeps its DOM heading for screen readers only. */
  readonly drawsTitle?: boolean;
  update(dt: number, s: TitleViewFrame): void;
  render(frame: Frame, s: TitleViewFrame): void;
  /** The title-knock beat: something hits the gem from inside. Optional. */
  knock?(): void;
  /** Where FUSE is (design px), so his speech card can point at him (mobile-7-hall). Optional. */
  fuseAt?(): FuseSpot | null;
  dispose(): void;
}

export type TitleViewFactory = (vc: ViewContext) => TitleView;

export interface ViewFactories {
  hall: HallViewFactory;
  title: TitleViewFactory;
}
