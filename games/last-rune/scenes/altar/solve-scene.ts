/**
 * The solve moment (pitch screen 5): the machine wakes, light floods the room, the granted
 * gem rises off the altar, journal pages land. ~5 s, skippable (first press reveals
 * everything, second continues), reduced-motion aware.
 *
 * Variants
 *   firstTime  full sequence; FUSE's solve line; grant + codex note + pages + opened doors
 *   replay     short (~2.5 s) and quiet; returns to the hall on its own
 *
 * The scene rebuilds the altar from the saved placements (the altar scene saved them just
 * before `completePuzzle`), so it stands alone and works for any puzzle.
 */
import type { EmitParams } from '@engine/fx';
import type { Frame, RGBA } from '@engine/render';
import { button, h } from '@engine/ui';
import type { GemInstance } from '../../art/materials/gems';
import { POST_PRESETS } from '../../art/materials/post-presets';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import type { StormCellHandle } from '../../audio';
import { codexNote, machineLine } from '../../content/lines';
import { puzzleFor } from '../../content/puzzles';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { SolveMoment } from '../../game/flow';
import type { Placement } from '../../rules';
import { capabilityLabel, getMachine, socketColour } from '../../rules/progression';
import { CSS_PALETTE } from '../../ui/styles';
import { ensureAltarStyles } from './altar-styles';
import { AltarView } from './altar-view';
import { BoardState } from './board';

/** Beats (seconds) for the first-time sequence. */
const BEAT = { grant: 0.9, opens: 1.7, page: 2.4, cont: 1.6, end: 4.6 } as const;
const REPLAY_END = 2.6;

export class SolveScene implements GameScene {
  readonly name = 'solve';
  private ctx!: GameCtx;
  private view!: AltarView;
  private t = 0;
  private revealed = false;
  private postSnapshot: unknown = null;
  private bloomBase = 0.85;
  private raysBase = 0.3;
  private hum: StormCellHandle | null = null;
  private dom!: HTMLElement;
  private grantEl: HTMLElement | null = null;
  private codexEl: HTMLElement | null = null;
  private opensEl: HTMLElement | null = null;
  private pageEl: HTMLElement | null = null;
  private contEl: HTMLButtonElement | null = null;
  private showcase: GemInstance | null = null;
  private showcaseY = 0;
  private finished = false;
  private readonly mote: EmitParams = {
    x: 0,
    y: 0,
    shape: { kind: 'circle', radius: 40 },
    speed: [20, 90],
    angle: -Math.PI / 2,
    spread: 1.2,
    life: [1.2, 2.6],
    size: [5, 1],
    colorStart: [0.6, 1.6, 2.2, 1],
    colorEnd: [0.2, 0.5, 1, 0],
    gravity: [0, -40],
    drag: 0.6,
    emissive: 1.4,
  };

  constructor(readonly moment: SolveMoment) {}

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    const m = this.moment;
    const puzzle = puzzleFor(m.machine);
    const board = new BoardState(puzzle);
    board.restore(ctx.flow.placementsFor(m.machine) as Placement[]);
    const view = new AltarView(ctx, puzzle);
    this.view = view;
    view.reducedMotion = ctx.settings.reducedMotion;
    view.tray.length = 0; // the tray steps aside for the moment
    view.syncBoard(board);
    for (const b of view.board) {
      b.energy = 1;
      b.energyTarget = 1;
    }
    for (const mm of view.machines) mm.solve();
    view.wake = 1;

    this.postSnapshot = structuredClone(ctx.post.settings);
    ctx.post.set(POST_PRESETS.altar);
    this.bloomBase = ctx.post.settings.bloom.intensity;
    this.raysBase = ctx.post.settings.godRays.intensity;
    ctx.setMood(m.machine === 'the-last-rune' ? 'last-rune' : 'altar');
    this.hum = ctx.sound.sfx.stormCell(puzzle.storm.strength, 0.4);

