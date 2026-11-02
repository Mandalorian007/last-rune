/**
 * Settings panel: volumes (engine/audio mixer, persisted in its own slot),
 * reduced motion, reduce flashes, caption speed, save export/import, reset progress (confirm).
 */
import type { AudioEngine, BusName } from '@engine/audio';
import { button, h, type Overlay, slider } from '@engine/ui';
import type { GameSave } from '../game/save';
import type {
  CaptionSpeed,
  GraphicsPref,
  ReducedMotionPref,
  ReduceFlashesPref,
  SettingsController,
} from '../game/settings';

export interface SettingsPanelDeps {
  readonly ui: Overlay;
  readonly audio: AudioEngine;
  readonly save: GameSave;
  readonly settings: SettingsController;
  /** Progress was replaced (import) or wiped (reset): rebuild scenes from the save. */
  readonly onProgressReplaced: (why: 'import' | 'reset') => void;
}

const BUSES: { bus: BusName; label: string }[] = [
  { bus: 'master', label: 'Master volume' },
  { bus: 'music', label: 'Music' },
  { bus: 'sfx', label: 'Effects' },
  { bus: 'ui', label: 'Interface' },
];

import { TEXT_SCALES, type TextScale, toTextScale } from './text-scale';

const pct = (v: number) => `${Math.round(v * 100)}%`;

function select<T extends string>(
  label: string,
  value: T,
  options: readonly [T, string][],
  onChange: (v: T) => void,
): HTMLLabelElement {
  const sel = h(
    'select',
    { on: { change: (e) => onChange((e.target as HTMLSelectElement).value as T) } },
    ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)),
  );
  return h('label', { class: 'lr-field' }, h('span', null, label), sel);
}

export function openSettings(deps: SettingsPanelDeps): void {
  const { ui, audio, save, settings } = deps;
  if (ui.root.querySelector('.lr-settings')) return;

  const volumes = BUSES.map(
    ({ bus, label }) =>
      slider(label, audio.settings[bus].volume, (v) => audio.setVolume(bus, v), { format: pct })
        .element,
  );

  const motion = select<ReducedMotionPref>(
    'Reduced motion',
    settings.stored.reducedMotion,
    [
      ['system', 'Follow system'],
      ['reduce', 'On'],
      ['full', 'Off'],
    ],
    (v) => settings.set({ reducedMotion: v }),
  );
  const flashes = select<ReduceFlashesPref>(
    'Reduce flashes',
    settings.stored.reduceFlashes ?? 'auto',
    [
      ['auto', 'With reduced motion'],
      ['on', 'On'],
      ['off', 'Off'],
    ],
    (v) => settings.set({ reduceFlashes: v }),
  );
  const speed = select<CaptionSpeed>(
    'FUSE text speed',
    settings.stored.captionSpeed,
    [
      ['normal', 'Normal'],
      ['fast', 'Fast'],
      ['instant', 'Instant'],
    ],
    (v) => settings.set({ captionSpeed: v }),
  );
  const text = select<`${TextScale}`>(
    'Text size',
    `${toTextScale(settings.stored.textScale)}`,
    TEXT_SCALES.map((n): [`${TextScale}`, string] => [`${n}`, `${n}%`]),
    (v) => settings.set({ textScale: toTextScale(Number(v)) }),
  );
  const graphics = select<GraphicsPref>(
    'Graphics quality',
    settings.stored.graphics ?? 'auto',
    [
      ['auto', 'Auto'],
      ['high', 'High'],
      ['low', 'Low'],
    ],
    (v) => settings.set({ graphics: v }),
  );

  const area = h('textarea', {
    'aria-label': 'Save code',
    spellcheck: 'false',
    placeholder: 'Export to get a save code, or paste one here and Import.',
  });
  const note = h('p', { class: 'lr-note', role: 'status' });
  const exportBtn = button('Export save', () => {
    save.flush();
    area.value = save.exportString();
    area.select();
    void navigator.clipboard?.writeText(area.value).then(
      () => {
        note.textContent = 'Copied to clipboard.';
      },
      () => {
        note.textContent = 'Select the code and copy it.';
      },
    );
  });
  const importBtn = button('Import save', () => {
    const code = area.value.trim();
    if (!code) {
      note.textContent = 'Paste a save code first.';
      return;
    }
    confirm(ui, 'Import this save? It replaces your current progress.', 'Import', () => {
      const r = save.importString(code);
      if (r.ok) {
        settings.refresh();
        ui.stack.clear();
        ui.toasts.show('Save imported.', { tone: 'success' });
        deps.onProgressReplaced('import');
      } else {
        note.textContent = `That code didn't load (${r.error}).`;
      }
    });
  });
  const resetBtn = button(
    'Reset progress',
    () => {
      confirm(
        ui,
        'Erase all progress? Restored machines, journal pages and stats go. Settings stay.',
        'Erase',
        () => {
          ui.stack.clear();
          deps.onProgressReplaced('reset');
          ui.toasts.show('Progress erased.', { tone: 'warn' });
        },
      );
    },
    { className: 'lr-danger' },
  );

  const persistent = save.persistent
    ? null
    : h(
        'p',
        { class: 'lr-note' },
        'Saving is off in this browser (private mode or storage blocked). Export a code to keep progress.',
      );

  const content = h(
    'div',
    { class: 'lr-settings' },
    h('section', null, h('h3', null, 'Sound'), ...volumes),
    h('section', null, h('h3', null, 'Comfort'), text, motion, flashes, speed),
    h('section', null, h('h3', null, 'Graphics'), graphics),
    h(
      'section',
      null,
      h('h3', null, 'Save'),
      persistent,
      area,
      h('div', { class: 'lr-row' }, exportBtn, importBtn, resetBtn),
      note,
    ),
    h(
      'div',
      { class: 'lr-row' },
      button('Done', () => ui.stack.pop('programmatic'), { variant: 'primary' }),
    ),
  );
  ui.stack.push({ content, title: 'Settings', modal: true, dismissible: true });
}

function confirm(ui: Overlay, message: string, verb: string, onYes: () => void): void {
  const yes = button(
    verb,
    () => {
      handle.close('programmatic');
      onYes();
    },
    { variant: 'primary' },
  );
  const no = button('Cancel', () => handle.close('programmatic'));
  const content = h(
    'div',
    { class: 'lr-confirm' },
    h('p', null, message),
    h('div', { class: 'lr-row' }, no, yes),
  );
  const handle = ui.stack.push({
    content,
    title: 'Are you sure?',
    role: 'alertdialog',
    modal: true,
    dismissible: true,
    initialFocus: no,
  });
}
