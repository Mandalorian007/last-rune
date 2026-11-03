/**
 * Phone chrome (D-039): the "turn it sideways" card for a phone held upright, and a Full screen
 * button on the title for browsers that allow it (never iPhone Safari, which has no element
 * fullscreen; never an iframe without `allowfullscreen`).
 *
 * The card covers the whole viewport, outside the scaled 1920×1080 overlay (upright, that
 * overlay is a thin strip), and goes the moment the phone turns. Nothing is paused: the game
 * underneath just waits for input.
 */
import {
  fullscreenAvailable,
  isFullscreen,
  isPortrait,
  isTouchOnly,
  toggleFullscreen,
  watchFullscreen,
} from '@engine/platform';
import { button, h } from '@engine/ui';
import type { DeviceMode } from './device-mode';

const CSS = /* css */ `
.lr-rotate {
  position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 22px; padding: max(24px, env(safe-area-inset-top)) 28px;
  box-sizing: border-box; text-align: center; background: radial-gradient(circle at 50% 40%, #1d1530, #07050c 75%);
  color: #f4e6c4; font-family: Georgia, 'Times New Roman', serif; touch-action: none; user-select: none;
  -webkit-user-select: none;
}
.lr-rotate[hidden] { display: none; }
.lr-rotate-phone {
  width: 54px; height: 92px; border: 3px solid #e8c06a; border-radius: 12px; box-sizing: border-box;
  box-shadow: 0 0 24px rgba(232,192,106,0.35); animation: lr-rotate-turn 2.4s ease-in-out infinite;
}
.lr-rotate-phone::after {
  content: ''; display: block; width: 14px; height: 3px; margin: 78px auto 0; border-radius: 2px; background: #e8c06a;
}
@keyframes lr-rotate-turn { 0%, 25% { transform: rotate(0deg); } 55%, 100% { transform: rotate(-90deg); } }
@media (prefers-reduced-motion: reduce) { .lr-rotate-phone { animation: none; transform: rotate(-90deg); } }
.lr-rotate h2 { margin: 0; font-size: 24px; color: #e8c06a; letter-spacing: 1px; font-weight: 600; }
.lr-rotate p { margin: 0; max-width: 300px; font-size: 17px; line-height: 1.45; }
.lr-rotate .lr-rotate-fuse { font-size: 16px; font-style: italic; color: #cbb991; }
.lr-rotate .lr-rotate-fuse b { font-style: normal; color: #e8c06a; letter-spacing: 1px; font-size: 13px; margin-right: 6px; }

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
 * `hudLayer`: the overlay layer the Full screen button lives in. The card is shown when the
 * screen is upright and the game is in phone mode on a touch device (a narrow desktop window
 * never gets "turn your phone").
 */
export function createPhoneChrome(hudLayer: HTMLElement, device: DeviceMode): PhoneChrome {
  const doc = hudLayer.ownerDocument;
  const win = doc.defaultView ?? window;
  if (!doc.querySelector('style[data-lr="phone-chrome"]')) {
    doc.head.append(h('style', { 'data-lr': 'phone-chrome' }, CSS));
  }
  const card = h(
    'div',
    {
      class: 'lr-rotate',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Turn your phone sideways',
      hidden: true,
    },
    h('div', { class: 'lr-rotate-phone', 'aria-hidden': 'true' }),
    h('h2', null, 'Turn your phone sideways'),
    h('p', null, 'The altars are wider than they are tall. The game plays in landscape.'),
    h(
      'p',
      { class: 'lr-rotate-fuse' },
      h('b', null, 'FUSE'),
      'Sideways, visitor. The building was. Regulation 1.',
    ),
  );
  doc.body.append(card);

  let fsWanted = false;
  const fsBtn = button(
    'Full screen',
    () => void toggleFullscreen(doc.documentElement, { lockLandscape: true }),
    {
      className: 'lr-stone-button lr-fullscreen',
    },
  );
  fsBtn.hidden = true;
  hudLayer.append(fsBtn);

  const update = () => {
    const touchy =
      device.touch || isTouchOnly() || win.matchMedia?.('(any-pointer: coarse)').matches;
    card.hidden = !(isPortrait(win) && touchy && device.phone);
    fsBtn.hidden = !(fsWanted && device.phone && fullscreenAvailable(doc) && !isFullscreen(doc));
  };
  const offDevice = device.onChange(update);
  const offFs = watchFullscreen(update, doc);
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
      card.remove();
      fsBtn.remove();
    },
  };
}
