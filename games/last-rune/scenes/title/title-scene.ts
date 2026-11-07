/**
 * Title: the Last Rune on its plinth (view), the name in gold (DOM), and
 * Play / Continue + New game / Settings. On the very first visit something
 * knocks inside the gem and FUSE notices (beat `title-knock`).
 *
 * While nobody presses anything FUSE potters about (the view) and says something now and then
 * (`titleLines`, shuffled, see `chatter.ts`). His card keeps off the menu, holds while a panel is
 * open, and stops the moment the player starts.
 */

import type { Frame } from '@thunderclap-engine/engine/render';
import type { Rect } from '@thunderclap-engine/engine/ui';
import { h, menuNav } from '@thunderclap-engine/engine/ui';
import { coffeeLink } from '../../content/ending';
import { beatLine, type FuseLine, titleLines } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { hasProgress } from '../../game/save';
import { fullscreenButton, isPhone, placeWidgets } from '../../ui/chrome';
import { coffeeLinkWidget } from '../../ui/coffee';
import type { TitleView, TitleViewFrame } from '../views';
import { ChatterClock, ShuffleBag } from './chatter';

const KNOCK_DELAY = 1.6;
/** Design px kept clear around the menu and the release label when FUSE's card moves. */
const AVOID_PAD = 24;

/** One bag per session, so coming back to the title carries on through the pool. */
let chatterBag: ShuffleBag<FuseLine> | null = null;

