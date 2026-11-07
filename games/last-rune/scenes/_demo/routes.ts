// Dev routes (`?demo=audio|render|art|props`), loaded by main.ts in dev builds only. The GPU
// demos boot the platform themselves and draw straight to the surface, without a GameCtx.
import { boot } from '@thunderclap-engine/engine/platform';
import { installGpuErrorLogging } from '@thunderclap-engine/engine/render';

/** Starts the demo `name` in `root`. False when `name` is not a demo (boot the game instead). */
export async function startDemo(name: string | null, root: HTMLElement, title: string) {
  if (name === 'audio') {
    const { startAudioDemo } = await import('./audio-demo');
    startAudioDemo(root);
    return true;
  }
  if (name !== 'render' && name !== 'art' && name !== 'props') return false;
  const res = await boot(root, { title });
  if (!res.ok) return true;
  installGpuErrorLogging(res.gpu.device);
  if (name === 'render') {
    const { startRenderDemo } = await import('./render-demo');
    startRenderDemo(res.surface, res.gpu);
  } else if (name === 'art') {
    const { startArtDemo } = await import('./art-demo');
    startArtDemo(res.surface, res.gpu);
  } else {
    const { startPropsDemo } = await import('./props-demo');
    startPropsDemo(res.surface, res.gpu);
  }
  return true;
}
