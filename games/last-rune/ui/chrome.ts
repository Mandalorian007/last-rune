/**
 * Phone chrome on layout regions (D-041 Phase 2, ws/port-chrome; one overlay since
 * ws/one-overlay). The overlay's layout (`ctx.ui.layout`) puts phones in CSS px (`units: 'css'`):
 * every panel and toast lays out over the whole screen, the title's menu and the HUD's ☰ sit in
 * regions (`placeWidgets`), and FUSE's caption is docked in `captionLane` on the title and the
 * journal. Desktop and tablets are in frame units and use no regions, so they look as in v1.0.
 * World-anchored pieces (door plates, the Next ring, the altar, the journal's spread, the
 * ending) sit on the frame in design px (`dpx`, `toFrameUnits`), with their own phone rules
 * (ui/phone-base.ts and each scene's *-phone-styles.ts).
 *
 * Also here: the "turn it sideways" card (the hall, the altar, the solve card, the journal and
 * the ending are landscape art; the title and the panels read upright) and the title's Full
 * screen button.
 */
import type { HostFullscreen } from '@thunderclap-engine/engine/host';
import { type DeviceMode, PHONE_SCALE, type Surface } from '@thunderclap-engine/engine/platform';
import {
  button,
  createRotateCard,
  defaultTheme,
  type LayoutSpec,
  type Overlay,
  type RotateCard,
  type WidgetHandle,
  type WidgetOptions,
} from '@thunderclap-engine/engine/ui';

/**
 * Last Rune's region tracks on phones. Landscape: rails left and right (the ☰ at the top of the
 * right one), Full screen along the top, the title's menu and links along the bottom,
 * FUSE's lane above it, full width so a line runs on two rows at most. Portrait (the title
 * only): the picture, the menu right beneath it and FUSE's lane under that, centred upright;
 * Full screen at the top, the links at the bottom for the thumb. Empty tracks collapse.
 */