export class TitleScene implements GameScene {
  readonly name = 'title';
  private ctx!: GameCtx;
  private view!: TitleView;
  private dom: HTMLElement | null = null;
  private time = 0;
  private returning = false;
  private knockPending = false;
  private chatter = new ChatterClock();
  /** Phones: the menu, links and Full screen in their regions (ui/chrome.ts). */
  private unplace: () => void = () => {};
  private fullscreen: { element: HTMLElement; possible: boolean; destroy(): void } | null = null;

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    this.view = ctx.views.title(ctx.viewContext);
    const data = ctx.save.get();
    this.returning = hasProgress(data);
    this.knockPending = !data.flags.titleKnock;
    this.chatter = new ChatterClock();
    this.dom = this.buildDom();
    ctx.ui.layers.hud.append(this.dom);
    this.placeChrome();
    ctx.post.set({
      godRays: { x: 960, y: 210, intensity: 0.28, sourceIntensity: 0 },
      mist: { density: 0.4 },
    });
    ctx.setMood('title');
  }

  exit(): void {
    this.unplace();
    this.unplace = () => {};
    this.fullscreen?.destroy();
    this.fullscreen = null;
    this.dom?.remove();
    this.dom = null;
    this.view.dispose();
    this.ctx.fuse.hush();
    this.ctx.fuse.keepClear(null);
    this.ctx.fuse.pointAt(null);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.knockPending && this.time >= KNOCK_DELAY) {
      this.knockPending = false;
      this.view.knock?.();
      this.ctx.sfx('ui.deny', 0.8);
      this.ctx.fuse.keepClear(this.menuRegions());
      void this.ctx.fuse.say(beatLine('title-knock'));
      this.ctx.save.update((d) => {
        d.flags.titleKnock = true;
        return undefined;
      });
    }
    const speaking = this.ctx.fuse.speaking;
    const paused = this.knockPending || this.ctx.ui.stack.hasModal;
    if (this.chatter.tick(dt, { paused, speaking })) this.chat();
    if (!this.ctx.ui.stack.hasModal && this.dom) {
      // Arrows and the pad walk the menu (and the Ko-fi link); otherwise A/Enter/Space play.
      // On phones the menu and links are in the layout's regions.
      const nav = isPhone(this.ctx.ui) ? this.ctx.ui.layout.element : this.dom;
      if (!menuNav(this.ctx.input, nav) && this.ctx.input.pressed('confirm')) this.primary();
    }
    this.view.update(dt, this.frameState());
    // Phones: FUSE's card points at him as he potters (mobile-7-hall).
    const phone = this.ctx.device.phone;
    this.ctx.fuse.pointAt(phone ? (this.view.fuseAt?.() ?? null) : null, 7 * this.ctx.device.cssPx);
  }

  render(frame: Frame): void {
    this.view.render(frame, this.frameState());
  }

  /** One reused snapshot (no per-frame allocation). */
  private readonly snap = {
    time: 0,
    reducedMotion: false,
    reduceFlashes: false,
    speaking: false,
    returning: false,
    upright: false,
    compact: false,
  };

  private frameState(): TitleViewFrame {
    const s = this.snap;
    s.time = this.time;
    s.reducedMotion = this.ctx.settings.reducedMotion;
    s.reduceFlashes = this.ctx.settings.reduceFlashes;
    s.speaking = this.ctx.fuse.speaking;
    s.returning = this.returning;
    s.upright = this.upright();
    s.compact = this.compact();
    return s;
  }

  /** An upright phone: the picture is a side-cropped slice (`TITLE_UPRIGHT`, ui/chrome.ts). */
  private upright(): boolean {
    const up = this.ctx.ui.layout.formFactor === 'phone-portrait';
    const title = this.dom?.querySelector<HTMLElement>('.lr-title');
    if (title && title.hasAttribute('data-upright') !== up) {
      title.toggleAttribute('data-upright', up);
    }
    return up;
  }

  /** A phone on its side (polish-8): the view draws the name lower; the subtitle follows. */
  private compact(): boolean {
    const on = this.ctx.ui.layout.formFactor === 'phone-landscape';
    const title = this.dom?.querySelector<HTMLElement>('.lr-title');
    if (title && title.hasAttribute('data-compact') !== on) {
      title.toggleAttribute('data-compact', on);
    }
    return on;
  }

  /** One idle line, from the bag, with the card kept clear of the menu. */
  private chat(): void {
    chatterBag ??= new ShuffleBag(titleLines());
    const line = chatterBag.next();
    if (!line) return;
    this.ctx.fuse.keepClear(this.menuRegions());
    void this.ctx.fuse.say(line);
  }

  /**
   * The logo, menu, release label and Ko-fi link, measured (text size moves them), in design px.
   * Phones (mobile-6-chrome): the card's top corners drop to just under the subtitle, so with
   * the logo kept clear there is always a free spot beside the menu.
   */
  private menuRegions(): Rect[] {
    const ui = this.ctx.ui;
    if (!this.dom?.isConnected) return [];
    // The frame's origin: the HUD layer covers the canvas.
    const o = ui.layers.hud.getBoundingClientRect();
    const out: Rect[] = [];
    for (const el of this.dom.querySelectorAll<HTMLElement>(
      '.lr-title, .lr-title-menu, .lr-release, .lr-title-links',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.push({
        x: (r.left - o.left) / ui.scale - AVOID_PAD,
        y: (r.top - o.top) / ui.scale - AVOID_PAD,
        width: r.width / ui.scale + AVOID_PAD * 2,
        height: r.height / ui.scale + AVOID_PAD * 2,
      });
    }
    return out;
  }

  /**
   * Phones (ws/port-chrome): Full screen and the release label along the top; the menu a column
   * in the card lane: right of the picture (landscape, chrome-polish-4: the storm and FUSE's
   * strolls keep the left 41% clear of every button) or under it (upright); the Ko-fi link and
   * Copy link small along the bottom. The name is drawn in the picture, so nothing sits over
   * the top of it.
   */
  private placeChrome(): void {
    const dom = this.dom;
    if (!dom) return;
    this.fullscreen = fullscreenButton(this.ctx.host.fullscreen);
    const q = (sel: string) => dom.querySelector<HTMLElement>(sel);
    const widgets = [
      {
        // Never placed where it can't work, so its row collapses (chrome-polish-3).
        el: this.fullscreen.possible ? this.fullscreen.element : null,
        place: { default: 'top' as const },
        order: 0,
        id: 'lr-fullscreen',
      },
      { el: q('.lr-release'), place: { default: 'top' as const }, order: 1, id: 'lr-release' },
      {
        el: q('.lr-title-links'),
        place: { default: 'bottom' as const },
        order: 2,
        id: 'lr-title-links',
      },
      {
        el: q('.lr-title-menu'),
        place: { default: 'cardLane' as const },
        order: 1,
        id: 'lr-title-menu',
      },
    ];
    this.unplace = placeWidgets(
      this.ctx.ui,
      widgets.filter((w): w is (typeof widgets)[number] & { el: HTMLElement } => w.el !== null),
    );
  }

  private primary(): void {
    // He stops mid-sentence: the player has started.
    this.ctx.fuse.hush();
    this.ctx.sfx('ui.click');
    if (this.returning) this.ctx.flow.continueGame();
    else this.ctx.flow.newGame();
  }

  private buildDom(): HTMLElement {
    const ctx = this.ctx;
    const coffee = coffeeLink();
    const coffeeEl = coffee
      ? coffeeLinkWidget(coffee, {
          host: ctx.host,
          cls: 'lr-title-coffee',
          wrap: 'lr-title-links',
          action: 'title-coffee',
          place: 'above',
          align: 'end',
        })?.element
      : null;
    const gold = (label: string, fn: () => void, id: string) =>
      h(
        'button',
        { type: 'button', class: 'lr-gold-button', dataset: { action: id }, on: { click: fn } },
        label,
      );
    const stone = (label: string, fn: () => void, id: string) =>
      h(
        'button',
        { type: 'button', class: 'lr-stone-button', dataset: { action: id }, on: { click: fn } },
        label,
      );
    const menu = h(
      'div',
      { class: 'lr-title-menu', role: 'group', 'aria-label': 'Main menu' },
      gold(
        this.returning ? 'Continue' : 'Play',
        () => this.primary(),
        this.returning ? 'continue' : 'play',
      ),
      this.returning
        ? stone(
            'New game',
            () => {
              ctx.sfx('ui.click');
              this.confirmNewGame();
            },
            'new-game',
          )
        : null,
      stone(
        'Settings',
        () => {
          ctx.sfx('ui.click');
          ctx.openSettings();
        },
        'settings',
      ),
    );
    return h(
      'div',
      { class: 'lr-title-screen' },
      h(
        'div',
        { class: 'lr-title', dataset: this.view.drawsTitle ? { canvas: '' } : {} },
        h('h1', null, 'The Last Rune'),
        h('p', null, 'A gem-circuit puzzle'),
      ),
      menu,
      ...(releaseLabel() ? [h('p', { class: 'lr-release' }, releaseLabel())] : []),
      // Ko-fi (D-034): small, in the corner, never competing with Play. Click-only, with a
      // Copy link beside it in case the browser blocks the new tab.
      ...(coffeeEl ? [coffeeEl] : []),
    );
  }

  private confirmNewGame(): void {
    const ui = this.ctx.ui;
    const no = h('button', { type: 'button', class: 'tc-button' }, 'Keep my progress');
    const yes = h(
      'button',
      { type: 'button', class: 'tc-button', dataset: { variant: 'primary' } },
      'Start over',
    );
    const handle = ui.stack.push({
      title: 'Start a new game?',
      role: 'alertdialog',
      initialFocus: no,
      content: h(
        'div',
        { class: 'lr-confirm' },
        h('p', null, 'This erases restored machines, journal pages and stats. Settings stay.'),
        h('div', { class: 'lr-row' }, no, yes),
      ),
    });
    no.addEventListener('click', () => handle.close('programmatic'));
    yes.addEventListener('click', () => {
      handle.close('programmatic');
      this.ctx.fuse.hush();
      this.ctx.flow.newGame();
    });
  }
}

/** Build label stamped by the Pages workflow (`alpha-1`, `v1.0.0`, or `main-<sha>`), shortened. */
function releaseLabel(): string {
  const raw = (import.meta.env.VITE_RELEASE_LABEL as string | undefined) ?? '';
  const m = /^main-([0-9a-f]{7})[0-9a-f]*$/.exec(raw);
  return m ? `build ${m[1]}` : raw;
}
