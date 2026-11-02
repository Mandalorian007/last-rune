/**
 * STUB solve moment (pitch screen 5): badge with the machine name, the gem it
 * grants, the doors it opened; a journal page bottom-left; FUSE's solve line.
 * Replaces the puzzle on the stack; `flow.finishSolve()` pops back to the hall,
 * whose `resume` tells the hall view what woke.
 *
 * Replace it in main.ts: `solve: (moment) => new SolveScene(moment)`.
 */
import type { Frame } from '@engine/render';
import { button, h } from '@engine/ui';
import { machineLine } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { SolveMoment } from '../../game/flow';
import { capabilityLabel, getMachine, socketColour } from '../../rules/progression';
import { CSS_PALETTE } from '../../ui/styles';

export class SolveStubScene implements GameScene {
  readonly name = 'solve-stub';
  readonly transparent = true;
  private ctx!: GameCtx;
  private dom: HTMLElement | null = null;

  constructor(readonly moment: SolveMoment) {}

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    const m = this.moment;
    const def = getMachine(m.machine);
    ctx.sfx('solve.chime');

    const grant = m.grants
      ? h(
          'p',
          null,
          h('span', {
            class: 'lr-gem-dot',
            style: { color: CSS_PALETTE[socketColour(m.grants) as keyof typeof CSS_PALETTE] },
          }),
          `You earned ${capabilityLabel(m.grants)}`,
        )
      : h('p', null, m.firstTime ? 'Restored.' : 'Already restored. The machine hums anyway.');
    const opened =
      m.unlocked.length > 0
        ? h('p', null, `Opens: ${m.unlocked.map((id) => getMachine(id).name).join(', ')}`)
        : null;
    const page = m.pages[0];
    const note = page
      ? h(
          'div',
          { class: 'lr-page-note' },
          h('b', null, `Journal · page ${page.page}`),
          page.dateline,
        )
      : null;
    const cont = button('Continue', () => this.done(), { className: 'lr-gold-button' });
    cont.dataset.action = 'continue';

    this.dom = h(
      'div',
      { class: 'lr-solve' },
      h(
        'div',
        { class: 'lr-badge', role: 'status' },
        h('h2', null, `${def.name} restored`),
        grant,
        opened,
      ),
      note,
      h('div', { class: 'lr-stub-card', style: { top: '560px', width: '640px' } }, cont),
    );
    ctx.ui.layers.hud.append(this.dom);
    if (m.complete) {
      ctx.ui.toasts.show('Every machine restored. (Ending scene not built yet.)', {
        tone: 'success',
        duration: 6000,
      });
    }
    const line = machineLine(m.machine, 'solve');
    if (line && m.firstTime) void ctx.fuse.say(line, { interrupt: true });
    cont.focus();
  }

  exit(): void {
    this.dom?.remove();
    this.dom = null;
  }

  update(): void {
    const i = this.ctx.input;
    if (i.pressed('confirm') || i.pressed('cancel')) this.done();
  }

  render(frame: Frame): void {
    void frame;
  }

  private done(): void {
    this.ctx.sfx('ui.click');
    this.ctx.flow.finishSolve();
  }
}
