/**
 * Phone chrome (D-039): the "turn it sideways" card for a phone held upright (the engine's
 * `createRotateCard`, with the game's words and colours), and a Full screen button on the title
 * for browsers that allow it (never iPhone Safari, which has no element fullscreen; never an
 * iframe without `allowfullscreen`).
 */
import type { HostFullscreen } from '@thunderclap/engine/host';
import type { DeviceMode } from '@thunderclap/engine/platform';
import { button, createRotateCard, h } from '@thunderclap/engine/ui';

/** The rotate card's words (game copy) and the game's colours for it. */
const ROTATE = {
  title: 'Turn your phone sideways',
  lines: ['The altars are wider than they are tall. The game plays in landscape.'],
  note: { tag: 'FUSE', text: 'Sideways, visitor. The building was. Regulation 1.' },
  colors: {
    background: 'radial-gradient(circle at 50% 40%, #1d1530, #07050c 75%)',
    text: '#f4e6c4',
    accent: '#e8c06a',
    glow: 'rgba(232,192,106,0.35)',
    muted: '#cbb991',
    font: "Georgia, 'Times New Roman', serif",
  },
} as const;

const CSS = /* css */ `
.tc-overlay .lr-fullscreen { position: absolute; left: 28px; top: 24px; pointer-events: auto; }
.tc-overlay .lr-fullscreen[hidden] { display: none; }
`;

export interface PhoneChrome {
  /** Show the Full screen button (the title calls this on enter and off on exit). */
  showFullscreen(on: boolean): void;
  /** Re-check orientation (also runs on every resize). */
  update(): void;
  destroy(): void;
}

/**
 * `hudLayer`: the overlay layer the Full screen button lives in. `fullscreen`: the host's
 * (`ctx.host.fullscreen`). The rotate card shows when the screen is upright on a phone in hand
 * (see `createRotateCard`).
 */
export function createPhoneChrome(
  hudLayer: HTMLElement,
  device: DeviceMode,
  fullscreen: HostFullscreen,
): PhoneChrome {
  const doc = hudLayer.ownerDocument;
  const win = doc.defaultView ?? window;
  if (!doc.querySelector('style[data-lr="phone-chrome"]')) {
    doc.head.append(h('style', { 'data-lr': 'phone-chrome' }, CSS));
  }
  const card = createRotateCard({ ...ROTATE, device, doc });

  let fsWanted = false;
  // iPhone Safari only takes <video> full screen; some versions still report the element API.
  // A press that changes nothing (refused) also retires the button: no dead controls (D-040).
  let fsRefused = /iPhone|iPod/.test(win.navigator.userAgent);
  const fsBtn = button(
    'Full screen',
    () =>
      void fullscreen.toggle({ lockLandscape: true }).then((on) => {
        if (!on) {
          fsRefused = true;
          update();
        }
      }),
    {
      className: 'lr-stone-button lr-fullscreen',
    },
  );
  fsBtn.hidden = true;
  hudLayer.append(fsBtn);

  const update = () => {
    card.update();
    fsBtn.hidden = !(
      fsWanted &&
      device.phone &&
      !fsRefused &&
      fullscreen.available() &&
      !fullscreen.active()
    );
  };
  const offDevice = device.onChange(update);
  const offFs = fullscreen.watch(update);
  win.addEventListener('resize', update);
  win.addEventListener('orientationchange', update);
  update();

  return {
    showFullscreen(on) {
      fsWanted = on;
      update();
    },
    update,
    destroy() {
      offDevice();
      offFs();
      win.removeEventListener('resize', update);
      win.removeEventListener('orientationchange', update);
      card.destroy();
      fsBtn.remove();
    },
  };
}
