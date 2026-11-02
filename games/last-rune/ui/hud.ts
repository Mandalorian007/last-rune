/**
 * Always-there corner buttons (Codex, Settings) plus the hall's name plate.
 * Buttons drop focus after a click so the game's keyboard shortcuts keep
 * working (engine/input ignores keys while a button is focused).
 */
import { h } from '@engine/ui';

export interface HudActions {
  codex(): void;
  settings(): void;
}

export class Hud {
  readonly root: HTMLElement;
  readonly nameplate: HTMLElement;
  private readonly plateName: HTMLElement;
  private readonly plateNote: HTMLElement;

  constructor(layer: HTMLElement, actions: HudActions) {
    const btn = (label: string, key: string, fn: () => void) =>
      h(
        'button',
        {
          type: 'button',
          class: 'lr-stone-button',
          'aria-keyshortcuts': key,
          on: {
            click: (e) => {
              (e.currentTarget as HTMLElement).blur();
              fn();
            },
          },
        },
        label,
        h('kbd', { 'aria-hidden': 'true' }, key),
      );
    this.root = h(
      'div',
      { class: 'lr-hud', hidden: true },
      btn('Codex', 'C', actions.codex),
      btn('Settings', 'O', actions.settings),
    );
    this.plateName = h('span');
    this.plateNote = h('small');
    this.nameplate = h(
      'div',
      { class: 'lr-nameplate', hidden: true, 'aria-live': 'polite' },
      this.plateName,
      this.plateNote,
    );
    layer.append(this.nameplate, this.root);
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }

  /** Show the plate centred above (x, y) in design px; null hides it. */
  plate(at: { x: number; y: number; name: string; note: string } | null): void {
    if (!at) {
      this.nameplate.hidden = true;
      return;
    }
    this.plateName.textContent = at.name;
    this.plateNote.textContent = at.note;
    this.nameplate.style.left = `${at.x}px`;
    this.nameplate.style.top = `${at.y}px`;
    this.nameplate.hidden = false;
  }
}
