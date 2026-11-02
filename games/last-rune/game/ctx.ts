/**
 * GameCtx (C7): every system a scene may use, built once at boot.
 *
 * Scenes are `Scene<GameCtx, Frame>` on `ctx.stack` and get the ctx in `enter`.
 * Scene factories come in from main.ts (`SceneFactories`) so the ctx module
 * doesn't import scenes, and so rules-puzzles' altar scene can replace the
 * puzzle stub by swapping one factory.
 */
import { AudioEngine, persistMixer, recipes } from '@engine/audio';
import { GameLoop, type Scene, SceneStack, type Time } from '@engine/core';
import { ParticleSystem } from '@engine/fx';
import { Input } from '@engine/input';
import {
  type GpuContext,
  prefersReducedMotion,
  type Surface,
  watchReducedMotion,
  watchVisibility,
} from '@engine/platform';
import { PostStack } from '@engine/post';
import { type Frame, Renderer } from '@engine/render';
import { createOverlay, type Overlay } from '@engine/ui';
import type { MachineId } from '../rules/types';
import { placeholderHallView } from '../scenes/placeholder/hall-view';
import { placeholderTitleView } from '../scenes/placeholder/title-view';
import type { ViewContext, ViewFactories } from '../scenes/views';
import { Codex } from '../ui/codex';
import { Fuse } from '../ui/fuse';
import { Hud } from '../ui/hud';
import { openSettings } from '../ui/settings-panel';
import { ensureGameStyles } from '../ui/styles';
import { type Action, BINDINGS } from './actions';
import { GameFlow, type SolveMoment } from './flow';
import { createGameSave, type GameSave, repairSave, SAVE_GAME_ID } from './save';
import { SettingsController } from './settings';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export type GameScene = Scene<GameCtx, Frame>;

/** Placeholder UI sounds. audio-design can `ctx.audio.define()` the same names to replace them. */
export type UiSound = 'ui.click' | 'ui.hover' | 'ui.blip' | 'ui.page' | 'ui.deny' | 'solve.chime';

export interface SceneFactories {
  title(): GameScene;
  hall(): GameScene;
  /** Hook for rules-puzzles' altar scene (pushed over the hall). */
  puzzle(machine: MachineId): GameScene;
  /** Hook for the solve moment (replaces the puzzle; popping returns to the hall). */
  solve(moment: SolveMoment): GameScene;
}

export interface GameCtx {
  readonly surface: Surface;
  readonly renderer: Renderer;
  readonly post: PostStack;
  /** Shared GPU particle pool; updated by the loop, drawn by views. */
  readonly particles: ParticleSystem;
  readonly input: Input<Action>;
  readonly audio: AudioEngine;
  readonly ui: Overlay;
  readonly save: GameSave;
  readonly settings: SettingsController;
  readonly fuse: Fuse;
  readonly codex: Codex;
  readonly hud: Hud;
  readonly stack: SceneStack<GameCtx, Frame>;
  readonly flow: GameFlow<GameScene>;
  /** Art swap-in points (see scenes/views.ts). */
  readonly views: ViewFactories;
  readonly viewContext: ViewContext;
  readonly loop: GameLoop;
  sfx(name: UiSound, gain?: number): void;
  openSettings(): void;
}

function defineUiSounds(audio: AudioEngine): void {
  audio.define('ui.click', recipes.click({ pitch: 1400, level: 0.5 }));
  audio.define('ui.hover', recipes.click({ pitch: 2600, length: 0.6, level: 0.25 }), {
    maxVoices: 2,
  });
  audio.define(
    'ui.blip',
    recipes.click({ pitch: 900, length: 0.5, level: 0.15, brightness: 0.2 }),
    {
      maxVoices: 2,
    },
  );
  audio.define('ui.page', recipes.whoosh({ length: 0.4, level: 0.35 }));
  audio.define('ui.deny', recipes.thud({ pitch: 90, level: 0.5 }));
  audio.define('solve.chime', recipes.chime({ pitch: 660, length: 1.4, level: 0.7 }));
}

