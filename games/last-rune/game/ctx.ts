/**
 * GameCtx (C7): every system a scene may use, built once at boot.
 *
 * The engine's `createGame` (D-041) builds the noun-free half: surface, renderer, post,
 * particles, input, audio, overlay, host, device mode, fill bands, scene stack, loop and the
 * lifecycle. `createGameCtx` adds Last Rune's nouns to that same object: the sound bank, the
 * save, settings, graphics, FUSE, codex, HUD, the flow and the views.
 *
 * Scenes are `Scene<GameCtx, Frame>` on `ctx.stack` and get the ctx in `enter`.
 * Scene factories come in from main.ts (`SceneFactories`) so the ctx module
 * doesn't import scenes, and so rules-puzzles' altar scene can replace the
 * puzzle stub by swapping one factory.
 */
import type { CreateGameOptions, EngineCtx } from '@thunderclap/engine';
import { type AudioEngine, recipes } from '@thunderclap/engine/audio';
import type { Scene } from '@thunderclap/engine/core';
import {
  deviceTraits,
  type FillWidthOptions,
  prefersReducedMotion,
  watchReducedMotion,
} from '@thunderclap/engine/platform';
import type { Frame } from '@thunderclap/engine/render';
import { applyTextScale } from '@thunderclap/engine/ui';
import { createGemPortraits } from '../art/gem-portraits';
import { cathedralHallView } from '../art/hall/hall-view';
import { stormTitleView } from '../art/hall/title-view';
import { lightBudget } from '../art/materials/lights';
import { createFusePortrait } from '../art/props/fuse-portrait';
import {
  createGameAudio,
  fuseModeForTier,
  type GameAudio,
  type MoodId,
  moodFor,
  type SceneName,
} from '../audio';
import { PHONE_WORDS_PER_CARD } from '../content/lines';
import { storyTier } from '../rules/progression';
import type { MachineId } from '../rules/types';
import { DOOR_PLATE_CSS } from '../scenes/hall/door-plate-styles';
import { HALL_PHONE_CSS } from '../scenes/hall/hall-phone-styles';
import { JOURNAL_PHONE_CSS } from '../scenes/journal/journal-phone-styles';
import { TITLE_PHONE_CSS } from '../scenes/title/title-phone-styles';
import { TITLE_UPRIGHT, type ViewContext, type ViewCue, type ViewFactories } from '../scenes/views';
import { CHROME_LAYOUT, createGameChrome } from '../ui/chrome';
import { Codex } from '../ui/codex';
import { Fuse } from '../ui/fuse';
import { Hud } from '../ui/hud';
import { openSettings } from '../ui/settings-panel';
import { ensureGameStyles } from '../ui/styles';
import { type Action, BINDINGS } from './actions';
import { GameFlow, type SolveMoment } from './flow';
import { GraphicsController } from './graphics';
import { createGameSave, type GameSave, progressOf, repairSave, SAVE_GAME_ID } from './save';
import { SettingsController } from './settings';

/** Each scene's phone rules, appended to the phone sheet in this order (ui/styles.ts). */
const SCENE_PHONE_CSS = TITLE_PHONE_CSS + HALL_PHONE_CSS + JOURNAL_PHONE_CSS + DOOR_PLATE_CSS;

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/**
 * Phones: scenes whose art fills the width (D-040), with the design band that must stay on
 * screen. Hall: any phone fills the width (mobile-5-chrome); the hall scene's camera then zooms
 * out about the doorway band and widens the wall (scenes/hall/hall-frame.ts), so every doorway
 * stays whole with no side bars. Title: the name (with a clear margin above it) down to the
 * candles; upright (chrome-polish-3) it fills its frame's height instead and crops the sides
 * about the storm cell and FUSE (the view draws the name over that part, `TITLE_UPRIGHT`).
 */
