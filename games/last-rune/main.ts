// Entry point: mount the letterboxed canvas, bring up WebGPU, build the GameCtx
// and boot into the title. Fatal screens (no WebGPU, device lost) come from
// engine/platform. Dev routes: `?demo=render|art|props`, `?nogpu`.
import { boot } from '@engine/platform';
import { installGpuErrorLogging } from '@engine/render';
import { createGameCtx, type GameCtx, type SceneFactories } from './game/ctx';
import { HallScene } from './scenes/hall/hall-scene';
import { PuzzleStubScene } from './scenes/stubs/puzzle-stub';
import { SolveStubScene } from './scenes/stubs/solve-stub';
import { TitleScene } from './scenes/title/title-scene';

const TITLE = 'The Last Rune';

/**
 * Scene wiring. The altar (rules-puzzles) and solve moment replace the stubs
 * here; art replaces `ctx.views.hall` / `ctx.views.title` (see scenes/views.ts).
 */
const SCENES: SceneFactories = {
  title: () => new TitleScene(),
  hall: () => new HallScene(),
  puzzle: (machine) => new PuzzleStubScene(machine),
  solve: (moment) => new SolveStubScene(moment),
};

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const qs = new URLSearchParams(location.search);

  if (import.meta.env.DEV && qs.get('demo') === 'audio') {
    const { startAudioDemo } = await import('./scenes/_demo/audio-demo');
    startAudioDemo(root);
    return;
  }

  const res = await boot(root, {
    title: TITLE,
    forceUnsupported: import.meta.env.DEV && qs.has('nogpu'),
  });
  if (!res.ok) return;
  installGpuErrorLogging(res.gpu.device);

  if (import.meta.env.DEV && qs.get('demo') === 'render') {
    const { startRenderDemo } = await import('./scenes/_demo/render-demo');
    startRenderDemo(res.surface, res.gpu);
    return;
  }
  if (import.meta.env.DEV && qs.get('demo') === 'art') {
    const { startArtDemo } = await import('./scenes/_demo/art-demo');
    startArtDemo(res.surface, res.gpu);
    return;
  }

  if (import.meta.env.DEV && qs.get('demo') === 'props') {
    const { startPropsDemo } = await import('./scenes/_demo/props-demo');
    startPropsDemo(res.surface, res.gpu);
    return;
  }

  const ctx = createGameCtx(res.surface, res.gpu, SCENES);
  if (!ctx.save.persistent) {
    ctx.ui.toasts.show('Progress can’t be saved in this browser. Settings → Export keeps a copy.', {
      tone: 'warn',
      duration: 8000,
    });
  }
  ctx.flow.start();
  ctx.loop.start();
  res.surface.canvas.focus();

  if (import.meta.env.DEV) {
    // Dev/e2e handle: `window.__game.flow.state`, `__game.save.get()`.
    (window as unknown as { __game: GameCtx }).__game = ctx;
  }
}

main().catch((err) => {
  console.error('[boot] failed', err);
});
