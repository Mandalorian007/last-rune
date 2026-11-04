/**
 * Altar label audit, shared by the e2e guard and the playtest survey: which on-screen labels
 * overlap each other, the tray, the buttons, FUSE's caption or (for gem info cards) the board.
 * Board and tray rects come from the layout (design px); DOM rects are read in the page.
 */
import type { Page } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import {
  availableMachines,
  initialState,
  type ProgressState,
  solveMachine,
} from '../../games/last-rune/rules/progression';
import type { MachineId } from '../../games/last-rune/rules/types';
import { computeLayout } from '../../games/last-rune/scenes/altar/layout';
import { deriveHall, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';

/** Hall order a player who follows the glow takes (as in full-run). */
export function playOrder(): MachineId[] {
  const order: MachineId[] = [];
  let state: ProgressState = initialState();
  for (;;) {
    const open = new Set(availableMachines(state).map((m) => m.id));
    const next = focusOrder(deriveHall(state)).find((id) => open.has(id));
    if (!next) return order;
    order.push(next);
    state = solveMachine(state, next);
  }
}

export interface Box {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Board top face and tray slots, in design px. */
export function layoutBoxes(machine: MachineId): Box[] {
  const L = computeLayout(puzzleFor(machine));
  const out: Box[] = [
    { name: 'board', x: L.left, y: L.top, w: L.right - L.left, h: L.bottom - L.top },
  ];
  for (const s of L.tray) {
    out.push({
      name: `tray:${s.gem}`,
      x: s.x - s.size / 2,
      y: s.y - s.size / 2,
      w: s.size,
      h: s.size,
    });
  }
  return out;
}

/** Overlapping pairs on the altar now, in design px (empty means clear). */
export async function auditAltar(page: Page, machine: MachineId): Promise<string[]> {
  return page.evaluate((fixed) => {
    const root = document.querySelector<HTMLElement>('.tc-overlay:not([data-units="css"])')!;
    const o = root.getBoundingClientRect();
    const s = o.width / 1920;
    const boxes: { name: string; x: number; y: number; w: number; h: number }[] = [...fixed];
    const add = (name: string, el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0')
        return;
      boxes.push({
        name,
        x: (r.left - o.left) / s,
        y: (r.top - o.top) / s,
        w: r.width / s,
        h: r.height / s,
      });
    };
    document.querySelectorAll('.lr-altar-need').forEach((el, i) => {
      add(el.classList.contains('lr-altar-storm') ? 'storm' : `need:${i}`, el);
    });
    const one = (sel: string, name: string) => {
      const el = document.querySelector(sel);
      if (el) add(name, el);
    };
    one('.lr-altar-actions', 'actions');
    one('.lr-altar-title', 'title');
    one('.lr-altar-hint', 'hint');
    one('.tc-caption:not([hidden])', 'caption');
    one('.lr-altar-tip:not([hidden])', 'card');
    document.querySelectorAll('.lr-altar-count').forEach((el, i) => {
      add(`count:${i}`, el);
    });
    document.querySelectorAll('.lr-hud:not([hidden]) button').forEach((el, i) => {
      add(`hud:${i}`, el);
    });
    const hit = (a: (typeof boxes)[0], b: (typeof boxes)[0]) =>
      Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 &&
      Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
    // Labels must clear everything; the card must clear everything but the tray slot it
    // points at (it sits over the tray band, never over the board's sockets).
    const isLabel = (n: string) => n === 'storm' || n.startsWith('need:');
    const out: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const care =
          isLabel(a.name) ||
          isLabel(b.name) ||
          a.name === 'card' ||
          b.name === 'card' ||
          (a.name === 'caption' && b.name !== 'board') ||
          (b.name === 'caption' && a.name !== 'board');
        if (!care) continue;
        // The board is the props' business, not the labels' (labels sit beside the props).
        if ((a.name === 'board' || b.name === 'board') && !(a.name === 'card' || b.name === 'card'))
          continue;
        if (hit(a, b)) out.push(`${a.name} × ${b.name}`);
      }
    }
    return out;
  }, layoutBoxes(machine));
}
