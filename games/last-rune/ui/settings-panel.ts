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

  const close = button('✕', () => ui.stack.pop('programmatic'), {
    className: 'lr-panel-x',
    ariaLabel: 'Close settings',
  });
  // Phones: the body scrolls natively, with a visible thumb; "Graphics & Save ▾" jumps to the
  // lower sections while they are still below (it reads as "scroll down", not a dropdown).
  const lower: HTMLElement[] = [];
  const jump = phone
    ? button('Graphics & Save ▾', () => cols.scrollTo({ top: lowerTop(), behavior: 'smooth' }), {
        className: 'lr-settings-more',
      })
    : null;
  const track = (e: HTMLElement) => {
    lower.push(e);
    return e;
  };
  const lowerTop = () => Math.max(0, Math.min(...lower.map((e) => e.offsetTop)) - 4);
  const cols = h(
    'div',
    { class: 'lr-settings-cols' },
    h(
      'div',
      { class: 'lr-settings-col' },
      h('section', null, h('h3', null, 'Sound'), ...volumes),
      track(h('section', null, h('h3', null, 'Graphics'), graphics)),
    ),
    h(
      'div',
      { class: 'lr-settings-col' },
      h('section', null, h('h3', null, 'Comfort'), text, motion, flashes, speed),
      track(
        h(
          'section',
          null,
          h('h3', null, 'Save'),
          persistent,
          saveBox,
          h('div', { class: 'lr-row' }, exportBtn, importBtn, phone ? null : resetBtn),
          note,
          // Phones: Reset gets a group of its own, away from Import (D-040, mobile-5-chrome).
          phone
            ? h(
                'div',
                { class: 'lr-settings-danger', role: 'group', 'aria-label': 'Start over' },
                h('h4', null, 'Start over'),
                h('p', null, 'Erases machines and journal pages. Settings stay.'),
                resetBtn,
              )
            : null,
        ),
      ),
    ),
  );
  // Phones: a drawn scroll thumb (iOS hides its own until you scroll) beside the columns.
  const thumb = phone ? h('div', { class: 'lr-settings-thumb' }) : null;
  const rail = thumb ? h('div', { class: 'lr-settings-rail', 'aria-hidden': 'true' }, thumb) : null;
  if (jump && thumb && rail) {
    const sync = () => {
      const max = cols.scrollHeight - cols.clientHeight;
      const below = max - cols.scrollTop > 4;
      cols.toggleAttribute('data-more', below);
      jump.hidden = !below || cols.scrollTop >= lowerTop() - 4;
      rail.hidden = max <= 4;
      if (max > 4) {
        const frac = cols.clientHeight / cols.scrollHeight;
        thumb.style.height = `${frac * 100}%`;
        thumb.style.top = `${(cols.scrollTop / max) * (1 - frac) * 100}%`;
      }
    };
    cols.addEventListener('scroll', sync, { passive: true });
    requestAnimationFrame(sync);
    new ResizeObserver(sync).observe(cols);
    // mobile-5-chrome: the fold falls on a whole row, so no header or control is cut in half
    // under the footer; the thumb and "Graphics & Save ▾" say there is more.
    const fold = () => {
      if (!cols.isConnected) {
        refold.disconnect();
        return;
      }
      cols.style.maxHeight = '';
      const avail = cols.clientHeight;
      if (cols.scrollHeight - avail <= 4) return;
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
      sync();
    };
    const refold = new ResizeObserver(fold);
    requestAnimationFrame(() => {
      fold();
      refold.observe(ui.root);
    });
  }
  const content = h(
    'div',
    // Phones: the panel itself takes focus, so no focus ring sits on the first slider.
    { class: 'lr-settings', tabindex: phone ? '-1' : null },
    phone ? close : null,
    // Two columns so the whole panel, Done included, fits a 720p screen at 100% text.
    rail ? h('div', { class: 'lr-settings-scroll' }, cols, rail) : cols,
    h(
      'div',
      { class: 'lr-row lr-settings-done' },
      jump,
      button('Done', () => ui.stack.pop('programmatic'), { variant: 'primary' }),
    ),
  );
  ui.stack.push({
    content,
    title: 'Settings',
    modal: true,
    dismissible: true,
    className: 'lr-settings-host',
    ...(phone ? { initialFocus: content } : {}),
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
