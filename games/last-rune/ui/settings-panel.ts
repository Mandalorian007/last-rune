/**
 * Settings panel: volumes (engine/audio mixer, persisted in its own slot),
 * reduced motion, reduce flashes, caption speed, save export/import, reset progress (confirm).
 */
import type { AudioEngine, BusName } from '@thunderclap/engine/audio';
import type { Host } from '@thunderclap/engine/host';
import { button, h, type Overlay, slider } from '@thunderclap/engine/ui';
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
  /**
   * Copies the exported save code (Clipboard API, `execCommand`, or the selected field).
   * `window` is only there in the desktop shell, which adds a Quit button (D-042).
   */
  readonly host: Pick<Host, 'copyText' | 'window'>;
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

/** The rows a phone's Settings fold may end on (mobile-5-chrome). */
const ROWS = 'h3, .tc-field, .lr-choice, .lr-save-box, .lr-row, .lr-settings-danger, .lr-note';

const pct = (v: number) => `${Math.round(v * 100)}%`;

function select<T extends string>(
  label: string,
  value: T,
  options: readonly [T, string][],
  onChange: (v: T) => void,
): HTMLElement {
  const sel = h(
    'select',
    { on: { change: (e) => pick((e.target as HTMLSelectElement).value as T) } },
    ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)),
  );
  const field = h('label', { class: 'lr-field' }, h('span', null, label), sel);
  if (options.length > 4) return field;
  // Phones show a segmented toggle instead of the select (mobile-3-chrome, D-040: every option
  // in sight and a thumb-sized target each). Both stay in step; CSS shows one of them.
  const segs = options.map(([v, text]) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': String(v === value),
        dataset: { value: v },
        on: { click: () => pick(v) },
      },
      text,
    ),
  );
  const group = h('div', { class: 'lr-seg', role: 'radiogroup', 'aria-label': label }, ...segs);
  function pick(v: T): void {
    sel.value = v;
    for (const b of segs) b.setAttribute('aria-checked', String(b.dataset.value === v));
    onChange(v);
  }
  return h('div', { class: 'lr-choice' }, field, group);
}

