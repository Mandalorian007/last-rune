/**
 * Phone chrome on layout regions (D-041 Phase 2, ws/port-chrome). The engine's CSS-px overlay
 * (`ctx.chrome`, `createCssChrome`) is live on phones; desktop and tablets never see it and keep
 * v1.0's scaled overlay untouched.
 *
 * On phones every panel and toast lays out in it (the engine moves those layers), the title's
 * menu and the HUD's ☰ sit in regions in CSS px (`placeWidgets`), and FUSE's caption is docked
 * in `captionLane` on the title and the journal. World-anchored pieces (door plates, the Next ring, the altar, the journal's
 * spread, the ending) stay on the scaled overlay with their own phone rules (phone-styles.ts).
 *
 * Also here: the "turn it sideways" card (the hall, the altar, the solve card, the journal and
 * the ending are landscape art; the title and the panels read upright) and the title's Full
 * screen button.
 */
import type { HostFullscreen } from '@thunderclap/engine/host';
import { type DeviceMode, PHONE_SCALE, type Surface } from '@thunderclap/engine/platform';
import {
  button,
  type CssChrome,
  createRotateCard,
  type LayoutSpec,
  type Overlay,
  type RotateCard,
  type WidgetHandle,
  type WidgetOptions,
} from '@thunderclap/engine/ui';

/**
 * Last Rune's region tracks on phones. Landscape: rails left and right (the ☰ at the top of the
 * right one), Full screen along the top, the title's menu and links along the bottom,
 * FUSE's lane above it, full width so a line runs on two rows at most. Portrait (the title
 * only): the picture in the middle, the menu beneath it, FUSE's lane under that, the links at
 * the bottom for the thumb. Empty tracks collapse.
 */
export const CHROME_LAYOUT: LayoutSpec = {
  // A phone is what the scaled overlay calls one (`device.phone`: the 1920×1080 design fits
  // below PHONE_SCALE), so the CSS-px chrome is live exactly where the phone rules apply and
  // desktop and tablets keep v1.0's overlay.
  classify: ({ width, height, coarsePointer }) => {
    if (width > 0 && height > 0 && Math.min(width / 1920, height / 1080) < PHONE_SCALE) {
      return height > width ? 'phone-portrait' : 'phone-landscape';
    }
    return coarsePointer ? 'tablet' : 'desktop';
  },
  forms: {
    'phone-landscape': {
      columns: [56, 'fill', { frac: 0.26, min: 160, max: 220 }, 64],
      rows: [48, 'fill', { frac: 0.15, min: 48, max: 64 }, 56],
      areas: [
        'left top         top         right',
        'left fill        cardLane    right',
        'left captionLane captionLane right',
        'left bottom      bottom      right',
      ],
    },
    'phone-portrait': {
      columns: [56, 'fill', 64],
      rows: [56, 'fill', { frac: 0.22, min: 150, max: 220 }, { frac: 0.11, min: 72, max: 104 }, 64],
      areas: [
        'top         top         top',
        'left        fill        right',
        'cardLane    cardLane    cardLane',
        'captionLane captionLane captionLane',
        'bottom      bottom      bottom',
      ],
    },
  },
};

/**
 * Scenes whose FUSE caption docks in `captionLane` on phones. Elsewhere it stays the legacy
 * card placed around the world: in the hall and at an altar it steers clear of the doors, the
 * Next ring and the tray and points its tail at what FUSE means (`avoid()`), and in the ending
 * it sits bottom left, clear of FUSE himself. A full-width strip there would cover them.
 */
const DOCKED_CAPTION = new Set(['title', 'journal']);
/**
 * Scenes drawn as landscape art (the hall's doors, the altar, the journal's spread, the
 * ending's stage): an upright phone is asked to turn. The title and the panels read upright.
 */
const LANDSCAPE_ONLY = new Set(['hall', 'puzzle', 'solve', 'journal', 'ending']);
/** Scenes that show the HUD (☰). On phones it sits at the top of the right rail. */
const HUD_SCENES = new Set(['hall', 'puzzle', 'solve']);

