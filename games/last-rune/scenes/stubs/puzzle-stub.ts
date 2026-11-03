/**
 * STUB for the altar scene (rules-puzzles owns the real one). Pushed over the
 * hall by `flow.openPuzzle`. Shows the contract the real scene must honour:
 *
 *   ctx.flow.placementsFor(id)            → restore the altar as it was left
 *   ctx.flow.savePlacements(id, list)     → on every change / on leaving
 *   ctx.flow.recordAttempt(id, outcome)   → each fired bolt ('over' trips a breaker)
 *   ctx.flow.completePuzzle(id)           → exact charge: swaps to the solve moment
 *   ctx.flow.closePuzzle()                → back to the hall without solving
 *
 * Replace it in main.ts: `puzzle: (id) => new AltarScene(id)`.
 */
import type { Frame } from '@engine/render';
import { button, h } from '@engine/ui';
import { machineLine, reactionLine } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { progressOf } from '../../game/save';
import { capabilityLabel, getMachine, storyTier } from '../../rules/progression';
import type { MachineId } from '../../rules/types';

export class PuzzleStubScene implements GameScene {
  readonly name = 'puzzle-stub';
  readonly transparent = true;
  private ctx!: GameCtx;
  private dom: HTMLElement | null = null;
  private tripped = 0;

  constructor(readonly machine: MachineId) {}

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    const m = getMachine(this.machine);
    const grants = m.grants ? capabilityLabel(m.grants) : 'nothing (it is the last one)';
    const restore = button('Restore (stub)', () => this.solve(), {
      variant: 'primary',
      className: 'lr-gold-button',
    });
    restore.dataset.action = 'restore';
    this.dom = h(
      'div',
      { class: 'lr-stub-card', role: 'region', 'aria-label': `${m.name} altar` },
      h('h2', null, m.name),
      h('p', null, `Altar scene goes here (rules-puzzles). Restoring it grants ${grants}.`),
      h(
        'div',
        { class: 'lr-row' },
        restore,
        button('Trip breaker (stub)', () => this.trip(), { className: 'lr-stone-button' }),
        button('Back to hall', () => this.back(), { className: 'lr-stone-button' }),
      ),
    );
    ctx.ui.layers.hud.append(this.dom);
    const arrive = machineLine(this.machine, 'arrive');
    if (arrive) void ctx.fuse.say(arrive, { interrupt: true });
  }

  exit(): void {
    this.dom?.remove();
    this.dom = null;
  }

  update(): void {
    if (this.ctx.input.pressed('cancel')) this.back();
  }

  render(frame: Frame): void {
    // The hall renders underneath (transparent scene); nothing to add.
    void frame;
  }

  private solve(): void {
    this.ctx.sfx('ui.click');
    this.ctx.flow.recordAttempt(this.machine, 'exact');
    this.ctx.flow.completePuzzle(this.machine);
  }

  private trip(): void {
    this.ctx.sfx('ui.deny');
    this.ctx.flow.recordAttempt(this.machine, 'over');
    const tier = storyTier(progressOf(this.ctx.save.get()));
    const line = reactionLine('over', tier, undefined, this.tripped++);
    if (line) void this.ctx.fuse.say(line, { interrupt: true });
  }

  private back(): void {
    this.ctx.sfx('ui.click');
    this.ctx.fuse.hush();
    this.ctx.flow.closePuzzle();
  }
}