    // Chime stack: the machine, then the grant, the doors, the pages.
    const sfx = ctx.sound.sfx;
    ctx.sound.music.duck(0.35, m.firstTime ? BEAT.end : REPLAY_END, 1.5);
    sfx.play('machineExact');
    if (m.firstTime) {
      if (m.grants) sfx.play('gemGranted', { delay: BEAT.grant });
      if (m.unlocked.length > 0) sfx.play('doorUnlock', { delay: BEAT.opens, gain: 0.8 });
      for (let i = 0; i < m.pages.length; i++) {
        sfx.play('pageFound', { delay: BEAT.page + 0.4 * i });
      }
    }

    // Granted gem rises from the machine side of the altar.
    const grant = m.grants;
    if (m.firstTime && grant?.type === 'gem') {
      const L = view.layout;
      // Hang just above the slab, but never past the top edge of the screen.
      this.showcaseY = Math.max(L.top - 10, Math.round(L.pitch * 0.85) + 16);
      this.showcase = {
        kind: grant.gem,
        x: L.cx,
        y: L.cy,
        size: Math.round(L.pitch * 1.5),
        state: 'energised',
        rot: 0,
        lift: 1,
        glow: 0,
        seed: 77,
      };
      view.showcase = this.showcase;
    }

    ensureAltarStyles(ctx.ui.root.ownerDocument);
    this.buildDom();
    if (m.firstTime) {
      const line = machineLine(m.machine, 'solve');
      if (line) void ctx.fuse.say(line, { interrupt: true });
    }
    if (m.complete) {
      ctx.ui.toasts.show('Every machine restored.', { tone: 'success', duration: 6000 });
    }
    if (ctx.settings.reducedMotion) this.reveal();
  }

  exit(): void {
    this.hum?.stop(0.6);
    this.hum = null;
    this.view.dispose();
    this.dom.remove();
    if (this.postSnapshot) this.ctx.post.set(this.postSnapshot as typeof this.ctx.post.settings);
    this.ctx.particles.clear();
  }

  private buildDom(): void {
    const m = this.moment;
    const def = getMachine(m.machine);
    const kids: (HTMLElement | string)[] = [
      h('h2', null, `${def.name} restored`),
      h(
        'p',
        { class: 'lr-solve-sub' },
        m.firstTime ? 'Exactly the right charge. It wakes.' : 'Already restored. It hums anyway.',
      ),
    ];
    if (m.firstTime && m.grants) {
      const g = m.grants;
      const what =
        g.type === 'gem' ? `New gem: ${capabilityLabel(g)}` : `New: ${capabilityLabel(g)}`;
      this.grantEl = h(
        'div',
        { class: 'lr-solve-grant', hidden: true },
        h('span', {
          class: 'lr-gem-dot',
          style: { color: CSS_PALETTE[socketColour(g) as keyof typeof CSS_PALETTE] },
        }),
        what,
      );
      kids.push(this.grantEl);
      const note = g.type === 'gem' ? codexNote(g.gem) : undefined;
      if (note) {
        this.codexEl = h('p', { class: 'lr-solve-codex', hidden: true }, note.text);
        kids.push(this.codexEl);
      }
    }
    if (m.firstTime && m.unlocked.length > 0) {
      this.opensEl = h(
        'p',
        { class: 'lr-solve-opens', hidden: true },
        `Opens: ${m.unlocked.map((id) => getMachine(id).name).join(', ')}`,
      );
      kids.push(this.opensEl);
    }
    const card = h(
      'div',
      { class: 'lr-solve-card', role: 'status', 'aria-live': 'polite' },
      ...kids,
    );
    const page = m.firstTime ? m.pages[0] : undefined;
    if (page) {
      const more = m.pages.length > 1 ? ` (+${m.pages.length - 1} more)` : '';
      this.pageEl = h(
        'div',
        { class: 'lr-page-note', hidden: true },
        h('b', null, `Journal · page ${page.page}${more}`),
        page.dateline,
      );
    }
    this.contEl = button('Continue', () => this.done(), {
      className: 'lr-gold-button lr-solve-continue',
    });
    this.contEl.dataset.action = 'continue';
    this.contEl.hidden = true;
    this.dom = h('div', { class: 'lr-solve' }, card, this.pageEl, this.contEl);
    this.ctx.ui.layers.hud.append(this.dom);
  }

  /** Show everything now (skip / reduced motion). */
  private reveal(): void {
    this.revealed = true;
    if (this.t < BEAT.end) this.t = Math.max(this.t, BEAT.end);
    for (const el of [this.grantEl, this.codexEl, this.opensEl, this.pageEl, this.contEl]) {
      if (el) el.hidden = false;
    }
    if (this.showcase) {
      this.showcase.y = this.showcaseY;
      this.showcase.glow = 1.4;
    }
    this.contEl?.focus();
  }

  private done(): void {
    if (this.finished) return;
    this.finished = true;
    this.ctx.sound.sfx.play('uiClick');
    this.ctx.flow.finishSolve();
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const input = ctx.input;
    const m = this.moment;
    this.t += dt;
    const t = this.t;
    const rm = ctx.settings.reducedMotion;
    const skip = input.pressed('confirm') || input.pressed('cancel') || input.pressed('select');

    if (!m.firstTime) {
      if (skip || t >= REPLAY_END) this.done();
    } else if (skip) {
      if (this.revealed) this.done();
      else this.reveal();
    } else if (!this.revealed) {
      if (this.grantEl && t >= BEAT.grant) this.grantEl.hidden = false;
      if (this.codexEl && t >= BEAT.grant + 0.5) this.codexEl.hidden = false;
      if (this.opensEl && t >= BEAT.opens) this.opensEl.hidden = false;
      if (this.pageEl && t >= BEAT.page) this.pageEl.hidden = false;
      if (this.contEl && t >= BEAT.cont && this.contEl.hidden) this.contEl.hidden = false;
      if (t >= BEAT.end) this.reveal();
    }

    // Light flood + bloom swell (gentle in reduced motion).
    const swell = rm
      ? 0.3
      : Math.max(0, Math.min(1, t / 0.6)) * Math.exp(-Math.max(0, t - 1.2) * 0.9);
    ctx.post.settings.bloom.intensity = this.bloomBase * (1 + 0.9 * swell + 0.25);
    ctx.post.settings.godRays.intensity = this.raysBase * (1.6 + 1.2 * swell);

    // Granted gem rises out of the altar and hangs there, glowing.
    const s = this.showcase;
    if (s) {
      const L = this.view.layout;
      const u = rm ? 1 : Math.max(0, Math.min(1, (t - 0.3) / 1.1));
      const e = 1 - (1 - u) ** 3;
      s.y = L.cy + (this.showcaseY - L.cy) * e;
      s.glow = e * (1.3 + 0.2 * Math.sin(t * 3));
      s.lift = 1;
    }

    // Motes rise off the machines and the gems that carried the bolt.
    if (!rm && t < 4.5) {
      const p = this.mote;
      const rate = t < 1.2 ? 1 : 0.35;
      for (const mm of this.view.machines) {
        p.x = mm.x;
        p.y = mm.y;
        p.colorStart = CYAN_MOTE;
        this.ctx.particles.emit(p, Math.round(4 * rate));
      }
      if (t < 1.2) {
        for (const b of this.view.board) {
          p.x = b.g.x;
          p.y = b.g.y;
          p.colorStart = MOTE[b.g.kind];
          this.ctx.particles.emit(p, 1);
        }
      }
    }

    const f = this.view.fuse;
    f.mood = ctx.fuse.speaking ? 'talk' : 'idle';
    const mm = this.view.machines[0];
    if (s && t > 0.4) f.lookAt(s.x, s.y);
    else if (mm) f.lookAt(mm.x, mm.y);
    this.view.update(dt);
  }

  render(frame: Frame): void {
    this.view.render(frame);
  }
}

const CYAN_MOTE: RGBA = pitch('cyan', 2);
const MOTE = Object.fromEntries(
  Object.entries(GEM_COLOUR).map(([k, c]) => [k, pitch(c, 1.8)]),
) as Record<keyof typeof GEM_COLOUR, RGBA>;
