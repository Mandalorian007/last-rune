#!/usr/bin/env node
// Local itch.io simulation: serves an itch-like game page on one site and the built game on
// another, so the game runs in a cross-site iframe the way it does on itch.io.
//
//   pnpm build && pnpm itch:sim          then open the printed URL
//
//   host page:  http://localhost:<port>/            (stands in for https://<user>.itch.io/<game>)
//   game files: http://127.0.0.1:<port+1>/html/0000000/...   (stands in for html-classic.itch.zone)
//
// localhost and 127.0.0.1 are different sites, so storage partitioning, permissions policy and
// cross-origin rules behave as they do on itch. Both are secure contexts, so WebGPU is exposed.
// The game server mimics itch's CDN quirks: nested path (absolute URLs break), case-sensitive
// file lookup even on macOS, and 403 for folder URLs.
//
// Options: --port <n> (default 8790, or ITCH_SIM_PORT), --dist <dir> (default dist/).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** Exact allow list on itch.io's game iframe, read from live pages on 2026-11-02. */
export const ITCH_IFRAME_ALLOW =
  'autoplay; fullscreen *; geolocation; microphone; camera; midi; monetization; ' +
  'xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share';
export const GAME_PATH_PREFIX = '/html/0000000/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wgsl': 'text/plain; charset=utf-8',
};

/** True if `rel` exists under `base` with exactly this letter case (macOS FS is case-insensitive). */
function existsCaseSensitive(base, rel) {
  let dir = base;
  for (const seg of rel.split('/')) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
    if (!readdirSync(dir).includes(seg)) return false;
    dir = join(dir, seg);
  }
  return true;
}

/**
 * Start both servers.
 * @param {{ port?: number; dist?: string; quiet?: boolean }} [opts]
 */
export function startItchSim(opts = {}) {
  const hostPort = opts.port ?? 8790;
  const gamePort = hostPort + 1;
  const dist = resolve(opts.dist ?? join(root, 'dist'));
  const hostPage = readFileSync(join(here, 'index.html'), 'utf8');
  const gameOrigin = `http://127.0.0.1:${gamePort}`;

  const host = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${hostPort}`);
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      res.writeHead(404).end('not found');
      return;
    }
    const page = hostPage
      .replaceAll('__GAME_SRC__', `${gameOrigin}${GAME_PATH_PREFIX}index.html`)
      .replaceAll('__ITCH_ALLOW__', ITCH_IFRAME_ALLOW);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // itch.io sends this on game pages (observed 2026-11-02).
      'content-security-policy': "frame-ancestors 'self'",
    });
    res.end(page);
  });

  const game = createServer((req, res) => {
    const url = new URL(req.url ?? '/', gameOrigin);
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('bad url');
      return;
    }
    if (!path.startsWith(GAME_PATH_PREFIX)) {
      // An absolute URL like /assets/x.js lands here, exactly as it would 404 on itch's CDN.
      if (!opts.quiet) console.warn(`[itch-sim] 404 outside game dir (absolute URL?): ${path}`);
      res.writeHead(404).end('not found (absolute URL? itch serves games from a nested path)');
      return;
    }
    const rel = path.slice(GAME_PATH_PREFIX.length);
    if (rel === '' || rel.endsWith('/')) {
      res.writeHead(403).end('forbidden (itch returns 403 for folder URLs)');
      return;
    }
    if (rel.split('/').includes('..') || !existsCaseSensitive(dist, rel)) {
      if (!opts.quiet) console.warn(`[itch-sim] 404 (missing or wrong case): ${rel}`);
      res.writeHead(404).end('not found (itch paths are case sensitive)');
      return;
    }
    const file = join(dist, rel);
    if (statSync(file).isDirectory()) {
      res.writeHead(403).end('forbidden');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(readFileSync(file));
  });

  host.listen(hostPort, 'localhost');
  game.listen(gamePort, '127.0.0.1');
  if (!opts.quiet) {
    if (!existsSync(join(dist, 'index.html'))) {
      console.warn(`[itch-sim] ${dist}/index.html not found yet: run pnpm build.`);
    }
    console.log(`[itch-sim] itch-like page:   http://localhost:${hostPort}/`);
    console.log(`[itch-sim] game (top-level): ${gameOrigin}${GAME_PATH_PREFIX}index.html`);
    console.log('[itch-sim] options: ?autoload=1  ?w=960&h=540  ?allow=none  (see index.html)');
  }
  return {
    hostUrl: `http://localhost:${hostPort}/`,
    gameUrl: `${gameOrigin}${GAME_PATH_PREFIX}index.html`,
    close: () => Promise.all([host, game].map((s) => new Promise((r) => s.close(r)))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const val = (/** @type {string} */ k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const port = Number(val('--port') ?? process.env.ITCH_SIM_PORT ?? 8790);
  startItchSim({ port, dist: val('--dist') });
}
