/** Page visibility + user-preference helpers. */

/** Calls `fn(visible)` whenever the tab is hidden/shown. Returns unsubscribe. */
export function watchVisibility(fn: (visible: boolean) => void): () => void {
  const h = () => fn(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', h);
  return () => document.removeEventListener('visibilitychange', h);
}

const REDUCED = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(REDUCED).matches;
}

/** Calls `fn(reduced)` when the reduced-motion preference changes. Returns unsubscribe. */
export function watchReducedMotion(fn: (reduced: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(REDUCED);
  const h = () => fn(mq.matches);
  mq.addEventListener('change', h);
  return () => mq.removeEventListener('change', h);
}
