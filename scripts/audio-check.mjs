#!/usr/bin/env node
// Render every game sound offline in headless Chromium and check it objectively:
// peak ≤ -1 dBFS, no NaN, no clicks at one-shot edges, seamless loops, tails that ring out.
// Prints a table and render times; exits 1 on any problem.
//
//   pnpm audio:check                 # check
//   pnpm audio:check --out <dir>     # also write report.json and one WAV per sound
//   pnpm audio:check --only gemPlace # names containing a substring
//
// No WebGPU needed: OfflineAudioContext works in the plain headless shell.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const argOf = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = argOf('--out');
const only = argOf('--only');

const server = await createServer({
  configFile: resolve(import.meta.dirname, '../vite.config.ts'),
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5199/';

const browser = await chromium.launch();
let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  // A blank page served by Vite, so the module graph (and @engine/@game aliases) resolve.
  await page.goto(`${url}@vite/client`);
  const report = await page.evaluate(
    async ({ only, wav }) => {
      const m = await import('/games/last-rune/audio/render-check.ts');
      const bank = await import('/games/last-rune/audio/bank.ts');
      const names = only ? bank.renderOrder().filter((n) => n.includes(only)) : undefined;
      return m.runRenderCheck({ names, wav });
    },
    { only, wav: !!outDir },
  );

  const pad = (s, n) => String(s).padEnd(n);
  const num = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
  console.log(
    `${pad('sound', 20)}${pad('bus', 6)}${pad('len s', 7)}${pad('peak dB', 9)}${pad('loud dB', 9)}${pad('rms dB', 8)}${pad('ms', 7)}edge/seam`,
  );
  for (const r of report.rows) {
    const m = r.metrics;
    const edge = r.loop
      ? `seam ×${num(m.seamRatio, 2)} ${num(m.seamLevelDb, 2)}dB (material ${num(m.materialJumpDb, 1)})`
      : `in ${m.startAbs.toExponential(0)} out ${m.endAbs.toExponential(0)} tail ${num(m.tailDb, 0)}dB`;
    console.log(
      `${pad(r.name, 20)}${pad(r.bus, 6)}${pad(num(m.duration, 2), 7)}${pad(num(m.peakDb, 2), 9)}${pad(num(m.loudDb), 9)}${pad(num(m.rmsDb), 8)}${pad(num(r.renderMs, 0), 7)}${edge}${r.problems.length ? `  ✗ ${r.problems.join('; ')}` : ''}`,
    );
  }
  const maxPeak = Math.max(...report.rows.map((r) => r.metrics.peakDb));
  console.log(
    `\n${report.rows.length} sounds · ${report.failures} with problems · max peak ${maxPeak.toFixed(2)} dBFS` +
      ` · render ${report.sequentialMs.toFixed(0)} ms sequential, ${report.parallelMs.toFixed(0)} ms concurrent` +
      ` · ${(report.bytes / 1048576).toFixed(1)} MiB decoded`,
  );
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const [name, b64] of Object.entries(report.wavs ?? {}))
      writeFileSync(join(outDir, `${name}.wav`), Buffer.from(b64, 'base64'));
    const { wavs: _w, ...rest } = report;
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(rest, null, 2));
    console.log(`wrote ${outDir}`);
  }
  if (report.failures > 0) exitCode = 1;
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(exitCode);
