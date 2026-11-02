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
import { createOverlay, type Overlay, PadNav } from '@engine/ui';
import { cathedralHallView } from '../art/hall/hall-view';
import { stormTitleView } from '../art/hall/title-view';
import { createFusePortrait } from '../art/props/fuse-portrait';
import {
  createGameAudio,
  fuseModeForTier,
  type GameAudio,
  type MoodId,
  moodFor,
  type SceneName,
} from '../audio';
import { storyTier } from '../rules/progression';
import type { MachineId } from '../rules/types';
import type { ViewContext, ViewCue, ViewFactories } from '../scenes/views';
import { Codex } from '../ui/codex';
import { Fuse } from '../ui/fuse';
import { Hud } from '../ui/hud';
import { openSettings } from '../ui/settings-panel';
import { ensureGameStyles } from '../ui/styles';
import { type Action, BINDINGS } from './actions';
import { GameFlow, type SolveMoment } from './flow';
import { createGameSave, type GameSave, progressOf, repairSave, SAVE_GAME_ID } from './save';
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
  /** The journal desk (story-scenes), pushed over the hall. */
  journal(): GameScene;
  /** The ending (story-scenes); replaces the final solve moment. */
  ending(moment: SolveMoment): GameScene;
}

export interface GameCtx {
  readonly surface: Surface;
  readonly renderer: Renderer;
  readonly post: PostStack;
  /** Shared GPU particle pool; updated by the loop, drawn by views. */
  readonly particles: ParticleSystem;
  readonly input: Input<Action>;
  readonly audio: AudioEngine;
  /** Game sound bank, music moods and FUSE's voice (games/last-rune/audio). */
  readonly sound: GameAudio;
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
  /** Story tier from the save (1..4, see rules/progression `storyTier`). */
  tier(): number;
  /** Crossfade music to a scene's mood at the current story tier. */
  setMood(scene: SceneName | MoodId): void;
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
  // When a panel closes and its opener can't (or, for the HUD's shortcut buttons, shouldn't)
  // take focus back, focus returns to the canvas so keys keep reaching the game.
  const ui = createOverlay({ parent: surface.root, focusHome: () => surface.canvas });
  // Input is blocked while a modal panel is up, so the pad drives panels through this:
  // d-pad moves focus, A activates, B closes (as Tab, Enter and Esc do).
  const padNav = new PadNav(ui.stack);
  surface.onResize(({ rect, backbuffer }) => {
    renderer.resize(backbuffer.width, backbuffer.height);
    ui.setRect(rect);
  });

  // ── Audio ──────────────────────────────────────────────────────────────
  const audio = new AudioEngine();
  audio.attach();
  persistMixer(audio, { game: SAVE_GAME_ID });
  defineUiSounds(audio);
  const sound = createGameAudio(audio);
  // UI sounds route to the game sound bank; recipes above remain as the fallback names.
  const sfx = (name: UiSound, gain = 1) => {
    switch (name) {
      case 'ui.click':
        sound.sfx.play('uiClick', { gain });
        return;
      case 'ui.hover':
        sound.sfx.play('uiHover', { gain });
        return;
      case 'ui.deny':
        sound.sfx.play('socketBlocked', { gain });
        return;
      case 'solve.chime':
        sound.sfx.play('machineExact', { gain });
        return;
      default:
        audio.play(name, { bus: 'ui', gain });
    }
  };
  const tier = () => storyTier(progressOf(save.get()));
  const setMood = (scene: SceneName | MoodId) => {
    const t = tier();
    sound.music.setMood(
      scene === 'hall' || scene === 'altar' ? moodFor(scene, Math.min(3, t)) : (scene as MoodId),
    );
  };

  // ── Input (blocked under modal panels) ─────────────────────────────────
  // The HUD shortcuts (Codex, Settings, Journal) also work while a button or link has focus,
  // e.g. the ending's "Back to the hall". Back (Esc) and the arrows work on a focused button
  // too, so a clicked or Tabbed-to button never strands a keyboard player.
  const input = new Input<Action>(BINDINGS, {
    blocked: () => ui.stack.hasModal,
    globalKeys: ['KeyC', 'KeyO', 'KeyJ'],
    buttonKeys: ['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
  });
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

  const fuse = new Fuse(ui.caption, {
    voice: (text) => sound.fuse.onChar(fuseModeForTier(tier()), text),
  });
  // Animated FUSE portrait in the caption card (one canvas, reused for every line).
  const portrait = createFusePortrait(renderer, { size: 96, zoom: 0.46 });
  fuse.setPortrait(() => portrait.canvas);
  let portraitTalking = true;
  const codex = new Codex({
    panels: ui.stack,
    save,
    onTurn: () => sfx('ui.page'),
    onOpen: () => sound.sfx.play('codexOpen'),
    onClose: () => sound.sfx.play('codexClose'),
  });

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
      if (!codex.isOpen) fuse.hush(); // a fresh line after the codex, not a resumed one
      codex.toggle();
    },
    settings: () => {
      sfx('ui.click');
      fuse.hush();
      doOpenSettings();
    },
    journal: () => {
      sfx('ui.click');
      fuse.hush();
      flow.openJournal();
    },
  });
  const unreadPages = () => {
    const j = save.get().journal;
    return j.found.filter((p) => !j.read.includes(p)).length;
  };
  flow.onChange((state) => {
    // Scenes own their caption avoid regions; leaving the altar must never strand one.
    if (state !== 'puzzle') fuse.avoid(null);
    hud.visible = state === 'hall' || state === 'puzzle' || state === 'solve';
    hud.journalShown(state === 'hall', unreadPages());
    hud.plate(null);
  });

  const views: ViewFactories = { hall: cathedralHallView, title: stormTitleView };
  const viewCue = (name: ViewCue) => {
    if (name === 'doorUnlock') sound.sfx.play('doorUnlock');
    else sound.sfx.play('thunder', { near: name === 'thunderNear' });
  };
  const viewContext: ViewContext = {
    renderer,
    particles,
    width: DESIGN_W,
    height: DESIGN_H,
    cue: viewCue,
  };

  // ── Loop ───────────────────────────────────────────────────────────────
  const loop = new GameLoop({
    update: (dt: number) => {
      input.update();
      padNav.update();
      if (!ui.stack.hasModal && flow.state !== 'ending') {
        if (input.pressed('journal') && flow.state === 'hall') {
          sfx('ui.click');
          fuse.hush();
          flow.openJournal();
        } else if (input.pressed('codex')) {
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
      // The caption portrait animates while FUSE talks, then rests on one idle frame.
      if (fuse.speaking || portraitTalking) {
        portraitTalking = fuse.speaking;
        portrait.render(undefined, portraitTalking);
      }
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
    sound,
    tier,
    setMood,
    openSettings: doOpenSettings,
  } satisfies GameCtx);
  return ctx;
}
