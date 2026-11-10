// Entry point: the engine's createGame mounts the letterboxed canvas, brings up WebGPU and
// wires the noun-free systems (fatal screens for no WebGPU or a lost device included); the game
// adds its nouns and boots into the title. Dev routes: `?demo=audio|render|art|props`, `?nogpu`.
import { type CrashScreen, createGame, installCrashScreen } from '@thunderclap-engine/engine';
import { bootHost } from './boot-host';
import {
  createGameCtx,
  engineOptions,
  type GameCtx,
  type LastRuneEngine,
  type SceneFactories,
  startGame,
} from './game/ctx';
import { AltarScene } from './scenes/altar/altar-scene';
import { SolveScene } from './scenes/altar/solve-scene';
import { EndingScene } from './scenes/ending/ending-scene';
import { HallScene } from './scenes/hall/hall-scene';
import { JournalScene } from './scenes/journal/journal-scene';
import { TitleScene } from './scenes/title/title-scene';

const TITLE = 'The Last Rune';

/**
 * Scene wiring. The altar (rules-puzzles) and solve moment replace the stubs
 * here; art replaces `ctx.views.hall` / `ctx.views.title` (see scenes/views.ts).
 */
const SCENES: SceneFactories = {
  title: () => new TitleScene(),
  hall: () => new HallScene(),
  puzzle: (machine) => new AltarScene(machine),
  solve: (moment) => new SolveScene(moment),
  journal: () => new JournalScene(),
  ending: (moment) => new EndingScene(moment),
};

let crash: CrashScreen | undefined;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  // Uncaught errors from here on get the engine's calm "Something went wrong" card. Installed
  // before `createGame` (not `createGame({ crash })`) so a throw in the host pick, the demo routes
  // or the game's own ctx setup is a boot failure too (Reload only). It flushes the save first.
  let flush: () => boolean = () => false;
  crash = installCrashScreen({ root, title: TITLE, flush: () => flush() });
  const qs = new URLSearchParams(location.search);
  if (import.meta.env.DEV && qs.has('demo')) {
    const { startDemo } = await import('./scenes/_demo/routes');
    if (await startDemo(qs.get('demo'), root, TITLE)) return;
  }

  const forceUnsupported = import.meta.env.DEV && qs.has('nogpu');
  // The desktop shell's host, or undefined for the web host (boot-host.ts).
  const host = await bootHost();
  const engine: LastRuneEngine | null = await createGame({
    ...engineOptions(root, { title: TITLE, forceUnsupported }),
    host,
  });
  if (!engine) return;
  const ctx = createGameCtx(engine, SCENES);
  flush = () => ctx.save.flush();
  startGame(ctx);
  // e2e handle in every build (tests/e2e/fixtures.ts): the overlay's current layout overflows.
  // The engine only warns about them in dev, so the guard asks instead of reading the console.
  (window as unknown as { __lrOverflows: () => unknown }).__lrOverflows = () =>
    engine.ui.layout.overflows();
  if (import.meta.env.DEV) {
    // Dev/e2e handle: `window.__game.flow.state`, `__game.save.get()`.
    (window as unknown as { __game: GameCtx }).__game = ctx;
  }
}

main().catch((err) => {
  console.error('[boot] failed', err);
  crash?.report(err, { fatal: true });
});
