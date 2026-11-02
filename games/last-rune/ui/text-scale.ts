/**
 * Text size (Settings → Text size, a11y audit finding 14). One CSS variable on the overlay root,
 * `--lr-text-scale` (1, 1.25 or 1.5), and every game stylesheet passes through
 * `scaleFontSizes()` when it is injected, so all overlay text follows it live.
 *
 * Small text scales fully. Large display text (titles, the journal hand) is already big, so it
 * only grows as far as needed to stay at least as large as scaled body text: a size N becomes
 * max(N, min(N, 30) × scale). At 150%, 24 px → 36, 30 → 45, 40 → 45, 56 → 56.
 */
export const TEXT_SCALES = [100, 125, 150] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const TEXT_SCALE_VAR = '--lr-text-scale';

/** Sizes up to this scale fully; above it, text is only kept from falling behind. */
const BODY_PX = 30;

/** The scaled value of `px` at `scale` (1 = 100%). */
export function scaledPx(px: number, scale: number): number {
  return Math.max(px, Math.min(px, BODY_PX) * scale);
}

/** A CSS length for `px` that follows `--lr-text-scale`. */
export function scalePxCss(px: number): string {
  const v = `var(${TEXT_SCALE_VAR}, 1)`;
  if (px <= BODY_PX) return `calc(${px}px * ${v})`;
  if (px < BODY_PX * 1.5) return `max(${px}px, calc(${BODY_PX}px * ${v}))`;
  return `${px}px`;
}

/** Rewrites every `font-size: Npx` (and `font: … Npx/…` shorthand) in a stylesheet. */
export function scaleFontSizes(css: string): string {
  return css
    .replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_, n: string) => `font-size: ${scalePxCss(+n)}`)
    .replace(
      /(\bfont:\s*(?:\d{3}\s+)?)(\d+(?:\.\d+)?)px(?=\s*\/|\s)/g,
      (_, pre: string, n: string) => `${pre}${scalePxCss(+n)}`,
    );
}

/** Engine theme font tokens at a text scale (the engine's own captions, panels and buttons). */
export function textScaleTokens(scale: number): Record<string, string> {
  const base = { fontSizeS: 24, fontSizeM: 30, fontSizeL: 40, fontSizeXl: 56, fontSizeXxl: 84 };
  const out: Record<string, string> = {};
  for (const [k, px] of Object.entries(base)) out[k] = `${Math.round(scaledPx(px, scale))}px`;
  return out;
}

/** Normalises a saved value: anything unknown is 100%. */
export function toTextScale(v: unknown): TextScale {
  return TEXT_SCALES.includes(v as TextScale) ? (v as TextScale) : 100;
}

/** Sets the text scale on the overlay root (and the engine's font tokens to match). */
export function applyTextScale(
  root: HTMLElement,
  scale: TextScale,
  setTheme: (t: Record<string, string>) => void,
): void {
  const s = scale / 100;
  root.style.setProperty(TEXT_SCALE_VAR, String(s));
  if (scale === 100) delete root.dataset.textScale;
  else root.dataset.textScale = String(scale);
  setTheme(textScaleTokens(s));
}
