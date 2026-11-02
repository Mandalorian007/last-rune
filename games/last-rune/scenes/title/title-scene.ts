/**
 * Title: the Last Rune on its plinth (view), the name in gold (DOM), and
 * Play / Continue + New game / Settings. On the very first visit something
 * knocks inside the gem and FUSE notices (beat `title-knock`).
 */

import type { Frame } from '@engine/render';
import { h } from '@engine/ui';
import { beatLine } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { hasProgress } from '../../game/save';
import type { TitleView, TitleViewFrame } from '../views';

const KNOCK_DELAY = 1.6;

export class TitleScene implements GameScene {
  readonly name = 'title';
  private ctx!: GameCtx;
  private view!: TitleView;
  private dom: HTMLElement | null = null;
  private time = 0;
  private returning = false;
  private knockPending = false;

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    this.view = ctx.views.title(ctx.viewContext);
    const data = ctx.save.get();
    this.returning = hasProgress(data);
    this.knockPending = !data.flags.titleKnock;
    this.dom = this.buildDom();
    ctx.ui.layers.hud.append(this.dom);
    ctx.post.set({
      godRays: { x: 960, y: 210, intensity: 0.28, sourceIntensity: 0 },
      fog: { density: 0.4 },
    });
    ctx.setMood('title');
  }

  exit(): void {
    this.dom?.remove();
    this.dom = null;
    this.view.dispose();
    this.ctx.fuse.hush();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.knockPending && this.time >= KNOCK_DELAY) {
      this.knockPending = false;
      this.view.knock?.();
      this.ctx.sfx('ui.deny', 0.8);
      void this.ctx.fuse.say(beatLine('title-knock'));
      this.ctx.save.update((d) => {
        d.flags.titleKnock = true;
        return undefined;
      });
    }
    if (this.ctx.input.pressed('confirm')) this.primary();
    this.view.update(dt, this.frameState());
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
  };

  private frameState(): TitleViewFrame {
    const s = this.snap;
    s.time = this.time;
    s.reducedMotion = this.ctx.settings.reducedMotion;
    s.reduceFlashes = this.ctx.settings.reduceFlashes;
    s.speaking = this.ctx.fuse.speaking;
    s.returning = this.returning;
    return s;
  }

  private primary(): void {
    this.ctx.sfx('ui.click');
    if (this.returning) this.ctx.flow.continueGame();
    else this.ctx.flow.newGame();
  }

  private buildDom(): HTMLElement {
    const ctx = this.ctx;
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
      { class: 'lr-title-menu', role: 'menu', 'aria-label': 'Main menu' },
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
