/**
 * Settings → Text size (a11y audit finding 14): the three sizes the game offers and how a saved
 * value is read. The scaling itself is the engine's density token `--tc-text-scale`
 * (`applyTextScale`, `scaleFontSizes` in `@thunderclap/engine/ui`); every game stylesheet passes
 * through `scaleFontSizes()` when it is injected, so all overlay text follows it live.
 */
export const TEXT_SCALES = [100, 125, 150] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

/** Normalises a saved value: anything unknown is 100%. */
export function toTextScale(v: unknown): TextScale {
  return TEXT_SCALES.includes(v as TextScale) ? (v as TextScale) : 100;
}
