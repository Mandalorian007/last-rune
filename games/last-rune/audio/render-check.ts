/**
 * In-browser render check (dev tooling, never imported by the game): renders every bank
 * entry offline, measures it with `analyze`, and times it. Driven headless by
 * `scripts/audio-check.mjs` (Playwright) and shown in the `?demo=audio` panel.
 */
import { analyze, encodeWav, type Limits, problems, type SoundMetrics } from './analyze';
import { BANK, isLoop, renderOrder } from './bank';
import { renderDef } from './render';

export interface CheckRow {
  name: string;
  loop: boolean;
  bus: string;
  /** Wall time to render this sound alone, ms. */
  renderMs: number;
  metrics: SoundMetrics;
  problems: string[];
}

export interface CheckReport {
  rows: CheckRow[];
  /** Sum of per-sound render times (sequential), ms. */
  sequentialMs: number;
  /** Wall time to render the whole bank concurrently (what `prepare()` does), ms. */
  parallelMs: number;
  /** Total decoded size of all buffers, bytes (Float32). */
  bytes: number;
  failures: number;
  /** Base64 WAVs by name, if requested. */
  wavs?: Record<string, string>;
}

/** Per-sound limit overrides, with the reason. */
const LIMIT_OVERRIDES: Record<string, Partial<Limits>> = {
  // Quiet by design (UI hover sits well under everything).
  uiHover: { minPeakDb: -16 },
};

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function runRenderCheck(
  opts: { names?: readonly string[]; wav?: boolean } = {},
): Promise<CheckReport> {
  const names = opts.names ?? renderOrder();
  const rows: CheckRow[] = [];
  const wavs: Record<string, string> = {};
  let bytes = 0;
  for (const name of names) {
    const def = BANK[name];
    if (!def) throw new Error(`unknown sound ${name}`);
    const t0 = performance.now();
    const buf = await renderDef(def);
    const renderMs = performance.now() - t0;
    const chans: Float32Array[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    const loop = isLoop(def);
    const metrics = analyze(chans, buf.sampleRate, loop);
    rows.push({
      name,
      loop,
      bus: def.bus,
      renderMs,
      metrics,
      problems: problems(metrics, loop, LIMIT_OVERRIDES[name]),
    });
    bytes += buf.length * buf.numberOfChannels * 4;
    if (opts.wav) wavs[name] = toBase64(encodeWav(chans, buf.sampleRate));
  }
  const t1 = performance.now();
  await Promise.all(names.map((n) => renderDef(BANK[n]!)));
  const parallelMs = performance.now() - t1;
  return {
    rows,
    sequentialMs: rows.reduce((a, r) => a + r.renderMs, 0),
    parallelMs,
    bytes,
    failures: rows.filter((r) => r.problems.length).length,
    ...(opts.wav ? { wavs } : {}),
  };
}