const FILL_BANDS: Record<string, FillWidthOptions> = {
  // polish-8: centred low enough that FUSE (ground y 968) stands whole on wide phones; the view
  // draws the name lower there to match (title-view COMPACT_TITLE).
  title: { minVisible: 760, focusY: 600, ...TITLE_UPRIGHT },
  hall: { minVisible: 667, focusY: 544 },
  // The journal (chrome-polish-3): as wide as the head (y 34) and FUSE's plate (to y 1001)
  // allow; what bars remain are the desk's own dark wood (ui/chrome.ts DESK_BARS).
  journal: { minVisible: 1000, focusY: 528 },
  // The altar (mobile-5-board): the board and its column lay out inside the visible band
  // (layout.ts phoneLayout), so wide phones trade dead side bars for a bigger board.
  puzzle: { minVisible: 860, focusY: 540 },
  solve: { minVisible: 860, focusY: 540 },
  // The ending (mobile-6-chrome): full width like its hangout, so no scene of it has side
  // bars; the rune, FUSE and the clipboard's phone rest spot stay inside the band.
  ending: { minVisible: 860, focusY: 540 },
};

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
  /** The journal desk (story-scenes), pushed over the hall or an altar. */
  journal(): GameScene;
  /** The ending (story-scenes); replaces the final solve moment. */
  ending(moment: SolveMoment): GameScene;
}

/** The engine ctx Last Rune boots: its actions, its save, scenes typed against `GameCtx`. */
export type LastRuneEngine = EngineCtx<Action, GameSave, GameCtx>;

/** The engine ctx (`surface`, `renderer`, `ui`, `host`, `loop`, …) plus Last Rune's nouns. */
export interface GameCtx extends LastRuneEngine {
  /** Game sound bank, music moods and FUSE's voice (games/last-rune/audio). */
  readonly sound: GameAudio;
  readonly settings: SettingsController;
  /** Quality tier and resolution control (game/graphics.ts). */
  readonly graphics: GraphicsController;
  readonly fuse: Fuse;
  readonly codex: Codex;
  readonly hud: Hud;
  readonly flow: GameFlow<GameScene>;
  /** Art swap-in points (see scenes/views.ts). */
  readonly views: ViewFactories;
  readonly viewContext: ViewContext;
  sfx(name: UiSound, gain?: number): void;
  /** Story tier from the save (1..4, see rules/progression `storyTier`). */
  tier(): number;
  /** Crossfade music to a scene's mood at the current story tier. */
  setMood(scene: SceneName | MoodId): void;
  openSettings(): void;
}