export function createGameCtx(surface: Surface, gpu: GpuContext, scenes: SceneFactories): GameCtx {
  // ── GPU ────────────────────────────────────────────────────────────────
  const renderer = new Renderer(gpu, { logicalWidth: DESIGN_W, logicalHeight: DESIGN_H });
  const post = new PostStack(renderer, {
    godRays: { x: DESIGN_W / 2, y: -60, bloomSource: 0.12, intensity: 0.3 },
    fog: { density: 0.45 },
  });
  renderer.post = post;
  const particles = new ParticleSystem(renderer, { capacity: 32768, floorY: 1040 });

  // ── Save + overlay ─────────────────────────────────────────────────────
  const save = createGameSave();
  ensureGameStyles(surface.root.ownerDocument);
  const ui = createOverlay({ parent: surface.root });
  surface.onResize(({ rect, backbuffer }) => {
    renderer.resize(backbuffer.width, backbuffer.height);
    ui.setRect(rect);
  });

  // ── Audio ──────────────────────────────────────────────────────────────
  const audio = new AudioEngine();
  audio.attach();
  persistMixer(audio, { game: SAVE_GAME_ID });
  defineUiSounds(audio);
  const sfx = (name: UiSound, gain = 1) => {
    audio.play(name, { bus: 'ui', gain });
  };

  // ── Input (blocked under modal panels) ─────────────────────────────────
  const input = new Input<Action>(BINDINGS, { blocked: () => ui.stack.hasModal });
  input.attach({ pointerTarget: surface.canvas });
  input.setPointerTransform((x, y) => surface.clientToLogical(x, y));

  // ── Settings, FUSE, codex, HUD ─────────────────────────────────────────
  const settings = new SettingsController(
    save,
    {
      apply: (e) => {
        ui.caption.reducedMotion = e.reducedMotion;
        ui.caption.cps = e.captionCps > 0 ? e.captionCps : 100000;
        particles.spawnScale = e.reducedMotion ? 0.25 : 1;
        surface.root.toggleAttribute('data-reduced-motion', e.reducedMotion);
      },
    },
    prefersReducedMotion(),
  );
  watchReducedMotion((r) => settings.setSystemReducedMotion(r));

  const fuse = new Fuse(ui.caption, { onChar: () => sfx('ui.blip') });
  const codex = new Codex({ panels: ui.stack, save, onTurn: () => sfx('ui.page') });

  // The stack hands scenes this object on enter; it is filled in below, before the first scene.
  const ctx = {} as GameCtx;
  const stack = new SceneStack<GameCtx, Frame>(ctx);
  const flow = new GameFlow<GameScene>(stack, save, scenes);

  const doOpenSettings = () =>
    openSettings({
      ui,
      audio,
      save,
      settings,
      onProgressReplaced: (why) => {
        fuse.hush();
        if (why === 'import') {
          repairSave(save);
          flow.start();
        } else {
          flow.resetProgress();
        }
      },
    });

  const hud = new Hud(ui.layers.hud, {
    codex: () => {
      sfx('ui.click');
      if (!codex.isOpen) fuse.hush(); // the caption card sits above panels
      codex.toggle();
    },
    settings: () => {
      sfx('ui.click');
      fuse.hush();
      doOpenSettings();
    },
  });
  flow.onChange((state) => {
    hud.visible = state !== 'title' && state !== 'boot';
    hud.plate(null);
  });

  const views: ViewFactories = { hall: placeholderHallView, title: placeholderTitleView };
  const viewContext: ViewContext = { renderer, particles, width: DESIGN_W, height: DESIGN_H };

  // ── Loop ───────────────────────────────────────────────────────────────
  const loop = new GameLoop({
    update: (dt: number) => {
      input.update();
      if (!ui.stack.hasModal) {
        if (input.pressed('codex')) {
          sfx('ui.click');
          fuse.hush();
          codex.open();
        } else if (input.pressed('settings')) {
          sfx('ui.click');
          fuse.hush();
          doOpenSettings();
        }
      }
      flow.tick(dt);
      particles.update(dt);
      stack.update(dt);
    },
    render: (alpha: number, time: Time) => {
      const frame = renderer.beginFrame(time.realTime, time.frameDt);
      stack.render(frame, alpha);
      renderer.endFrame();
    },
  });
  watchVisibility((visible) => {
    if (visible) loop.start();
    else {
      loop.stop();
      flow.commitPlayTime();
      save.flush();
    }
  });
  addEventListener('pagehide', () => {
    flow.commitPlayTime();
    save.flush();
  });

  Object.assign(ctx, {
    surface,
    renderer,
    post,
    particles,
    input,
    audio,
    ui,
    save,
    settings,
    fuse,
    codex,
    hud,
    stack,
    flow,
    views,
    viewContext,
    loop,
    sfx,
    openSettings: doOpenSettings,
  } satisfies GameCtx);
  return ctx;
}
