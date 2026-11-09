/**
 * Top-level error guard (harden-app, D-053). An uncaught error or unhandled rejection from the
 * game's own code shows one calm, styled card instead of leaving the player with a canvas that
 * may have stopped: the save is flushed first, then the card offers Reload (and Keep playing
 * when the game is still running). Shown at most once per page; later errors only reach the
 * console. Noise that is not ours (extensions, cross-origin "Script error.", ResizeObserver
 * loop notices, benign media aborts) never shows it.
 *
 * Boot failures (`main()` rejecting) go through `report(err, { fatal: true })`: Reload only.
 */
import { showMessageScreen } from '@thunderclap-engine/engine/platform';

export interface CrashGuardOptions {
  /** Where the card mounts (`#app`). */
  root: HTMLElement;
  /** Eyebrow: the game's title. */
  title: string;
  /** Write pending progress now; returns whether it reached real storage. */
  flush?: () => boolean;
  /** Reload the page (tests stub it). Default `location.reload()`. */
  reload?: () => void;
  win?: Window;
}

export interface CrashGuard {
  /** Show the card for `err` (once). `fatal`: the game is not running, so Reload only. */
  report(err: unknown, opts?: { fatal?: boolean }): void;
  /** Whether the card has been shown on this page. */
  readonly shown: boolean;
  dispose(): void;
}

const EXTENSION = /^[a-z-]*extension:\/\//;
const NOISE = [/ResizeObserver loop/, /^Script error\.?$/];
const BENIGN_NAMES = new Set(['AbortError', 'NotAllowedError']);

/** Is a script URL someone else's: a browser extension or another web origin? */
function foreign(url: string, origin: string): boolean {
  if (EXTENSION.test(url)) return true;
  return /^https?:\/\//.test(url) && !url.startsWith(`${origin}/`);
}

/** Is this window `error` event from the game (not an extension or a cross-origin script)? */
export function isGameError(ev: Pick<ErrorEvent, 'message' | 'filename'>, origin: string): boolean {
  const msg = ev.message ?? '';
  if (NOISE.some((re) => re.test(msg))) return false;
  return !foreign(ev.filename ?? '', origin);
}

/** Is this unhandled rejection reason from the game? */
export function isGameRejection(reason: unknown, origin: string): boolean {
  if (typeof reason !== 'object' || reason === null) return true;
  const r = reason as { name?: unknown; stack?: unknown };
  if (typeof r.name === 'string' && BENIGN_NAMES.has(r.name)) return false;
  // The first script URL in the stack says whose code it was.
  const first = typeof r.stack === 'string' ? r.stack.match(/[a-z-]+:\/\/[^\s)]+/)?.[0] : null;
  return !(first && foreign(first, origin));
}

export function installCrashGuard(opts: CrashGuardOptions): CrashGuard {
  const win = opts.win ?? window;
  const origin = win.location.origin;
  let shown = false;

  const report = (_err: unknown, r: { fatal?: boolean } = {}) => {
    if (shown) return;
    // Another fatal card (no WebGPU, device lost) already says what to do.
    if (opts.root.querySelector('.engine-msg')) return;
    shown = true;
    let saved = false;
    try {
      saved = opts.flush?.() ?? false;
    } catch {
      saved = false;
    }
    const reload = opts.reload ?? (() => win.location.reload());
    const actions = [{ label: 'Reload', onClick: reload }];
    let close = () => {};
    if (!r.fatal) {
      actions.push({
        label: 'Keep playing',
        onClick: () => {
          close();
          (opts.root.querySelector('canvas') as HTMLCanvasElement | null)?.focus();
        },
      });
    }
    close = showMessageScreen(opts.root, {
      eyebrow: opts.title,
      heading: 'Something went wrong',
      body: [
        r.fatal
          ? 'The game hit an unexpected error while starting.'
          : 'The game hit an unexpected error.',
        saved
          ? 'Your progress is saved. Reloading the page picks up where you left off.'
          : 'Reloading the page usually fixes it.',
      ],
      actions,
    });
  };

  const onError = (ev: ErrorEvent) => {
    if (isGameError(ev, origin)) report(ev.error ?? ev.message);
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (isGameRejection(ev.reason, origin)) report(ev.reason);
  };
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  return {
    report,
    get shown() {
      return shown;
    },
    dispose() {
      win.removeEventListener('error', onError);
      win.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
