// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptionCard, readingTimeMs, revealDelayMs } from './caption';
import { h } from './dom';
import { createOverlay, type Overlay } from './overlay';
import { themeToCss, tokenVar } from './theme';
import { Toaster } from './toast';
import { button, slider } from './widgets';

const key = (k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(e);
  return e;
};

describe('theme', () => {
  it('maps token names to custom properties', () => {
    expect(tokenVar('colorAccent')).toBe('--tc-color-accent');
    expect(tokenVar('fontSizeXl')).toBe('--tc-font-size-xl');
    expect(tokenVar('space1')).toBe('--tc-space-1');
    expect(themeToCss({ colorText: '#fff' })).toBe('--tc-color-text: #fff;');
  });
});

describe('overlay', () => {
  let parent: HTMLElement;
  let ov: Overlay;
  beforeEach(() => {
    document.body.innerHTML = '';
    parent = h('div');
    document.body.append(parent);
    ov = createOverlay({ parent, caption: { reducedMotion: true } });
  });
  afterEach(() => ov.destroy());

  it('mounts layers, injects styles once, applies theme vars', () => {
    expect(parent.querySelector('.tc-overlay')).toBe(ov.root);
    expect(Object.keys(ov.layers)).toEqual(['hud', 'panels', 'captions', 'toasts']);
    createOverlay({ parent }).destroy();
    expect(document.querySelectorAll('#tc-ui-base').length).toBe(1);
    expect(ov.root.style.getPropertyValue('--tc-color-accent')).toBeTruthy();
  });

  it('scales and centres into the letterbox rect; maps client coords', () => {
    ov.setRect({ x: 10, y: 20, width: 960, height: 540 });
    expect(ov.scale).toBe(0.5);
    expect(ov.root.style.transform).toBe('translate(10px, 20px) scale(0.5)');
    expect(ov.clientToDesign(10 + 480, 20 + 270)).toEqual({ x: 960, y: 540 });
    expect(ov.clientToDesign(0, 0)).toBeNull();
    ov.setRect({ x: 0, y: 0, width: 1000, height: 540 }); // wider than 16:9
    expect(ov.root.style.transform).toBe('translate(20px, 0px) scale(0.5)');
  });

  it('modal panels: focus first control, trap Tab, Esc closes and restores focus', () => {
    const opener = button('open', () => {});
    ov.layers.hud.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const a = button('A', () => {});
    const b = button('B', () => {});
    const p = ov.stack.push({ title: 'Settings', content: h('div', null, a, b), onClose });
    expect(p.element.getAttribute('role')).toBe('dialog');
    expect(p.element.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.activeElement).toBe(a);
    expect(ov.stack.hasModal).toBe(true);
    expect(ov.layers.hud.inert).toBe(true);

    b.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(b);

    const esc = key('Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledWith('escape');
    expect(ov.stack.size).toBe(0);
    expect(ov.stack.hasModal).toBe(false);
    expect(ov.layers.hud.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('stacks panels: lower ones go inert; non-dismissible ignores Esc', () => {
    const first = ov.stack.push({ title: 'One', content: button('x', () => {}) });
    const second = ov.stack.push({
      title: 'Two',
      content: button('y', () => {}),
      dismissible: false,
    });
    expect(first.element.closest('.tc-panel-host')!.hasAttribute('inert')).toBe(true);
    key('Escape');
    expect(ov.stack.size).toBe(2);
    second.close();
    expect(first.element.closest('.tc-panel-host')!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.textContent).toBe('x');
    const changes = vi.fn();
    ov.stack.onChange(changes);
    ov.stack.clear();
    expect(changes).toHaveBeenCalled();
    expect(ov.stack.size).toBe(0);
  });

  it('non-modal panels do not block or trap', () => {
    ov.stack.push({ label: 'Journal', content: h('p', null, 'hi'), modal: false });
    expect(ov.stack.hasModal).toBe(false);
    expect(ov.layers.hud.inert).toBe(false);
    expect(key('Tab').defaultPrevented).toBe(false);
  });

  it('backdrop click closes dismissible modals', () => {
    const onClose = vi.fn();
    const p = ov.stack.push({ title: 'T', content: h('p'), onClose });
    (p.element.parentElement!.querySelector('.tc-backdrop') as HTMLElement).click();
    expect(onClose).toHaveBeenCalledWith('backdrop');
  });
});

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('auto-dismisses, caps count, lives in a polite region', () => {
    const host = h('div');
    const t = new Toaster(host, 2);
    expect(t.element.getAttribute('aria-live')).toBe('polite');
    t.show('a', { duration: 1000 });
    t.show('b', { duration: 0, tone: 'warn' });
    t.show('c');
    expect(t.count).toBe(2);
    expect(t.element.textContent).toBe('bc');
    vi.advanceTimersByTime(4000);
    expect(t.element.textContent).toBe('b');
    (t.element.firstChild as HTMLElement).click();
    expect(t.count).toBe(0);
  });
});

describe('caption card', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reading time and reveal pacing are sane', () => {
    expect(readingTimeMs('Hi')).toBe(2000);
    expect(readingTimeMs('x'.repeat(1000))).toBe(12000);
    expect(readingTimeMs('x'.repeat(100))).toBe(1200 + 4500);
    expect(revealDelayMs('.', 50)).toBeGreaterThan(revealDelayMs('a', 50));
  });

  it('types out, holds, then resolves and hides; live region gets the full line up front', async () => {
    const host = h('div');
    const card = new CaptionCard(host, { reducedMotion: false, cps: 100 });
    const chars: string[] = [];
    const done = vi.fn();
    card.say('Hi you', { speaker: 'FUSE', hold: 500, onChar: (c) => chars.push(c) }).then(done);
    const live = host.querySelector('[aria-live]')!;
    expect(live.textContent).toBe('FUSE: Hi you');
    expect(card.element.hidden).toBe(false);
    const text = card.element.querySelector('.tc-caption-text')!;
    expect(text.textContent).toBe('Hi you'); // layout reserved
    expect(text.querySelector('.tc-caption-pending')!.textContent!.length).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(text.querySelector('.tc-caption-pending')!.textContent).toBe('');
    expect(chars.join('')).toBe('Hiyou');
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toHaveBeenCalled();
    expect(card.element.hidden).toBe(true);
  });

  it('click skips typing, second click advances to the queued line', async () => {
    const host = h('div');
    const card = new CaptionCard(host, { reducedMotion: false, cps: 10 });
    const first = vi.fn();
    card.say('A long line', { hold: 0 }).then(first);
    card.say('Next', { hold: 0 });
    expect(card.queued).toBe(1);
    card.element.click();
    expect(card.element.querySelector('.tc-caption-pending')!.textContent).toBe('');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(first).not.toHaveBeenCalled(); // hold 0 waits for a click
    card.element.click();
    await Promise.resolve();
    expect(first).toHaveBeenCalled();
    expect(card.currentText).toBe('Next');
    card.clear();
    expect(card.busy).toBe(false);
  });

  it('reduced motion shows the line at once', () => {
    const host = h('div');
    const card = new CaptionCard(host, { reducedMotion: true });
    const onChar = vi.fn();
    card.say('Instant.', { onChar });
    expect(card.element.querySelector('.tc-caption-pending')!.textContent).toBe('');
    expect(onChar).not.toHaveBeenCalled();
  });
});

describe('widgets', () => {
  it('slider reports values and aria-valuetext', () => {
    const fn = vi.fn();
    const s = slider('Music', 0.5, fn, { format: (v) => `${Math.round(v * 100)}%` });
    expect(s.input.getAttribute('aria-valuetext')).toBe('50%');
    s.input.value = '0.25';
    s.input.dispatchEvent(new Event('input'));
    expect(fn).toHaveBeenCalledWith(0.25);
    expect(s.input.getAttribute('aria-valuetext')).toBe('25%');
  });
});
