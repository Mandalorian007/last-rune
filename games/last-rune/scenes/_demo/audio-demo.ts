/**
 * `?demo=audio` (dev only): audition every game sound and mood, try the bolt and storm-cell
 * loops live, hear FUSE talk at each tier, run the offline render check, and watch a master
 * peak meter. Needs no WebGPU. Exposes `window.__audioDemo` for the Playwright smoke in
 * `scripts/audio-check.mjs`.
 */
import { AudioEngine, gainToDb, type OutputBus } from '@thunderclap/engine/audio';
import { button, createOverlay, h, slider } from '@thunderclap/engine/ui';
import {
  type BoltHandle,
  createGameAudio,
  type FuseMode,
  fuseModeForTier,
  MOOD_IDS,
  type PrepareStats,
  SFX_NAMES,
  type SfxName,
  type StormCellHandle,
} from '../../audio';
import { BANK, isLoop, renderOrder } from '../../audio/bank';
import { runRenderCheck } from '../../audio/render-check';
import { GEM_KINDS, type GemKind } from '../../rules/types';

const FUSE_LINES: { mode: FuseMode; label: string; text: string }[] = [
  {
    mode: fuseModeForTier(1),
    label: 'Tier 1',
    text: 'Needs a magenta. Regulation 12. Someone wrote Regulation 12 while having a day.',
  },
  {
    mode: fuseModeForTier(2),
    label: 'Tier 2',
    text: 'Amber before magenta? This unit does not know why it knows that.',
  },
  { mode: fuseModeForTier(3), label: 'Tier 3', text: 'Set it. Go on. I will hold the light.' },
  {
    mode: fuseModeForTier('ending'),
    label: 'Ending',
    text: 'hello. this unit has arrived somewhere with a great many people in it.',
  },
];

/** `'a:b;c:d'` to a style object for `h` (which takes objects, not strings). */
function css(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  return out;
}

export interface AudioDemoHandle {
  engine: AudioEngine;
  audio: ReturnType<typeof createGameAudio>;
  /** Highest master sample seen since the last reset, linear. */
  peak(): number;
  resetPeak(): void;
  prepared: Promise<PrepareStats>;
}

