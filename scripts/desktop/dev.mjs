#!/usr/bin/env node
// `pnpm desktop:dev`: The Last Rune in the desktop shell around a Vite dev server, with hot
// reload in the window. The shell is the npm package @thunderclap-engine/host-electron, run
// unpackaged with TC_RENDERER_URL (the shell only accepts a dev server on this machine).
//
//   pnpm desktop:dev [--url <url>]   (default: starts Vite on 127.0.0.1:5198)
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { electronBin, root, shellDir } from './shell.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--url');
let url = i >= 0 ? args[i + 1] : undefined;

let server = null;
if (!url) {
  server = await createServer({
    root,
    clearScreen: false,
    server: { host: '127.0.0.1', port: 5198, strictPort: true },
  });
  await server.listen();
  url = 'http://127.0.0.1:5198/';
}

console.log(`desktop:dev: ${url}`);
const child = spawn(electronBin, [shellDir], {
  stdio: 'inherit',
  env: { ...process.env, TC_RENDERER_URL: url },
});
const stop = async (code) => {
  await server?.close();
  process.exit(code ?? 0);
};
child.on('exit', (code) => void stop(code));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
