/**
 * Read-outs: the gauges' Needs cards, Strike's word, the Capacitor beats, the verdict, tags and the announcer.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { h } from '@thunderclap/engine/ui';
import type { BoltOutcome } from '../../game/flow';
import { type SimResult, stormCharge } from '../../rules';
import { getMachine } from '../../rules/progression';
import {
  listText,
  ONE_STRIKE_RULE,
  OUTCOME_WORD,
  RING_NAME,
  RING_RULE,
  timesWord,
} from './altar-defs';
import type { AltarScene } from './altar-scene';
import { type CapBeat, capBeatText } from './circuit-model';
import { cellCenter } from './layout';
import { keepTogether } from './nowrap';
import { needNote, readingsText, strikeLabel } from './strike';

export const readoutMethods = {
  /**
   * The storm's strike row and the pips: "2 strikes" while editing (`now` < 0), "Strike 2 of 2"
   * once strike `now` fires, with that many pips lit.
   */
  setStrikeRow(this: AltarScene, now: number): void {
    this.setStrikeWord(now < 0 ? 'edit' : 'strike');
    if (!this.strikeRow) return;
    const n = this.puzzle.pulses;
    // Phones (mobile-5-board, teach-5): the storm's card says the number is per strike ("Gives
    // 8" / "per strike") and Strike says what one tap does ("Strike ×2"); its pips light one
    // per strike as they fire. The storm's pips are hidden there, and the card keeps "per
    // strike" through the run, so it fits the gauge's gutter at 13 px.
    const phone = !!this.view.layout.phone;
    this.strikeRow.textContent = phone
      ? 'per strike'
      : now < 0
        ? `${n} strikes`
        : `Strike ${now + 1} of ${n}`;
    if (this.strikeCount)
      this.strikeCount.textContent = now < 0 ? timesWord(n) : keepTogether(`${now + 1} of ${n}`);

    this.strikePips.forEach((el, i) => {
      el.toggleAttribute('data-lit', i % n <= now);
    });
    const band = this.view.layout.phone;
    if (band) {
      if (this.dom?.isConnected) this.placePhoneLabels(band);
    } else if (this.stormLabel) this.clearOfBoard(this.stormLabel);
  },

  /**
   * Phones (mobile-7-strike): Strike says what a tap will do, on one line (`strikeLabel`).
   * Big screens keep "Strike" and the pips.
   */
  setStrikeWord(this: AltarScene, state: 'edit' | 'strike' | 'fail'): void {
    if (!this.strikeWord || !this.view.layout.phone) return;
    const text = keepTogether(strikeLabel(this.puzzle.pulses));
    if (this.strikeWord.textContent !== text) this.strikeWord.textContent = text;
    // teach-5: the pips stand beside "Strike ×2" and light one per strike as they fire.
    // teach-7: after a miss the button reads as it did before ("Try again" read as a wipe):
    // same word, pips unlit, ready for another free strike (D-043).
    if (state === 'fail')
      for (const pip of this.strikeBtn?.querySelectorAll('.lr-strike-pips i') ?? [])
        pip.removeAttribute('data-lit');
  },

  /**
   * Capacitor read-outs beside each Capacitor the bolt reaches, one line per strike it acts
   * on. `live` lines start hidden and appear as the strike reaches them (see `updateCapLive`);
   * otherwise it is the plan for the board as built, shown before Strike.
   */
  renderCaps(
    this: AltarScene,
    beats: readonly CapBeat[],
    sim: SimResult | null,
    live: boolean,
  ): void {
    // teach-8 (D-043): before Strike the plan says the rule only; no gauge or line warns.
    const key =
      (live ? 'L' : 'P') +
      beats
        .map((b) => `${b.cell.x},${b.cell.y}:${b.pulse}${b.kind}${b.stored}+${b.incoming}`)
        .join(';');
    if (key === this.capKey) return;
    this.capKey = key;
    for (const el of this.capEls) el.remove();
    this.capEls.length = 0;
    this.capLines.length = 0;
    this.capBeats = live ? [...beats] : [];
    const L = this.view.layout;
    const route = new Set<string>();
    for (const s of sim?.trace ?? []) route.add(`${s.to.x},${s.to.y}`);
    const cells = new Map<string, CapBeat[]>();
    for (const b of beats) {
      const k = `${b.cell.x},${b.cell.y}`;
      cells.set(k, [...(cells.get(k) ?? []), b]);
    }
    const pt = { x: 0, y: 0 };
    for (const list of cells.values()) {
      const c = list[0]!.cell;
      cellCenter(L, c, pt);
      // Off the board where the Capacitor sits on an edge column; else above it, or below
      // when the route runs through the socket above.
      const free = (x: number, y: number) => y < 0 || y >= L.rows || !route.has(`${x},${y}`);
      const side =
        c.x === 0
          ? 'left'
          : c.x === L.cols - 1
            ? 'right'
            : !free(c.x, c.y - 1) && free(c.x, c.y + 1)
              ? 'below'
              : 'above';
      const off = L.pitch * 0.42;
      const x = side === 'left' ? pt.x - off : side === 'right' ? pt.x + off : pt.x;
      const y = side === 'above' ? pt.y - off : side === 'below' ? pt.y + off : pt.y;
      const lines = list.map((b) => {
        const el = h(
          'span',
          { class: 'lr-cap-line', 'data-kind': b.kind },
          keepTogether(capBeatText(b, this.puzzle.pulses, !live)),
        );
        if (live) el.hidden = true;
        this.capLines.push(el);
        return el;
      });
      const el = h(
        'div',
        {
          class: 'lr-altar-cap',
          'data-side': side,
          'aria-hidden': 'true',
          ...(live ? {} : { 'data-plan': '' }),
          style: { left: `${x}px`, top: `${y}px` },
        },
        ...lines,
      );
      if (this.lane) {
        // Phones: in the column lane, under a heading, never over the board or a label.
        el.dataset.side = 'lane';
        el.style.left = '';
        el.style.top = '';
        el.prepend(h('span', { class: 'lr-cap-head' }, 'Capacitor'));
        this.lane.append(el);
      } else this.dom.insertBefore(el, this.tip);
      this.capEls.push(el);
    }
  },

  /** Live read-out: show each Capacitor line once its bolt has arrived; the newest is lit. */
  updateCapLive(this: AltarScene): void {
    const tl = this.timeline;
    if (!tl || this.capBeats.length === 0) return;
    let newest = -1;
    this.capBeats.forEach((b, i) => {
      const show = this.st >= tl.segments[b.seg]!.t1;
      const el = this.capLines[i]!;
      if (el.hidden === show) el.hidden = !show;
      if (show) newest = i;
    });
    this.capLines.forEach((el, i) => {
      el.toggleAttribute('data-now', i === newest && this.mode === 'strike');
    });
  },

  showVerdict(
    this: AltarScene,
    text: string,
    outcome: BoltOutcome,
    story = '',
    hint = '',
    cause = '',
    strikes = '',
    also = '',
  ): void {
    // The verdict sits where the subtitle is; the subtitle steps aside until the next edit.
    this.subtitle.style.display = 'none';
    this.verdict.textContent = keepTogether(text);
    // Phones, multi-strike: each strike's reading, in words, right under the headline.
    if (strikes)
      this.verdict.append(h('small', { class: 'lr-verdict-strikes' }, keepTogether(strikes)));
    // teach-7: every other gauge that missed, named by its numbers ("Also missed: Needs 2, got
    // nothing.").
    if (also) this.verdict.append(h('small', { class: 'lr-verdict-also' }, keepTogether(also)));
    // Phones: where it went wrong rides in the verdict, not in a tag over the board.
    if (cause) this.verdict.append(h('small', { class: 'lr-verdict-cause' }, keepTogether(cause)));
    if (story) this.verdict.append(h('small', { class: 'lr-verdict-story' }, keepTogether(story)));
    // One visible next step (the fizzle tags fade; this stays until the next edit).
    else if (hint)
      this.verdict.append(h('small', { class: 'lr-verdict-hint' }, keepTogether(hint)));
    this.verdict.dataset.outcome = outcome;
    this.verdict.hidden = false;
    this.fitTop();
  },

  /**
   * One more line under the verdict: the first miss's "a miss costs nothing" (D-043). Only if
   * the verdict still fits with it: on a phone, whole inside the lane; on a big screen, in its
   * usual place under the title, clear of the red mark (not docked under the board, where
   * room is tight). Otherwise the line is taken back and this returns false.
   */
  verdictNote(this: AltarScene, text: string): boolean {
    const note = h('small', { class: 'lr-verdict-free' }, keepTogether(text));
    this.verdict.append(note);
    this.fitTop();
    const v = this.verdict;
    let fits: boolean;
    if (this.view.layout.phone) {
      const box = v.getBoundingClientRect();
      const lane = this.lane?.getBoundingClientRect();
      fits =
        v.scrollHeight <= v.clientHeight + 1 &&
        (!lane || (box.top >= lane.top - 0.5 && box.bottom <= lane.bottom + 0.5));
    } else {
      fits = !v.hasAttribute('data-docked') && !this.verdictCoversRoot();
    }
    if (fits) return true;
    note.remove();
    this.fitTop();
    return false;
  },

  /**
   * Say `text` through the sr-only live region. It is set a beat after clearing, so a repeat
   * of the same line (the same miss twice) is announced again.
   */
  announce(this: AltarScene, text: string): void {
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announcer.textContent = '';
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announcer.textContent = text;
    }, 80);
  },

  /** What the altar asks for, read when it opens: storm, strikes and every machine's need. */
  briefing(this: AltarScene): string {
    const p = this.puzzle;
    const needs = p.machines.map((m) => m.need);
    const ask =
      needs.length === 1
        ? `The machine needs exactly ${needs[0]}.`
        : `${needs.length} machines need exactly ${listText(needs.map(String))}.`;
    const strikes = p.pulses > 1 ? `, ${p.pulses} strikes` : '';
    const gives = stormCharge(p.storm.strength);
    const intro = this.introRows().map(
      (r) => `${r.again ? 'Reminder' : 'New'}: ${this.infoText(r)}`,
    );
    // teach-8: a multi-strike altar says its rule in the gauge's and the teach page's words.
    const rule = p.pulses > 1 ? ` ${ONE_STRIKE_RULE}` : '';
    return [
      `${getMachine(this.machine).name} altar. Storm ×${p.storm.strength} gives ${gives}${strikes}. ${ask}${rule}`,
      ...intro,
      ...(this.teachCell ? [`${RING_NAME}: ${RING_RULE}`] : []),
    ].join(' ');
  },

  /** The strike result for screen readers: the verdict plus every machine's reading. */
  resultText(this: AltarScene, verdict: string): string {
    const res = this.result!;
    const parts = [verdict.endsWith('.') ? verdict : `${verdict}.`];
    const multi = res.machines.length > 1;
    res.machines.forEach((m, i) => {
      const reads = this.strikeReadings[i] ?? [];
      const got =
        this.puzzle.pulses > 1 && reads.length > 0
          ? readingsText(reads)
          : `got ${this.lastReading(m)}`;
      if (multi || this.puzzle.pulses > 1) {
        const who = multi ? `Machine ${i + 1}` : 'The machine';
        parts.push(`${who}: needs ${m.need}, ${got}, ${OUTCOME_WORD[m.outcome] ?? 'no charge'}.`);
      }
    });
    if (this.tags.length > 0) {
      parts.push(`Where it went wrong: ${this.tags.map((t) => t.textContent ?? '').join('; ')}.`);
    }
    return parts.join(' ');
  },

  addTag(
    this: AltarScene,
    x: number,
    y: number,
    text: string,
    tone: 'bad' | 'info' = 'bad',
  ): HTMLElement {
    const el = h('div', { class: 'lr-altar-tag', style: { left: `${x}px`, top: `${y}px` } }, text);
    if (tone === 'info') el.dataset.tone = 'info';
    this.dom.append(el);
    this.tags.push(el);
    return el;
  },

  clearTags(this: AltarScene): void {
    for (const t of this.tags) t.remove();
    this.tags.length = 0;
  },

  /** "Needs N" and, once charge has landed, "got M" plus one entry per strike on multi-strike. */
  setNeed(this: AltarScene, i: number, need: number, got: number | null): void {
    const el = this.needs[i]!;
    const phone = !!this.view.layout.phone;
    // Phones, before Strike (mobile-7-strike): a lamp, lit when the charge path reaches this
    // gauge (reach.ts). On or off only: it never shows an amount.
    const lamp =
      phone && got === null
        ? h('i', {
            class: 'lr-need-lamp',
            'aria-hidden': 'true',
            ...(this.view.machineLinked[i] ? { 'data-on': '' } : {}),
          })
        : null;
    this.lampEls[i] = lamp;
    el.toggleAttribute('data-lamp', !!lamp);
    el.toggleAttribute('data-multi', this.puzzle.pulses > 1);
    const kids: (HTMLElement | string)[] = [
      h('span', { class: 'lr-need-row' }, lamp, 'Needs ', h('b', null, String(need))),
    ];
    // Multi-strike: each strike is read on its own; the strikes never add up at the machine.
    // teach-7: "on strike 1 or 2" (one of them, exactly; the arrival card says more trips it).
    if (got === null && this.puzzle.pulses > 1)
      kids.push(h('span', { class: 'lr-need-note' }, keepTogether(needNote(this.puzzle.pulses))));
    const rs = this.strikeReadings[i] ?? [];
    // Mid-strike, `got` is the strike still landing: show it as a live entry so "got 4"
    // never sits beside only "Strike 1: 2" and reads as strike 1's total.
    const live = got !== null && this.pulse >= 0 && rs.length <= this.pulse;
    if (got !== null && phone && this.puzzle.pulses > 1) {
      // teach-7 (D-040 add. 10, B): phones, multi-strike, once charge has landed: what each
      // strike brought, in order, "got 0, then 16 ✕", each number in its own outcome colour,
      // ✓ on the strike that woke the gauge and ✕ on the one that tripped it. A result, never
      // a forecast (D-043): it fills in only as each strike lands.
      const seen = live ? [...rs, got] : rs;
      const num = (r: number, k: number) => {
        const state =
          live && k === seen.length - 1
            ? 'live'
            : r === need
              ? 'exact'
              : r > need
                ? 'over'
                : 'under';
        return h('b', { 'data-state': state }, String(r));
      };
      // teach-8 (D-040 add. 11, A): each number names its strike, "strike 1: 0 · 2: 16 ✕"
      // (blind review 10: "got 0, then 16 ✕" didn't say which strike failed). The word
      // "strike" once, then the strikes' numbers, so it stays one line at SE size.
      const parts: (HTMLElement | string)[] = [];
      seen.forEach((r, k) => {
        parts.push(k === 0 ? `strike ${k + 1}: ` : ` · ${k + 1}: `);
        parts.push(num(r, k));
      });
      const last = seen.at(-1);
      if (!live && last === need) parts.push(h('i', { class: 'lr-need-mark' }, '✓'));
      else if (!live && last !== undefined && last > need)
        parts.push(h('i', { class: 'lr-need-mark', 'data-state': 'over' }, '✕'));
      kids.push(h('span', { class: 'lr-need-got', 'data-each': '' }, ...parts));
    } else if (got !== null) {
      kids.push(h('span', { class: 'lr-need-got' }, 'got ', h('b', null, String(got))));
      // Phones (mobile-7-strike): the card stays compact, "Needs 20 · got 0" (the strike now
      // landing, or the last); each strike's reading is told in words in the verdict.
      if (!phone && this.puzzle.pulses > 1 && (rs.length > 0 || live)) {
        const chip = (r: number, k: number, state: string) =>
          h('span', { 'data-state': state }, `Strike ${k + 1}: ${r}`);
        kids.push(
          h(
            'span',
            { class: 'lr-need-strikes' },
            ...rs.map((r, k) => chip(r, k, r === need ? 'exact' : r > need ? 'over' : 'under')),
            ...(live ? [chip(got, this.pulse, 'live')] : []),
          ),
        );
      }
    }
    el.replaceChildren(...kids);
    this.clearOfActions(el);
    const band = this.view.layout.phone;
    if (band && this.dom?.isConnected) this.placePhoneLabels(band);
  },
};