/** The rotate card's words (game copy) and the game's colours for it. */
const ROTATE = {
  title: 'Turn your phone sideways',
  lines: ['This room is wider than it is tall. It plays in landscape.'],
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

export interface RegionWidget {
  el: HTMLElement;
  place: WidgetOptions['place'];
  order?: number;
  id?: string;
}

/**
 * Puts `widgets` in their regions while the CSS-px chrome is live, and back where they were
 * (their place in the scaled overlay; a detached one is taken out) while it is not. Returns the
 * undo for the scene's exit.
 */
export function placeWidgets(
  chrome: CssChrome | null,
  widgets: readonly RegionWidget[],
): () => void {
  if (!chrome) return () => {};
  let handles: WidgetHandle[] = [];
  const unplace = () => {
    for (const hd of handles.reverse()) hd.remove();
    handles = [];
  };
  const sync = (on: boolean) => {
    unplace();
    if (!on) return;
    handles = widgets.map((w) =>
      chrome.layout.add(w.el, { place: w.place, order: w.order, id: w.id }),
    );
  };
  sync(chrome.active);
  const off = chrome.onChange(sync);
  return () => {
    off();
    unplace();
  };
}

export interface GameChrome {
  /**
   * The flow's scene changed: dock or undock FUSE's caption, put the HUD in its rail, ask an
   * upright phone to turn, frame the world.
   */
  scene(state: string): void;
  destroy(): void;
}

/**
 * The game's side of the two overlays. On phones (`chrome.active`):
 * - FUSE's caption docks in `captionLane` on the title and the journal, and stays the legacy
 *   card in the hall, at the altar, at the solve card and in the ending, which place it around
 *   what it must not cover;
 * - the HUD's ☰ sits at the top of the right rail;
 * - upright (the title), the canvas is framed in the `fill` region, so the picture never runs
 *   under the menu.
 * Everywhere, while a panel is open, `data-lr-modal` on the scaled root hides the hall's Next
 * ring (it would otherwise show over the panels' dimmer, which is in the other overlay).
 */
export function createGameChrome(opts: {
  chrome: CssChrome | null;
  ui: Overlay;
  hud: HTMLElement;
  surface: Pick<Surface, 'setFrame'>;
  device: DeviceMode;
}): GameChrome {
  const { chrome, ui, hud, surface, device } = opts;
  const doc = ui.root.ownerDocument;
  let state = 'boot';
  let captionHandle: WidgetHandle | null = null;
  let hudHandle: WidgetHandle | null = null;
  let rotate: RotateCard | null = null;

  const frame = () => {
    const upright =
      !!chrome?.active &&
      chrome.layout.formFactor === 'phone-portrait' &&
      !LANDSCAPE_ONLY.has(state);
    surface.setFrame(upright && chrome ? chrome.layout.freeRect : null);
  };

  const sync = () => {
    if (chrome?.active) {
      // Undocked, the caption goes back to its corner on the scaled overlay (a `'hidden'`
      // place would hide it).
      if (DOCKED_CAPTION.has(state)) {
        captionHandle ??= chrome.layout.dockCaption(ui.caption, { default: 'captionLane' });
      } else {
        captionHandle?.remove();
        captionHandle = null;
      }
      if (HUD_SCENES.has(state)) {
        hudHandle ??= chrome.layout.add(hud, { place: { default: 'right' }, id: 'lr-hud' });
      } else {
        hudHandle?.remove();
        hudHandle = null;
      }
    } else {
      captionHandle?.remove();
      captionHandle = null;
      hudHandle?.remove();
      hudHandle = null;
    }
    if (LANDSCAPE_ONLY.has(state)) {
      rotate ??= createRotateCard({ ...ROTATE, device, doc });
    } else {
      rotate?.destroy();
      rotate = null;
    }
    frame();
  };
  const offs = [
    chrome?.onChange(sync),
    chrome?.layout.onChange(frame),
    ui.stack.onChange(() => ui.root.toggleAttribute('data-lr-modal', ui.stack.hasModal)),
  ];

  return {
    scene(s) {
      state = s;
      sync();
    },
    destroy() {
      for (const off of offs) off?.();
      captionHandle?.remove();
      hudHandle?.remove();
      rotate?.destroy();
      surface.setFrame(null);
    },
  };
}

/**
 * The title's Full screen button: shown only where it can work (never iPhone Safari, which has
 * no element fullscreen; never an iframe without `allowfullscreen`) and not while full screen.
 * A press the browser refuses retires it: no dead controls (D-040).
 */
export function fullscreenButton(fullscreen: HostFullscreen): {
  element: HTMLButtonElement;
  destroy(): void;
} {
  const win = window;
  let refused = /iPhone|iPod/.test(win.navigator.userAgent);
  const update = () => {
    element.hidden = refused || !fullscreen.available() || fullscreen.active();
  };
  const element = button(
    'Full screen',
    () =>
      void fullscreen.toggle({ lockLandscape: true }).then((on) => {
        if (!on) {
          refused = true;
          update();
        }
      }),
    { className: 'lr-stone-button lr-fullscreen' },
  );
  const off = fullscreen.watch(update);
  update();
  return {
    element,
    destroy() {
      off();
      element.remove();
    },
  };
}