export function openSettings(deps: SettingsPanelDeps): void {
  const { ui, audio, save, settings } = deps;
  if (ui.root.querySelector('.lr-settings')) return;
  const phone = ui.root.hasAttribute('data-phone');

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
      // Phones (mobile-5-chrome): "Auto / On / Off"; Auto follows Reduced motion.
      ['auto', phone ? 'Auto' : 'With reduced motion'],
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
    placeholder: phone
      ? 'Tap Export for a code to keep, or paste a code here and tap Import.'
      : 'Export to get a save code, or paste one here and Import.',
  });
  // Phones (mobile-5-chrome): the code sits in a labelled box, not a bare developer field.
  const saveBox = phone
    ? h('label', { class: 'lr-save-box' }, h('span', null, 'Save code'), area)
    : area;
  const note = h('p', { class: 'lr-note', role: 'status' });
  const exportBtn = button('Export save', () => {
    save.flush();
    area.value = save.exportString();
    area.select();
    // Through the host (D-036): the Clipboard API where allowed, else `execCommand` (itch's
    // frame), else the code stays selected in the field for copying by hand.
    void deps.host.copyText(area.value).then((r) => {
      area.select();
      note.textContent = r === 'copied' ? 'Copied to clipboard.' : 'Select the code and copy it.';
    });
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

  const close = button('✕', () => ui.stack.pop('programmatic'), {
    className: 'lr-panel-x',
    ariaLabel: 'Close settings',
  });
  const sound = h('section', null, h('h3', null, 'Sound'), ...volumes);
  const comfort = h('section', null, h('h3', null, 'Comfort'), text, motion, flashes, speed);
  const gfx = h('section', null, h('h3', null, 'Graphics'), graphics);
  const saveSection = h(
    'section',
    null,
    h('h3', null, 'Save'),
    persistent,
    saveBox,
    h('div', { class: 'lr-row' }, exportBtn, importBtn, phone ? null : resetBtn),
    note,
  );
  const col = (...kids: HTMLElement[]) => h('div', { class: 'lr-settings-col' }, ...kids);
  const done = button('Done', () => ui.stack.pop('programmatic'), { variant: 'primary' });
  // Desktop only: a game window needs its own way out. Progress is saved first.
  const win = deps.host.window;
  const quit = win
    ? button(
        'Quit game',
        () => {
          save.flush();
          win.close();
        },
        { className: 'lr-quit' },
      )
    : null;

  if (!phone) {
    // Two columns so the whole panel, Done included, fits a 720p screen at 100% text.
    const cols = h(
      'div',
      { class: 'lr-settings-cols' },
      col(sound, gfx),
      col(comfort, saveSection),
    );
    const content = h(
      'div',
      { class: 'lr-settings' },
      cols,
      h('div', { class: 'lr-row lr-settings-done' }, quit, done),
    );
    ui.stack.push({
      content,
      title: 'Settings',
      modal: true,
      dismissible: true,
      className: 'lr-settings-host',
    });
    return;
  }

  // Phones (mobile-6-chrome): two tabs, "Sound & Comfort" and "Graphics & Save", each a whole
  // view of two columns, so no header is orphaned and nothing hides below a fold. Reset keeps a
  // group of its own, away from Import (D-040, mobile-5-chrome). At 150% text a tab may still
  // run long: it scrolls beside a drawn thumb, its fold on a whole row.
  const danger = h(
    'div',
    { class: 'lr-settings-danger', role: 'group', 'aria-label': 'Start over' },
    h('h4', null, 'Start over'),
    h('p', null, 'Erases machines and journal pages. Settings stay.'),
    resetBtn,
  );
  const pages = [
    { label: 'Sound & Comfort', cols: [col(sound), col(comfort)] },
    { label: 'Graphics & Save', cols: [col(gfx, danger), col(saveSection)] },
  ].map((p, i) => {
    const body = h(
      'div',
      {
        class: 'lr-settings-cols',
        id: `lr-settings-page-${i}`,
        role: 'tabpanel',
        'aria-label': p.label,
        hidden: i > 0,
      },
      ...p.cols,
    );
    const tab = h(
      'button',
      {
        type: 'button',
        class: 'lr-settings-tab',
        role: 'tab',
        'aria-selected': String(i === 0),
        'aria-controls': body.id,
        on: { click: () => show(i) },
      },
      p.label,
    );
    return { body, tab };
  });
  let cols = pages[0]!.body;
  const thumb = h('div', { class: 'lr-settings-thumb' });
  const rail = h('div', { class: 'lr-settings-rail', 'aria-hidden': 'true' }, thumb);
  const sync = () => {
    const max = cols.scrollHeight - cols.clientHeight;
    cols.toggleAttribute('data-more', max - cols.scrollTop > 4);
    rail.hidden = max <= 4;
    if (max > 4) {
      const frac = cols.clientHeight / cols.scrollHeight;
      thumb.style.height = `${frac * 100}%`;
      thumb.style.top = `${(cols.scrollTop / max) * (1 - frac) * 100}%`;
    }
  };
  // mobile-5-chrome: the fold falls on a whole row, so no header or control is cut in half
  // under the footer; the thumb says there is more.
  const fold = () => {
    if (!cols.isConnected) {
      refold.disconnect();
      return;
    }
    cols.style.maxHeight = '';
    const avail = cols.clientHeight;
    if (cols.scrollHeight - avail > 4) {
      // The lowest row end that fits and that no row in either column straddles.
      const rows = [...cols.querySelectorAll<HTMLElement>(ROWS)].map((e) => ({
        top: e.offsetTop,
        bottom: e.offsetTop + e.offsetHeight,
      }));
      let end = 0;
      for (const { bottom } of rows) {
        if (bottom > avail || bottom <= end) continue;
        if (rows.some((r) => r.top < bottom - 1 && r.bottom > bottom + 1)) continue;
        end = bottom;
      }
      // Exactly at the row end: any more shows a sliver of the next row's frame.
      if (end > 0) cols.style.maxHeight = `${Math.ceil(end)}px`;
    }
    sync();
  };
  const refold = new ResizeObserver(fold);
  function show(i: number): void {
    pages.forEach((p, j) => {
      p.body.hidden = j !== i;
      p.tab.setAttribute('aria-selected', String(j === i));
    });
    cols = pages[i]!.body;
    cols.scrollTop = 0;
    fold();
  }
  for (const p of pages) p.body.addEventListener('scroll', sync, { passive: true });
  requestAnimationFrame(() => {
    fold();
    refold.observe(ui.root);
  });
  const content = h(
    'div',
    // The panel itself takes focus, so no focus ring sits on the first slider.
    { class: 'lr-settings', tabindex: '-1' },
    close,
    h(
      'div',
      { class: 'lr-settings-tabs', role: 'tablist', 'aria-label': 'Settings pages' },
      ...pages.map((p) => p.tab),
    ),
    h('div', { class: 'lr-settings-scroll' }, ...pages.map((p) => p.body), rail),
    h('div', { class: 'lr-row lr-settings-done' }, quit, done),
  );
  ui.stack.push({
    content,
    title: 'Settings',
    modal: true,
    dismissible: true,
    className: 'lr-settings-host',
    initialFocus: content,
  });
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
