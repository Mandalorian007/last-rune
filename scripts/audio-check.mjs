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
const skipDemo = args.includes('--no-demo') || !!only;

const server = await createServer({
  configFile: resolve(import.meta.dirname, '../vite.config.ts'),
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5199/';

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  // A blank page served by Vite, so the module graph (@game, @thunderclap-engine/engine) resolves.
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

  if (!skipDemo) {
    // Live smoke of the ?demo=audio page: unlock with a click, time the real pre-render, then
    // play the busiest moment in the game (altar, full-power bolt, 4x cell, the solve fanfare
    // over the mood) and read the master peak meter.
    const demo = await browser.newPage();
    const errors = [];
    demo.on('pageerror', (e) => errors.push(e.message));
    demo.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await demo.goto(`${url}?demo=audio`);
    await demo.waitForFunction(() => window.__audioDemo);
    await demo.mouse.click(5, 5);
    const live = await demo.evaluate(async () => {
      const d = window.__audioDemo;
      const prep = await d.prepared;
      const { audio } = d;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const peaks = {};
      const measure = async (label, ms) => {
        d.resetPeak();
        await wait(ms);
        peaks[label] = 20 * Math.log10(Math.max(1e-9, d.peak()));
      };
      audio.music.setMood('hall-t1', { fade: 0.2 });
      await measure('hall-t1 mood', 3000);
      audio.music.setMood('altar-t3', { fade: 0.2 });
      const bolt = audio.sfx.bolt(1);
      const cell = audio.sfx.stormCell(4);
      for (const gem of ['channel', 'bend', 'split', 'amplify', 'gate', 'capacitor'])
        audio.sfx.play('gemPlace', { gem });
      await wait(300);
      for (let i = 0; i < 4; i++)
        audio.sfx.play('boltStep', { gem: 'amplify', charge: 4, delay: i * 0.12 });
      audio.music.duck(0.35, 3);
      audio.sfx.play('machineExact');
      await measure('solve moment', 4000);
      bolt.stop();
      cell.stop();
      audio.music.setMood('ending', { fade: 0.5 });
      audio.sfx.play('endingSwell');
      await measure('ending', 5000);
      audio.music.setMood('silence', { fade: 0.2 });
      return { prep, peaks, state: d.engine.state };
    });
    console.log(
      `\nlive (?demo=audio): state ${live.state} · in-game pre-render ${live.prep.sounds} sounds in ${live.prep.totalMs.toFixed(0)} ms` +
        ` (groups ${live.prep.groupMs.map((m) => m.toFixed(0)).join(' / ')} ms)`,
    );
    for (const [k, v] of Object.entries(live.peaks)) {
      const bad = v > -1;
      console.log(`  master peak, ${k}: ${v.toFixed(2)} dBFS${bad ? '  ✗ > -1 dBFS' : ''}`);
      if (bad) exitCode = 1;
    }
    if (live.state !== 'running') {
      console.log('  ✗ audio did not unlock');
      exitCode = 1;
    }
    if (errors.length) {
      console.log(`  ✗ page errors:\n    ${errors.join('\n    ')}`);
      exitCode = 1;
    }
  }
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(exitCode);
