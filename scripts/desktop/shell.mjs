// Where the ThunderClap desktop shell lives: the npm package @thunderclap-engine/host-electron,
// whose package.json `main` is the shell's built main process (out/main.mjs). Run unpackaged,
// Electron is pointed at that folder and the game comes in through the environment
// (TC_RENDERER_DIR = dist/, or TC_RENDERER_URL = a local Vite dev server; see its README).
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'package.json'));

/** The installed shell package's folder (Electron's app path when unpackaged). */
export const shellDir = dirname(require.resolve('@thunderclap-engine/host-electron/package.json'));
/** The Electron binary that the root `electron` devDependency downloads on first use. */
export const electronBin = /** @type {string} */ (require('electron'));
