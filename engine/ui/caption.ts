import { h } from './dom';
import { prefersReducedMotion } from './styles';

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface ReadingTimeOptions {
  /** Base time added to every line. Default 1200 ms. */
  baseMs?: number;
  /** Per character. Default 45 ms (~220 wpm with base). */
  perCharMs?: number;
  /** Floor. Default 2000 ms. */
  minMs?: number;
  /** Ceiling. Default 12000 ms. */
  maxMs?: number;
}

/** How long a line should stay up once fully revealed. Pure. */
export function readingTimeMs(text: string, opts: ReadingTimeOptions = {}): number {
  const { baseMs = 1200, perCharMs = 45, minMs = 2000, maxMs = 12000 } = opts;
  const chars = text.trim().length;
  return Math.round(Math.min(maxMs, Math.max(minMs, baseMs + chars * perCharMs)));
}

/** Delay before revealing the next char: pauses after punctuation. Pure. */
export function revealDelayMs(prev: string, cps: number): number {
  const base = 1000 / cps;
  if (/[.!?…]/.test(prev)) return base * 8;
  if (/[,;:—–]/.test(prev)) return base * 4;
  return base;
}

export interface SayOptions {
  /** Shown above the text (e.g. a name). Omit for none. */
  speaker?: string;
  /** Optional element shown left of the text (a canvas, an svg glyph...). */
  portrait?: Node;
  /** Reveal speed in characters per second. `0` or reduced motion = instant. Default 45. */
  cps?: number;
  /** ms to hold once fully shown; `0` = until clicked / `advance()`. Default `readingTimeMs(text)`. */
  hold?: number;
  /** Called with each revealed character (e.g. to blip a sound). Not called for whitespace. */
  onChar?: (ch: string, index: number) => void;
  /** Override the card's corner for this line. */
  corner?: Corner;
}

export interface CaptionOptions {
  corner?: Corner;
  /** Force reduced motion (default: the user's `prefers-reduced-motion`). */
  reducedMotion?: boolean;
  /** Default reveal speed. */
  cps?: number;
  /** Clicking the card skips the reveal, then advances. Default true. */
  clickToAdvance?: boolean;
}

interface Line {
  text: string;
  opts: SayOptions;
  resolve: () => void;
}

/**
 * A corner speech/caption card with a typewriter reveal and a queue. The full line goes into a
 * polite live region at once (screen readers don't hear the typewriter), and the visible text
 * keeps its final layout from the start (unrevealed chars are `visibility:hidden`) so the card
 * never reflows while typing.
 */
export class CaptionCard {
  readonly element: HTMLElement;
  private readonly portraitEl: HTMLElement;
  private readonly speakerEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly shownEl: HTMLElement;
  private readonly pendingEl: HTMLElement;
  private readonly liveEl: HTMLElement;
  private readonly queue: Line[] = [];
  private current: Line | null = null;
  private revealed = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private phase: 'idle' | 'typing' | 'holding' = 'idle';
  private readonly corner: Corner;
  reducedMotion: boolean;
  cps: number;

  constructor(container: HTMLElement, opts: CaptionOptions = {}) {
    this.corner = opts.corner ?? 'bottom-right';
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion();
    this.cps = opts.cps ?? 45;
    this.portraitEl = h('div', { class: 'tc-caption-portrait', 'aria-hidden': 'true' });
    this.speakerEl = h('div', { class: 'tc-caption-speaker', 'aria-hidden': 'true' });
    this.shownEl = h('span');
    this.pendingEl = h('span', { class: 'tc-caption-pending' });
    this.textEl = h(
      'div',
      { class: 'tc-caption-text', 'aria-hidden': 'true' },
      this.shownEl,
      this.pendingEl,
    );
    this.liveEl = h('div', {
      class: 'tc-sr-only',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    this.element = h(
      'div',
      { class: 'tc-caption', dataset: { corner: this.corner }, hidden: true },
      this.portraitEl,
      h('div', { class: 'tc-caption-body' }, this.speakerEl, this.textEl),
    );
    if (opts.clickToAdvance !== false) this.element.addEventListener('click', () => this.advance());
    container.append(this.element, this.liveEl);
  }

  /** True while a line is showing or queued. */
  get busy(): boolean {
    return this.current !== null;
  }

  get queued(): number {
    return this.queue.length;
  }

  /** Text of the line being shown, or null. */
  get currentText(): string | null {
    return this.current?.text ?? null;
  }

  /** Queue a line; resolves when it's dismissed (held time elapsed, advanced, or cleared). */
  say(text: string, opts: SayOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ text, opts, resolve });
      if (!this.current) this.next();
    });
  }

  /** Skip the typewriter if typing, else dismiss the current line. */
  advance(): void {
    if (this.phase === 'typing') this.finishReveal();
    else if (this.phase === 'holding') this.dismiss();
  }

  /** Drop the queue and hide the card; all pending `say` promises resolve. */
  clear(): void {
    const pending = this.queue.splice(0);
    this.stopTimer();
    const cur = this.current;
    this.current = null;
    this.phase = 'idle';
    this.element.hidden = true;
    cur?.resolve();
    for (const l of pending) l.resolve();
  }

  destroy(): void {
    this.clear();
    this.element.remove();
    this.liveEl.remove();
  }

  private next() {
    const line = this.queue.shift();
    this.stopTimer();
    if (!line) {
      this.current = null;
      this.phase = 'idle';
      this.element.hidden = true;
      return;
    }
    this.current = line;
    this.revealed = 0;
    this.speakerEl.textContent = line.opts.speaker ?? '';
    this.portraitEl.replaceChildren(...(line.opts.portrait ? [line.opts.portrait] : []));
    this.element.dataset.corner = line.opts.corner ?? this.corner;
    this.liveEl.textContent = line.opts.speaker ? `${line.opts.speaker}: ${line.text}` : line.text;
    this.element.hidden = false;
    const cps = line.opts.cps ?? this.cps;
    if (this.reducedMotion || cps <= 0) {
      this.finishReveal();
      return;
    }
    this.phase = 'typing';
    this.render();
    this.tick(cps);
  }

  private tick(cps: number) {
    const line = this.current!;
    const chars = [...line.text];
    if (this.revealed >= chars.length) {
      this.finishReveal();
      return;
    }
    const ch = chars[this.revealed]!;
    this.revealed++;
    this.render();
    if (ch.trim()) line.opts.onChar?.(ch, this.revealed - 1);
    this.timer = setTimeout(() => this.tick(cps), revealDelayMs(ch, cps));
  }

  private finishReveal() {
    const line = this.current;
    if (!line) return;
    this.stopTimer();
    this.revealed = [...line.text].length;
    this.render();
    this.phase = 'holding';
    const hold = line.opts.hold ?? readingTimeMs(line.text);
    if (hold > 0) this.timer = setTimeout(() => this.dismiss(), hold);
  }

  private dismiss() {
    const line = this.current;
    this.stopTimer();
    this.current = null;
    line?.resolve();
    this.next();
  }

  private render() {
    const chars = [...(this.current?.text ?? '')];
    this.shownEl.textContent = chars.slice(0, this.revealed).join('');
    this.pendingEl.textContent = chars.slice(this.revealed).join('');
  }

  private stopTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
