// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input, isInteractiveTarget, isTextEntryTarget } from './input';

function key(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
}

describe('Input DOM attachment', () => {
  let canvas: HTMLElement;
  let input: Input<'jump' | 'click' | 'zoom'>;

  beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    input = new Input(
      { jump: [{ key: 'Space' }], click: [{ mouse: 0 }], zoom: [{ wheel: 1 }] },
      { getGamepads: () => [] },
    );
    input.attach({ pointerTarget: canvas });
  });

  afterEach(() => {
    input.detach();
    canvas.remove();
    vi.restoreAllMocks();
  });

  it('prevents default only for bound keys', () => {
    const bound = key('keydown', 'Space');
    const unbound = key('keydown', 'KeyQ');
    window.dispatchEvent(bound);
    window.dispatchEvent(unbound);
    expect(bound.defaultPrevented).toBe(true);
    expect(unbound.defaultPrevented).toBe(false);
    input.update();
    expect(input.pressed('jump')).toBe(true);
    expect(input.keyHeld('KeyQ')).toBe(true);
  });

  it('leaves browser shortcuts, focused controls and blocked state alone', () => {
    const withCtrl = key('keydown', 'Space', { ctrlKey: true });
    window.dispatchEvent(withCtrl);
    expect(withCtrl.defaultPrevented).toBe(false);

    const button = document.createElement('button');
    document.body.appendChild(button);
    const onButton = key('keydown', 'Space');
    button.dispatchEvent(onButton);
    expect(onButton.defaultPrevented).toBe(false);
    button.remove();

    input.blocked = () => true;
    const whileBlocked = key('keydown', 'Space');
    window.dispatchEvent(whileBlocked);
    expect(whileBlocked.defaultPrevented).toBe(false);
  });

  it('does not prevent keys when the document lacks focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const e = key('keydown', 'Space');
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('releases keys on window blur', () => {
    window.dispatchEvent(key('keydown', 'Space'));
    input.update();
    window.dispatchEvent(new Event('blur'));
    input.update();
    expect(input.released('jump')).toBe(true);
  });

  it('handles pointer events through the transform', () => {
    input.setPointerTransform((x, y) => ({ x: x + 1000, y: y + 1000 }));
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 5,
        clientY: 6,
        button: 0,
        isPrimary: true,
        bubbles: true,
      }),
    );
    input.update();
    expect(input.pressed('click')).toBe(true);
    expect(input.pointer).toMatchObject({ x: 1005, y: 1006, inside: true, down: true });
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, isPrimary: true }));
    input.update();
    expect(input.released('click')).toBe(true);
  });

  it('prevents wheel scroll only when wheel is bound', () => {
    const w = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true });
    canvas.dispatchEvent(w);
    expect(w.defaultPrevented).toBe(true);
    input.update();
    expect(input.pointer.wheelY).toBe(48);
    expect(input.pressed('zoom')).toBe(true);
  });

  it('sets and restores touch-action', () => {
    expect(canvas.style.touchAction).toBe('none');
    input.detach();
    expect(canvas.style.touchAction).toBe('');
    window.dispatchEvent(key('keydown', 'Space'));
    input.update();
    expect(input.pressed('jump')).toBe(false);
  });

  it('registers global keys on buttons but not in text entry', () => {
    input.setGlobalKeys(['KeyC', 'Space']);
    const button = document.createElement('button');
    const text = document.createElement('input');
    document.body.append(button, text);
    const onButton = key('keydown', 'KeyC');
    button.dispatchEvent(onButton);
    expect(input.keyHeld('KeyC')).toBe(true);
    expect(onButton.defaultPrevented).toBe(false);
    // Bound + global on a button: counts, but the button keeps its default action.
    const space = key('keydown', 'Space');
    button.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    input.update();
    expect(input.pressed('jump')).toBe(true);
    window.dispatchEvent(key('keyup', 'Space'));
    window.dispatchEvent(key('keyup', 'KeyC'));
    text.dispatchEvent(key('keydown', 'KeyC'));
    expect(input.keyHeld('KeyC')).toBe(false);
    // Non-global keys on a button are still ignored.
    button.dispatchEvent(key('keydown', 'KeyQ'));
    expect(input.keyHeld('KeyQ')).toBe(false);
    button.remove();
    text.remove();
  });

  it('accepts global keys from options', () => {
    const other = new Input(
      { codex: [{ key: 'KeyC' }] },
      {
        getGamepads: () => [],
        globalKeys: ['KeyC'],
      },
    );
    const el = document.createElement('a');
    other.attach({ pointerTarget: canvas, keyTarget: el });
    el.dispatchEvent(key('keydown', 'KeyC'));
    other.update();
    expect(other.pressed('codex')).toBe(true);
    other.detach();
  });

  it('classifies text-entry targets', () => {
    const t = (tag: string, type?: string) => {
      const el = document.createElement(tag);
      if (type) el.setAttribute('type', type);
      return isTextEntryTarget(el);
    };
    expect(t('input')).toBe(true);
    expect(t('input', 'search')).toBe(true);
    expect(t('input', 'checkbox')).toBe(false);
    expect(t('textarea')).toBe(true);
    expect(t('button')).toBe(false);
    expect(t('a')).toBe(false);
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    expect(isTextEntryTarget(ce)).toBe(ce.isContentEditable);
  });

  it('classifies interactive targets', () => {
    expect(isInteractiveTarget(document.createElement('input'))).toBe(true);
    expect(isInteractiveTarget(document.createElement('div'))).toBe(false);
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    expect(isInteractiveTarget(div)).toBe(true);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});