export function startAudioDemo(root: HTMLElement): AudioDemoHandle {
  const engine = new AudioEngine();
  engine.attach();
  const audio = createGameAudio(engine, { seed: 1 });

  const host = h('div', { style: css('position:fixed;inset:0;background:#0d1016') });
  root.appendChild(host);
  const ui = createOverlay({ parent: host });
  const fitOverlay = () => ui.setRect({ x: 0, y: 0, width: innerWidth, height: innerHeight });
  fitOverlay();
  addEventListener('resize', fitOverlay);

  // ---------------------------------------------------------------- master peak meter
  let analyser: AnalyserNode | null = null;
  let peakSeen = 0;
  const meterText = h('span', {}, 'peak -∞ dBFS');
  const buf = new Float32Array(2048);
  const meter = () => {
    if (!analyser) {
      const master = engine.busNode('master');
      const ctx = engine.context;
      if (master && ctx) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        master.connect(analyser);
      }
    }
    if (analyser) {
      analyser.getFloatTimeDomainData(buf);
      let p = 0;
      for (const v of buf) p = Math.max(p, Math.abs(v));
      peakSeen = Math.max(peakSeen, p);
      meterText.textContent = `now ${gainToDb(p).toFixed(1)} · max ${gainToDb(peakSeen).toFixed(1)} dBFS`;
      meterText.style.color = peakSeen > 0.891 ? '#f77' : '';
    }
    requestAnimationFrame(meter);
  };
  requestAnimationFrame(meter);

  // ---------------------------------------------------------------- layout helpers
  const section = (title: string, ...children: Node[]) =>
    h(
      'section',
      { style: css('margin:0 0 28px') },
      h(
        'h2',
        { style: css('font:600 30px var(--tc-font-ui);margin:0 0 12px;color:#e8c27a') },
        title,
      ),
      h(
        'div',
        { style: css('display:flex;flex-wrap:wrap;gap:10px;align-items:center') },
        ...children,
      ),
    );
  const small = (label: string, fn: () => void) => {
    const b = button(label, fn);
    b.style.minHeight = '56px';
    b.style.fontSize = '22px';
    return b;
  };

  const status = h('div', { style: css('font:22px var(--tc-font-ui);color:#8a93a6') }, '');
  const setStatus = () => {
    status.textContent = `audio: ${engine.state}${engine.state === 'locked' ? ' (click anywhere)' : ''} · mood: ${audio.music.mood}`;
  };
  engine.onStateChange(setStatus);
  setStatus();
  const prepText = h('span', {}, 'pre-render: waiting for unlock');
  audio.ready.then((s) => {
    prepText.textContent = `pre-render: ${s.sounds} sounds in ${s.totalMs.toFixed(0)} ms (groups ${s.groupMs.map((m) => m.toFixed(0)).join(' / ')} ms)`;
  });

  // ---------------------------------------------------------------- sfx
  let gem: GemKind = 'channel';
  let charge = 1;
  const gemSelect = h(
    'select',
    {
      style: css('font:24px var(--tc-font-ui);min-height:56px'),
      on: {
        change: (e: Event) => {
          gem = (e.target as HTMLSelectElement).value as GemKind;
        },
      },
    },
    ...GEM_KINDS.map((g) => h('option', { value: g }, g)),
  );
  const chargeSlider = slider(
    'charge',
    1,
    (v) => {
      charge = v;
    },
    { min: 0.25, max: 8, step: 0.25, format: (v) => `${v}×` },
  );
  const sfxButtons = SFX_NAMES.map((name: SfxName) =>
    small(name, () => {
      audio.sfx.play(name as 'boltStep', { gem, charge });
      setStatus();
    }),
  );

  // ---------------------------------------------------------------- loops
  let bolt: BoltHandle | null = null;
  let intensity = 0.3;
  const boltBtn = small('bolt: start', () => {
    if (bolt) {
      bolt.stop();
      bolt = null;
      boltBtn.textContent = 'bolt: start';
    } else {
      bolt = audio.sfx.bolt(intensity);
      boltBtn.textContent = 'bolt: stop';
    }
  });
  const intensitySlider = slider(
    'bolt intensity',
    intensity,
    (v) => {
      intensity = v;
      bolt?.setIntensity(v);
    },
    { min: 0, max: 1, step: 0.01 },
  );
  let cell: StormCellHandle | null = null;
  const cellButtons = ([1, 2, 4] as const).map((s) =>
    small(`storm cell ${s}×`, () => {
      if (cell) cell.setStrength(s);
      else cell = audio.sfx.stormCell(s);
    }),
  );
  const cellStop = small('storm cell off', () => {
    cell?.stop();
    cell = null;
  });

  // ---------------------------------------------------------------- moods
  const moodButtons = MOOD_IDS.map((id) =>
    small(id, () => {
      audio.music.setMood(id);
      setStatus();
    }),
  );
  const duckBtn = small('duck 2.5 s', () => audio.music.duck(0.35, 2.5));

  // ---------------------------------------------------------------- FUSE
  const fuseButtons = FUSE_LINES.map((l) =>
    small(`FUSE ${l.label} (${l.mode})`, () => {
      ui.caption.clear();
      void ui.caption.say(l.text, { speaker: 'FUSE', onChar: audio.fuse.onChar(l.mode, l.text) });
    }),
  );

  // ---------------------------------------------------------------- raw bank
  const rawButtons = renderOrder()
    .filter((n) => !isLoop(BANK[n]!))
    .map((n) => small(n, () => engine.play(n, { bus: BANK[n]!.bus })));
  const loopVoices = new Map<string, ReturnType<AudioEngine['loop']>>();
  const loopButtons = renderOrder()
    .filter((n) => isLoop(BANK[n]!))
    .map((n) => {
      const b = small(`⟳ ${n}`, () => {
        const v = loopVoices.get(n);
        if (v) {
          v.stop(0.5);
          loopVoices.delete(n);
          b.style.outline = '';
        } else {
          loopVoices.set(n, engine.loop(n, { bus: BANK[n]!.bus as OutputBus }));
          b.style.outline = '2px solid #e8c27a';
        }
      });
      return b;
    });

  // ---------------------------------------------------------------- mixer
  const mixer = (['master', 'music', 'sfx', 'ui'] as const).map(
    (bus) =>
      slider(bus, engine.settings[bus].volume, (v) => engine.setVolume(bus, v), {
        min: 0,
        max: 1,
        step: 0.01,
      }).element,
  );

  // ---------------------------------------------------------------- render check
  const checkOut = h('pre', {
    style: css(
      'font:18px/1.35 ui-monospace,monospace;white-space:pre;max-height:520px;overflow:auto;margin:0;color:#c9d1e0',
    ),
  });
  const checkBtn = small('run offline render check', async () => {
    checkOut.textContent = 'rendering…';
    const r = await runRenderCheck();
    const lines = r.rows.map(
      (row) =>
        `${row.name.padEnd(20)} ${row.metrics.peakDb.toFixed(2).padStart(7)} dB  ${row.renderMs
          .toFixed(0)
          .padStart(4)} ms  ${row.problems.length ? `✗ ${row.problems.join('; ')}` : 'ok'}`,
    );
    const maxPeak = Math.max(...r.rows.map((x) => x.metrics.peakDb));
    checkOut.textContent = `${r.rows.length} sounds · ${r.failures} with problems · max peak ${maxPeak.toFixed(2)} dBFS · ${r.sequentialMs.toFixed(0)} ms sequential / ${r.parallelMs.toFixed(0)} ms concurrent\n\n${lines.join('\n')}`;
  });

  const panel = h(
    'div',
    {
      class: 'tc-interactive',
      style: css(
        'position:absolute;inset:24px;overflow:auto;padding:28px 36px;background:rgba(18,22,30,.92);border-radius:16px;font-family:var(--tc-font-ui)',
      ),
    },
    h(
      'h1',
      { style: css('font:700 40px var(--tc-font-body);margin:0 0 8px') },
      'The Last Rune · audio',
    ),
    h(
      'div',
      { style: css('display:flex;gap:28px;font:22px var(--tc-font-ui);margin:0 0 20px') },
      status,
      prepText,
      meterText,
      small('reset peak', () => {
        peakSeen = 0;
      }),
    ),
    section('Game sfx', gemSelect, chargeSlider.element, ...sfxButtons),
    section('Bolt and storm cells', boltBtn, intensitySlider.element, ...cellButtons, cellStop),
    section('Moods (music.setMood)', ...moodButtons, duckBtn),
    section('FUSE', ...fuseButtons),
    section('Every one-shot in the bank', ...rawButtons),
    section('Every loop in the bank', ...loopButtons),
    section('Mixer', ...mixer),
    section('Offline render check', checkBtn),
    checkOut,
  );
  ui.layers.hud.appendChild(panel);

  const handle: AudioDemoHandle = {
    engine,
    audio,
    peak: () => peakSeen,
    resetPeak: () => {
      peakSeen = 0;
    },
    prepared: audio.ready,
  };
  (window as unknown as { __audioDemo?: AudioDemoHandle }).__audioDemo = handle;
  return handle;
}
