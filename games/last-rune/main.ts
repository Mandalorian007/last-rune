// Entry point: the engine's createGame mounts the letterboxed canvas, brings up WebGPU and
// wires the noun-free systems (fatal screens for no WebGPU or a lost device included); the game
// adds its nouns and boots into the title. Dev routes: `?demo=audio|render|art|props`, `?nogpu`.
import { createGame } from '@thunderclap-engine/engine';
import { bootHost } from './boot-host';
import { type CrashGuard, installCrashGuard } from './game/crash';
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

let guard: CrashGuard | undefined;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  // Uncaught errors from here on get a calm "Something went wrong" card (game/crash.ts).
  let flush: () => boolean = () => false;
  guard = installCrashGuard({ root, title: TITLE, flush: () => flush() });
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
  if (import.meta.env.DEV) {
    // Dev/e2e handle: `window.__game.flow.state`, `__game.save.get()`.
    (window as unknown as { __game: GameCtx }).__game = ctx;
  }
}

main().catch((err) => {
  console.error('[boot] failed', err);
  guard?.report(err, { fatal: true });
});
