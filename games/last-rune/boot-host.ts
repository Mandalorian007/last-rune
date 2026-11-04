/**
 * The one place Last Rune learns where it runs (D-041 Phase 4, D-042). In the ThunderClap
 * desktop shell the preload defines `window.thunderclap`, and the game boots on the Electron
 * host: links and the clipboard through the main process, fullscreen and Quit on the window.
 * Everywhere else (a browser tab, itch's frame) it returns undefined and `createGame` makes its
 * usual web host.
 *
 * The Electron host is a dynamic import, so the web build loads none of it: the browser never
 * fetches that chunk. Nothing else in the game imports `@thunderclap/host-electron`; the rest
 * sees only `Host` (engine/host), e.g. `ctx.host.window` for the desktop-only Quit entry.
 */
import { type Host, setDefaultHost } from '@thunderclap/engine/host';

export async function bootHost(): Promise<Host | undefined> {
  if (!('thunderclap' in window)) return undefined;
  const { createElectronHost, inElectronShell } = await import('@thunderclap/host-electron');
  if (!inElectronShell()) return undefined;
  const host = createElectronHost();
  // Engine modules that fall back to the default host (links, the mixer) see this one too.
  setDefaultHost(host);
  return host;
}
