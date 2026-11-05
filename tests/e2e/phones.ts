/**
 * teach-overlay: the short phone. Landscape inside a browser that keeps its address bar and a
 * tab strip on screen (the user's iPhone in Brave, 2026-11-05): about 852×270 CSS px at 3×, a
 * 59 px notch inset each side. The four full-height phones in each spec never met this case.
 */
export const SHORT_PHONE = {
  name: 'short',
  width: 852,
  height: 270,
  inset: 59,
  dpr: 3,
} as const;