/** What Last Rune asks of `createGame` (main.ts). */
export function engineOptions(
  root: HTMLElement,
  opts: { title: string; forceUnsupported?: boolean },
): CreateGameOptions<Action, GameSave> {
  return {
    root,
    title: opts.title,
    forceUnsupported: opts.forceUnsupported,
    design: { width: DESIGN_W, height: DESIGN_H },
    post: {
      godRays: { x: DESIGN_W / 2, y: -60, bloomSource: 0.12, intensity: 0.3 },
      fog: { density: 0.45 },
    },
    particles: { capacity: 32768, floorY: 1040 },
    // The browser tab or itch's frame; saves live in its localStorage (v1.0 keys unchanged).
    save: (host) => createGameSave({ host }),
    mixerKey: SAVE_GAME_ID,
    styles: (doc) => ensureGameStyles(doc, SCENE_PHONE_CSS),
    // Phones: menus, panels, the HUD and FUSE's lane in CSS px on layout regions (ui/chrome.ts).
    overlay: { layout: CHROME_LAYOUT },
    // The HUD shortcuts (Codex, Settings, Journal) also work while a button or link has focus,
    // e.g. the ending's "Back to the hall". Back (Esc) and the arrows work on a focused button
    // too, so a clicked or Tabbed-to button never strands a keyboard player.
    input: {
      bindings: BINDINGS,
      globalKeys: ['KeyC', 'KeyO', 'KeyJ'],
      buttonKeys: ['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    },
    fillBands: FILL_BANDS,
    // Load timing (User Timing marks; read by scripts/perf/load.spec.ts, free at runtime).
    onGpuReady: () => performance.mark('lr:gpu-ready'),
  };
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

/** `GPUAdapter.info.isFallbackAdapter` (newer) or the older `adapter.isFallbackAdapter`. */
function isFallbackAdapter(adapter: GPUAdapter): boolean {
  const a = adapter as GPUAdapter & {
    isFallbackAdapter?: boolean;
    info?: { isFallbackAdapter?: boolean };
  };
  return !!(a.info?.isFallbackAdapter ?? a.isFallbackAdapter);
}

/** Adds Last Rune's nouns to the engine ctx (the same object, so scenes see them). */
export function createGameCtx(engine: LastRuneEngine, scenes: SceneFactories): GameCtx {
  const { surface, gpu, renderer, post, particles, input, audio, ui, chrome, host, device, save } =
    engine;
  const { stack, loop, hooks } = engine;

  // ── Graphics quality (Settings → Graphics; see game/graphics.ts) ───────
  let reducedMotion = prefersReducedMotion();
  let particleTier = 1;
  const applyParticles = () => {
    particles.spawnScale = (reducedMotion ? 0.25 : 1) * particleTier;
  };
  const graphics = new GraphicsController(
    {
      setResolution: (o) => renderer.setResolution(o),
      setPostQuality: (q) => post.setQuality(q),
      setLightCap: (n) => {
        lightBudget.max = n;
      },
      setParticleScale: (k) => {
        particleTier = k;
        applyParticles();
      },
      setTiming: (every) => {
        renderer.timingEvery = every;
      },
      setFrameCap: (fps) => {
        loop.maxFps = fps;
      },
    },
    // Phones start on low (D-039; docs/design/mobile.md).
    { fallbackAdapter: isFallbackAdapter(gpu.adapter), handheld: deviceTraits().handheld },
  );
  renderer.onGpuTime((ms) => graphics.sample(ms, performance.now()));

  // ── Audio ──────────────────────────────────────────────────────────────
  defineUiSounds(audio);
  // Load timing: the audio pre-render runs after the first gesture (scripts/perf/load.spec.ts).
  const sound = createGameAudio(audio, {
    onPrepared: (stats) => performance.mark('lr:audio-ready', { detail: stats }),
  });
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

  // ── Settings, FUSE, codex, HUD ─────────────────────────────────────────
  const settings = new SettingsController(
    save,
    {
      apply: (e) => {
        ui.caption.reducedMotion = e.reducedMotion;
        ui.caption.cps = e.captionCps > 0 ? e.captionCps : 100000;
        reducedMotion = e.reducedMotion;
        graphics.setPreference(e.graphics);
        applyParticles();
        surface.root.toggleAttribute('data-reduced-motion', e.reducedMotion);
        applyTextScale(ui.root, e.textScale / 100, (t) => ui.setTheme(t));
        if (chrome) applyTextScale(chrome.ui.root, e.textScale / 100, (t) => chrome.ui.setTheme(t));
      },
    },
    prefersReducedMotion(),
  );
  watchReducedMotion((r) => settings.setSystemReducedMotion(r));

  const fuse = new Fuse(ui.caption, {
    voice: (text) => sound.fuse.onChar(fuseModeForTier(tier()), text),
    cardWords: () => (device.phone ? PHONE_WORDS_PER_CARD : undefined),
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
    // Baked on first open with the real gem material (one offscreen frame), then reused.
    pictures: createGemPortraits(renderer),
  });

  // A scene is built and entered before the flow announces its state, so the fill band is
  // set for it first: the altar lays out against its own band, never the hall's fill.
  const entering =
    <A extends unknown[]>(state: string, make: (...a: A) => GameScene) =>
    (...a: A) => {
      engine.setFill(state);
      return make(...a);
    };
  const flow = new GameFlow<GameScene>(stack, save, {
    title: entering('title', scenes.title),
    hall: entering('hall', scenes.hall),
    puzzle: entering('puzzle', scenes.puzzle),
    solve: entering('solve', scenes.solve),
    journal: scenes.journal && entering('journal', scenes.journal),
    ending: scenes.ending && entering('ending', scenes.ending),
  });

  const doOpenSettings = () =>
    openSettings({
      ui,
      audio,
      save,
      settings,
      host,
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
    journal: () => openJournal(),
  });
  // The desk opens from the hall or over an altar (the board waits underneath, paused). An
  // altar mid-strike says no (`canPause`): the bolt and its verdict play out first.
  const openJournal = () => {
    const top = stack.top as (GameScene & { canPause?(): boolean }) | undefined;
    if (flow.state === 'puzzle' && top?.canPause?.() === false) {
      sfx('ui.deny');
      return;
    }
    sfx('ui.click');
    fuse.hush();
    flow.openJournal();
  };
  const unreadPages = () => {
    const j = save.get().journal;
    return j.found.filter((p) => !j.read.includes(p)).length;
  };
  // Phones: FUSE's lane, the ☰ in its rail, the "turn sideways" card (ui/chrome.ts).
  const gameChrome = createGameChrome({ chrome, ui, hud: hud.root, surface, device });
  gameChrome.scene(flow.state);
  engine.setFill(flow.state);
  flow.onChange((state) => {
    engine.setFill(state);
    gameChrome.scene(state);
    // Scenes own their caption avoid regions; leaving the altar must never strand one.
    if (state !== 'puzzle') fuse.avoid(null);
    hud.visible = state === 'hall' || state === 'puzzle' || state === 'solve';
    hud.root.dataset.scene = state;
    hud.journalShown(state === 'hall' || state === 'puzzle', unreadPages(), state === 'hall');
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
    phone: () => device.phone,
  };

  // ── Frame and lifecycle hooks ──────────────────────────────────────────
  hooks.update = (dt) => {
    if (!ui.stack.hasModal && flow.state !== 'ending') {
      if (input.pressed('journal') && (flow.state === 'hall' || flow.state === 'puzzle')) {
        openJournal();
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
  };
  hooks.beforeRender = (time) => graphics.frame(time.frameDt * 1000, performance.now());
  let firstFrame = true;
  hooks.afterRender = () => {
    if (firstFrame) {
      firstFrame = false;
      performance.mark('lr:first-frame');
    }
    // The caption portrait animates while FUSE talks, then rests on one idle frame.
    if (fuse.speaking || portraitTalking) {
      portraitTalking = fuse.speaking;
      portrait.render(undefined, portraitTalking);
    }
  };
  // Hidden or paged out: the engine stops the loop and flushes the save; play time stops first.
  hooks.hide = () => flow.commitPlayTime();
  // Device lost: the engine halts the loop, audio and captions; the game's own work stops too.
  hooks.deviceLost = () => {
    sound.dispose();
    flow.commitPlayTime();
  };

  return Object.assign(engine, {
    sound,
    settings,
    graphics,
    fuse,
    codex,
    hud,
    flow,
    views,
    viewContext,
    sfx,
    tier,
    setMood,
    openSettings: doOpenSettings,
  }) satisfies GameCtx;
}

/** Says when progress can't be kept, then starts the flow (the title) and the loop. */
export function startGame(ctx: GameCtx): void {
  if (!ctx.save.persistent) {
    ctx.ui.toasts.show('Progress can’t be saved in this browser. Settings → Export keeps a copy.', {
      tone: 'warn',
      duration: 8000,
    });
  } else if (ctx.save.status.loadResult === 'recovered') {
    // The old bytes are kept under `<key>:backup`; say so rather than silently starting over.
    ctx.ui.toasts.show(
      'Your saved game couldn’t be read, so a new one begins. A backup was kept.',
      {
        tone: 'warn',
        duration: 9000,
      },
    );
  }
  ctx.flow.start();
  ctx.loop.start();
  ctx.surface.canvas.focus();
}
