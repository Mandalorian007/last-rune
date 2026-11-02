// Entry point: mount the letterboxed canvas, bring up WebGPU, then hand off.
// Fatal screens (no WebGPU, device lost) come from engine/platform.
import { boot } from '@engine/platform';
import { installGpuErrorLogging } from '@engine/render';

const TITLE = 'The Last Rune';

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

  // Placeholder until the wave-2 game scenes land.
  const note = document.createElement('p');
  note.textContent = `${TITLE}: engine up.${import.meta.env.DEV ? ' Try ?demo=render' : ''}`;
  note.style.cssText =
    'position:fixed;left:0;right:0;bottom:16px;text-align:center;color:#8a93a6;font:14px serif';
  root.appendChild(note);
}

main().catch((err) => {
  console.error('[boot] failed', err);
});
