/**
 * FUSE's corner card: glue between content lines and engine/ui's caption card.
 *
 * - Lines over 20 words are shown as several cards (`cardsOf`, D-015).
 * - `say(…, { interrupt: true })` drops whatever he was saying (hover changes).
 * - The portrait is a hook: art-props' FUSE portrait swaps in via `setPortrait`.
 *   Until then a CSS placeholder (brass disc, one amber eye) stands in.
 * - `avoid(rects)` keeps the card off parts of the screen a scene needs (design px).
 * - `pointAt(spot)` gives the card a tail toward FUSE where he stands in the scene (phones draw
 *   it; mobile-7-hall).
 */

import type { CaptionCard, Corner, Rect } from '@engine/ui';
import { h } from '@engine/ui';
import { cardsOf, type FuseLine } from '../content/lines';

export type PortraitFactory = () => Node;

export interface FuseOptions {
  /** Called per revealed character (e.g. a quiet blip); throttled to every 3rd. */
  onChar?: () => void;
  /**
   * FUSE's voice: given a card's text, returns a per-character handler (the game audio's
   * `fuse.onChar`, which throttles and pitches itself). Takes precedence over `onChar`.
   */
  voice?: (text: string) => ((ch: string, index: number) => void) | undefined;
  /** Words per card right now (phones show a slim bubble; D-015's twenty otherwise). */
  cardWords?: () => number | undefined;
}

export function placeholderPortrait(): Node {
  return h(
    'div',
    { class: 'lr-fuse-portrait', 'aria-hidden': 'true' },
    h('div', { class: 'lr-fuse-eye lr-fuse-eye--live' }),
    h('div', { class: 'lr-fuse-eye lr-fuse-eye--dead' }),
  );
}

export class Fuse {
  private portraitFactory: PortraitFactory = placeholderPortrait;
  private lastId: string | null = null;

  constructor(
    private readonly caption: CaptionCard,
    private readonly opts: FuseOptions = {},
  ) {}

  /** Art swap-in point for the animated portrait. */
  setPortrait(factory: PortraitFactory): void {
    this.portraitFactory = factory;
  }

  /** Id (or text) of the line most recently started. */
  get last(): string | null {
    return this.lastId;
  }

  get speaking(): boolean {
    return this.caption.busy;
  }

  /**
   * Say a content line (or raw text). Resolves when every card has gone.
   * `interrupt` clears the queue first. `hold: 0` waits for a click.
   */
  async say(
    line: FuseLine | string,
    opts: { interrupt?: boolean; hold?: number; corner?: Corner } = {},
  ): Promise<void> {
    const text = typeof line === 'string' ? line : line.text;
    if (opts.interrupt) this.caption.clear();
    this.lastId = typeof line === 'string' ? line : line.id;
    let n = 0;
    const blip = this.opts.onChar
      ? () => {
          if (n++ % 3 === 0) this.opts.onChar!();
        }
      : undefined;
    const cards = cardsOf(text, this.opts.cardWords?.());
    const portrait = this.portraitFactory();
    await Promise.all(
      cards.map((card) =>
        this.caption.say(card, {
          speaker: 'FUSE',
          portrait,
          onChar: this.opts.voice?.(card) ?? blip,
          hold: opts.hold,
          corner: opts.corner,
        }),
      ),
    );
  }

  /** True if this line is the one on screen or queued last. */
  isSaying(line: FuseLine | string): boolean {
    const id = typeof line === 'string' ? line : line.id;
    return this.caption.busy && this.lastId === id;
  }

  /**
   * Keep FUSE's card off these screen regions (1920×1080 design px). The card stays bottom-right
   * if it fits, else narrows, else moves to bottom-left, then the top corners, and never clips
   * its text. Set it in a scene's `enter()`/`resume()` (and again if the layout changes);
   * clear it with `avoid(null)` in `exit()`/`pause()`, since it outlives the scene.
   */
  avoid(regions: Rect | readonly Rect[] | null): void {
    this.caption.avoid(regions);
  }

  /**
   * Point the card's tail at FUSE (design px: his wheels' centre and his height), from the edge
   * of the card that faces him (`inset`: the nearest the tail comes to a corner, design px); null
   * takes the tail away. Call it every frame while he can move;
   * clear it in `exit()`/`pause()`, since the card outlives the scene.
   */
  pointAt(spot: { x: number; y: number; h: number } | null, inset = 18): void {
    const el = this.caption.element;
    if (!spot || el.hidden || !this.caption.busy) {
      if (el.hasAttribute('data-tail')) el.removeAttribute('data-tail');
      return;
    }
    const tail = tailToward(
      { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight },
      spot,
      inset,
    );
    if (!tail) {
      el.removeAttribute('data-tail');
      return;
    }
    if (el.dataset.tail !== tail.side) el.dataset.tail = tail.side;
    el.style.setProperty('--lr-tail-at', `${Math.round(tail.at)}px`);
  }

  hush(): void {
    this.caption.clear();
    this.lastId = null;
  }
}

/**
 * Which edge of a card faces FUSE and where along it (px from that edge's start) the tail
 * goes. His body is the box from his wheels up to his height; a card over him has no tail.
 */
export function tailToward(
  card: Rect,
  spot: { x: number; y: number; h: number },
  inset = 18,
): { side: 'top' | 'bottom' | 'left' | 'right'; at: number } | null {
  const mid = { x: spot.x, y: spot.y - spot.h * 0.55 };
  const right = card.x + card.width;
  const bottom = card.y + card.height;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  // Off one side by more than he is off the top or bottom: the side edge, else top or bottom.
  const dx = mid.x < card.x ? card.x - mid.x : mid.x > right ? mid.x - right : 0;
  const top = spot.y - spot.h;
  const dy = top > bottom ? top - bottom : spot.y < card.y ? card.y - spot.y : 0;
  if (dx === 0 && dy === 0) return null;
  if (dy * 1.5 >= dx) {
    const side = top > bottom ? 'bottom' : 'top';
    return { side, at: clamp(spot.x - card.x, inset, card.width - inset) };
  }
  const side = mid.x < card.x ? 'left' : 'right';
  return { side, at: clamp(mid.y - card.y, inset * 0.7, card.height - inset * 0.7) };
}