export const CHROME_LAYOUT: LayoutSpec = {
  // A phone is what device mode calls one (`device.phone`: the 1920×1080 design fits below
  // PHONE_SCALE), so the phone forms (CSS px, regions) are live exactly where the phone rules
  // apply and desktop and tablets keep v1.0's look.
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
      // chrome-polish-3 (Gate 2: the upright title was a thin letterboxed band with black above
      // and below): the picture takes every row the buttons, FUSE's lane and the links leave,
      // and the title fills that frame's height, cropping the sides (FILL_BANDS.title), so the
      // screen is the room from the Full screen row down to the menu.
      // polish-8 (dead band under the menu): the menu, FUSE's one-line lane and the links rows
      // hug what they hold, and the picture takes the rest.
      rows: [
        48,
        'fill',
        { frac: 0.17, min: 130, max: 160 },
        { frac: 0.08, min: 56, max: 76 },
        { frac: 0.06, min: 44, max: 60 },
      ],
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
 * Next ring and the tray and points its tail at what FUSE means (`Fuse.keepClear`), and in the ending
 * it sits bottom left, clear of FUSE himself. A full-width strip there would cover them.
 */
const DOCKED_CAPTION = new Set(['title', 'journal']);
/**
 * Scenes drawn as landscape art (the hall's doors, the altar, the journal's spread, the
 * ending's stage): an upright phone is asked to turn. The title and the panels read upright.
 */
/** The journal's bars (chrome-polish-3): the desk's edge colour, so the desk runs edge to edge. */
const DESK_BARS = 'radial-gradient(120% 90% at 50% 45%, #1c0b06, #0b0503)';
const LANDSCAPE_ONLY = new Set(['hall', 'puzzle', 'solve', 'journal', 'ending']);
/** Scenes that show the HUD (☰). On phones it sits at the top of the right rail. */
const HUD_SCENES = new Set(['hall', 'puzzle', 'solve']);

/**
 * The rotate card's body line per scene (polish-8: the hall had the altar's "This room" line).
 * Each says what is wide about where the player stands.
 */
const ROTATE_LINES: Record<string, string> = {
  hall: "The hall's doors stand side by side. It plays in landscape.",
  puzzle: 'This room is wider than it is tall. It plays in landscape.',
  solve: 'This room is wider than it is tall. It plays in landscape.',
  journal: 'The journal lies open across the desk. It reads in landscape.',
  ending: 'The last room is wider than it is tall. It plays in landscape.',
};

/** The rotate card's words (game copy) and the game's colours for it. */
const ROTATE = {
  title: 'Turn your phone sideways',
  note: { tag: 'FUSE', text: 'Sideways, visitor. The building was. Regulation 1.' },
  colors: {
    background: 'radial-gradient(circle at 50% 40%, #1d1530, #07050c 75%)',
    text: '#f4e6c4',
    accent: '#e8c06a',
    glow: 'rgba(232,192,106,0.35)',
    muted: '#cbb991',
    // The game's serif (chrome-polish-3: the rotate card was the one screen in Georgia).
    font: defaultTheme.fontBody,
  },
} as const;

export interface RegionWidget {
  el: HTMLElement;
  place: WidgetOptions['place'];
  order?: number;
  id?: string;
}

/** A phone form factor: regions and CSS px (`CHROME_LAYOUT`). */
export function isPhone(ui: Pick<Overlay, 'layout'>): boolean {
  return ui.layout.formFactor.startsWith('phone');
}

/** Calls `fn` whenever the screen turns into a phone or stops being one. Returns unsubscribe. */
export function onPhoneChange(
  ui: Pick<Overlay, 'layout'>,
  fn: (phone: boolean) => void,
): () => void {
  let was = isPhone(ui);
  return ui.layout.onChange(() => {
    const now = isPhone(ui);
    if (now === was) return;
    was = now;
    fn(now);
  });
}

/**
 * Puts `widgets` in their regions on a phone, and back where they were (their place on the
 * frame; a detached one is taken out) otherwise. Returns the undo for the scene's exit.
 */
export function placeWidgets(
  ui: Pick<Overlay, 'layout'>,
  widgets: readonly RegionWidget[],
): () => void {
  let handles: WidgetHandle[] = [];
  const unplace = () => {
    for (const hd of handles.reverse()) hd.remove();
    handles = [];
  };
  const sync = (on: boolean) => {
    unplace();
    if (!on) return;
    handles = widgets.map((w) => ui.layout.add(w.el, { place: w.place, order: w.order, id: w.id }));
  };
  sync(isPhone(ui));
  const off = onPhoneChange(ui, sync);
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
 * The game's side of the overlay's layout. On phones (`isPhone`):
 * - FUSE's caption docks in `captionLane` on the title and the journal, and stays the legacy
 *   card in the hall, at the altar, at the solve card and in the ending, which place it around
 *   what it must not cover;
 * - the HUD's ☰ sits at the top of the right rail;
 * - upright (the title), the canvas is framed in the `fill` region, so the picture never runs
 *   under the menu.
 * Everywhere, while a panel is open, `data-lr-modal` on the overlay root hides the hall's Next
 * ring.
 */
export function createGameChrome(opts: {
  ui: Overlay;
  hud: HTMLElement;
  surface: Pick<Surface, 'setFrame' | 'root'>;
  device: DeviceMode;
}): GameChrome {
  const { ui, hud, surface, device } = opts;
  const layout = ui.layout;
  const doc = ui.root.ownerDocument;
  let state = 'boot';
  let captionHandle: WidgetHandle | null = null;
  let hudHandle: WidgetHandle | null = null;
  let rotate: RotateCard | null = null;
  let rotateLine = '';

  const frame = () => {
    // Phones: the bars beside the journal's desk are the desk's own dark wood, not the night's ink.
    const bars = isPhone(ui) && state === 'journal' ? DESK_BARS : '';
    surface.root.style.background = bars;
    doc.body.style.background = bars;
    const upright = layout.formFactor === 'phone-portrait' && !LANDSCAPE_ONLY.has(state);
    surface.setFrame(upright ? layout.freeRect : null);
  };

  const sync = () => {
    if (isPhone(ui)) {
      // Undocked, the caption goes back to its corner on the frame (a `'hidden'` place would
      // hide it).
      if (DOCKED_CAPTION.has(state)) {
        captionHandle ??= layout.dockCaption(ui.caption, { default: 'captionLane' });
      } else {
        captionHandle?.remove();
        captionHandle = null;
      }
      if (HUD_SCENES.has(state)) {
        hudHandle ??= layout.add(hud, { place: { default: 'right' }, id: 'lr-hud' });
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
    const line = LANDSCAPE_ONLY.has(state) ? (ROTATE_LINES[state] ?? '') : '';
    if (line !== rotateLine) {
      rotate?.destroy();
      rotate = line ? createRotateCard({ ...ROTATE, lines: [line], device, doc }) : null;
      rotateLine = line;
    }
    frame();
  };
  const offs = [
    onPhoneChange(ui, sync),
    layout.onChange(frame),
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
      surface.root.style.background = '';
      doc.body.style.background = '';
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
  /** False where it can never show (iPhone Safari, a frame without it): don't place it at all. */
  readonly possible: boolean;
  destroy(): void;
} {
  const win = window;
  let refused = /iPhone|iPod/.test(win.navigator.userAgent);
  const update = () => {
    element.hidden = refused || !fullscreen.available() || fullscreen.active;
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
    possible: !refused && fullscreen.available(),
    destroy() {
      off();
      element.remove();
    },
  };
}
