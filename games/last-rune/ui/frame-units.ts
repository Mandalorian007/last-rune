/**
 * Design px on the overlay's frame (ws/one-overlay). The overlay is laid out in CSS px; its
 * `hud` and `captions` layers cover the canvas, and there `--tc-unit` is one design px of the
 * 1920×1080 frame (`--tc-dpx`). World-anchored DOM (door plates, the altar's labels, the journal's
 * spread) is placed at its design coordinates times that unit, the same point
 * `surface.logicalToClient` gives, and follows every resize without JS. In the layout's regions
 * (phones) the unit is 1 CSS px.
 */

/** `n` design px as a CSS length on the frame's layers (inline styles and custom properties). */
export const dpx = (n: number): string => `calc(${n} * var(--tc-unit, 1px))`;

/** CSS px per design px of the frame, as seen from `el` (inside the overlay; else 1). */
export const frameScale = (el: Element): number => {
  const view = el.ownerDocument.defaultView;
  return Number.parseFloat(view?.getComputedStyle(el).getPropertyValue('--tc-dpx') ?? '') || 1;
};

/** The design px in a `dpx()` length (or a plain px one), e.g. read back from an inline style. */
export const dpxOf = (len: string): number => {
  const m = /^calc\((-?[\d.]+(?:e-?\d+)?) \*/.exec(len);
  return m ? Number(m[1]) : Number.parseFloat(len) || 0;
};
