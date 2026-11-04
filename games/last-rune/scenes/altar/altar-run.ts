/**
 * The strike: the bolt's run, pulse by pulse, and the result.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import type { BoltMode, BoltSegment } from '../../art/props/bolt';
import { exactLine, reactionLine } from '../../content/lines';
import type { BoltOutcome } from '../../game/flow';
import { type SimResult, simulate } from '../../rules';
import { FF_RATE, FIRST_MISS_LINE, OUT_GLOW, SKIP_RATE, TICK } from './altar-defs';
import type { AltarScene } from './altar-scene';
import { idleAmpArrivals } from './amp-idle';
import { capacitorBeats } from './circuit-model';
import { emitPuzzleEvent, type FireMachine, puzzleEventsWanted } from './events';
import { anchorOf } from './layout';
import { needleFor } from './needle';
import {
  type Arrival,
  alsoMissed,
  buildTimeline,
  causeHeadline,
  causeText,
  failHead,
  failText,
  fizzles,
  hintRoom,
  nextStep,
  rootCell,
  rootFizzle,
  strikeStory,
  strikesLine,
  verdictParts,
} from './strike';

export const runMethods = {
  strike(this: AltarScene): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.mode === 'result') this.backToEdit();
    const placements = this.board.serialise();
    const result = simulate(this.puzzle, placements);
    // Multi-strike: a longer rest between strikes so each reads as its own beat.
    const pulseGap = this.puzzle.pulses > 1 ? 1.4 : 0.9;
    const tl = buildTimeline(result, { tickSeconds: TICK, pulseGap, verdictDelay: 0.45 });
    this.result = result;
    this.timeline = tl;
    this.fizzleList = fizzles(this.puzzle, placements, result, tl);
    this.idleAmps = idleAmpArrivals(
      result.trace,
      [...this.puzzle.fixed, ...placements].filter((g) => g.gem === 'amplify').map((g) => g.cell),
    );
    this.attempts++;
    this.outcomes[result.outcome]++;
    this.ctx.flow.recordAttempt(this.machine, result.outcome);
    if (puzzleEventsWanted()) {
      const saved = this.ctx.save.get().puzzles[this.machine];
      emitPuzzleEvent({
        type: 'fire',
        machine: this.machine,
        t: this.time,
        attempt: saved?.attempts ?? this.attempts,
        placements,
        outcome: result.outcome,
        strikes: result.pulsesRun,
        machines: result.machines.map(
          (m): FireMachine => ({
            at: { x: m.at.x, y: m.at.y },
            need: m.need,
            outcome: m.outcome,
            readings: [...m.readings],
          }),
        ),
      });
    }

    // Ribbons: one per strike; the verdict strike plays in the outcome's mode, with the
    // segment that decides it (tripped machine / last fizzle) last so the ribbon ends there.
    const n = tl.pulses.length;
    this.pulseSegs = [];
    for (let i = 0; i < n; i++) {
      const segs = this.view.boltSegments(tl, i, []);
      if (i === n - 1) this.orderForVerdict(segs, result);
      this.pulseSegs.push(segs);
    }
    this.view.orientAlong(tl);
    this.view.deenergise();
    for (const m of this.view.machines) m.reset();
    this.readings = this.puzzle.machines.map(() => 0);
    this.strikeReadings = this.puzzle.machines.map(() => []);
    this.buildChips(result);
    this.capKey = '';
    this.renderCaps(capacitorBeats(this.puzzle, placements, result), result, true);
    for (let m = 0; m < this.view.machineGlow.length; m++) this.view.machineGlow[m] = 0;
    this.learnFixed();
    this.st = 0;
    this.pulse = -1;
    this.pulseEnded = -1;
    this.arrival = 0;
    this.verdictShown = false;
    this.wakeTimer = -1;
    this.skipping = false;
    this.rate = this.board.revision === this.strikeRevision ? 2 : 1; // repeats run quicker
    this.strikeRevision = this.board.revision;
    this.mode = 'strike';
    this.subtitle.textContent = n > 1 ? `Strike 1 of ${n}` : 'Strike';
    this.setStrikeRow(0);
    this.ctx.fuse.hush();
    this.refreshHud();
  },

  orderForVerdict(this: AltarScene, segs: BoltSegment[], result: SimResult): void {
    if (segs.length < 2) return;
    let key = -1;
    if (result.outcome === 'over' || result.outcome === 'exact' || result.outcome === 'under') {
      // Last segment that lands on a machine.
      const L = this.view.layout;
      for (let i = segs.length - 1; i >= 0 && key < 0; i--) {
        const s = segs[i]!;
        if (L.machines.some((m) => Math.abs(m.port.x - s.bx) < 1 && Math.abs(m.port.y - s.by) < 1))
          key = i;
      }
    }
    if (key < 0) {
      // Dead: end where the latest bolt died.
      let best = -1;
      for (let i = 0; i < segs.length; i++) if (best < 0 || segs[i]!.t1 >= segs[best]!.t1) best = i;
      key = best;
    }
    if (key >= 0 && key !== segs.length - 1) {
      const [s] = segs.splice(key, 1);
      segs.push(s!);
    }
  },

  outcomeMode(this: AltarScene, o: BoltOutcome): BoltMode {
    return o === 'over' ? 'over' : o === 'exact' ? 'exact' : 'under';
  },

  startPulse(this: AltarScene, i: number): void {
    const tl = this.timeline!;
    const res = this.result!;
    const last = i === tl.pulses.length - 1;
    const bolts = this.view.bolts;
    if (i > 0) bolts[i - 1]!.fadeOut(0.5);
    const bolt = bolts[i]!;
    const mode = last ? this.outcomeMode(res.outcome) : 'exact';
    bolt.intensity = mode === 'over' && this.reduceFlashes ? 0.45 : 1;
    bolt.play(this.pulseSegs[i]!, mode);
    this.view.setActiveBolts(i + 1);
    this.view.storm.surge(1);
    this.view.stormGlow = 1;
    this.view.shake = Math.max(this.view.shake, 0.25 + 0.1 * this.puzzle.storm.strength);
    const sx = (this.view.layout.storm.x - 960) / 960;
    if (!this.skipping) this.ctx.sound.sfx.play('thunder', { near: true, pan: sx });
    this.boltSound?.stop(0.1);
    this.boltSound = this.skipping
      ? null
      : this.ctx.sound.sfx.bolt(0.6 + 0.1 * this.puzzle.storm.strength);
    // New strike: machines not yet awake start counting again; stored charge is released.
    for (let m = 0; m < this.readings.length; m++) {
      const mr = res.machines[m]!;
      if (mr.wokeOn >= 0 && mr.wokeOn < i) continue;
      this.readings[m] = 0;
      this.view.machines[m]!.gauge = 0;
    }
    for (const b of this.view.board) {
      b.holding = false;
      if (i > 0) {
        b.energyTarget = 0;
        b.idle = false;
      }
    }
    if (tl.pulses.length > 1) this.subtitle.textContent = `Strike ${i + 1} of ${tl.pulses.length}`;
    this.setStrikeRow(i);
  },

  onArrival(this: AltarScene, a: Arrival): void {
    const L = this.view.layout;
    const quiet = this.skipping;
    switch (a.end) {
      case 'gem':
      case 'store':
      case 'wait': {
        const b = this.view.gemAt(a.cell);
        // held-gem: an Amplify the bolt passes undoubled stays idle (dim, no flare).
        const idle = this.idleAmps.has(a.seg);
        if (b && idle) b.idle = b.energyTarget === 0;
        else if (b) {
          b.idle = false;
          b.energyTarget = a.end === 'wait' ? 0.6 : 1;
          if (a.end === 'store') b.holding = true;
        }
        if (!quiet) {
          const kind = b?.g.kind ?? a.colour;
          this.ctx.sound.sfx.play('boltStep', {
            gem: kind,
            charge: a.charge,
            pan: this.panOf(a.cell),
          });
        }
        this.boltSound?.setIntensity(0.4 + 0.15 * Math.min(a.charge, 4), 0.05);
        break;
      }
      case 'machine': {
        const m = a.machine;
        if (m < 0) break;
        this.readings[m] = (this.readings[m] ?? 0) + a.charge;
        const need = this.puzzle.machines[m]!.need;
        this.view.machines[m]!.gauge = needleFor(this.readings[m]!, need);
        this.setNeed(m, need, this.readings[m]!);
        this.view.machineGlow[m] = 1;
        const col = this.view.machineColor[m]!;
        for (let k = 0; k < 4; k++) col[k] = OUT_GLOW.flow[k]!;
        break;
      }
      case 'fizzle':
      case 'ground': {
        const pt = { x: 0, y: 0 };
        anchorOf(L, a.cell, pt);
        this.ctx.particles.emit(
          {
            x: pt.x,
            y: pt.y,
            speed: [30, 160],
            life: [0.3, 0.8],
            size: [5, 1],
            colorStart: [1.6, 0.5, 0.25, 1],
            colorEnd: [0.2, 0.2, 0.22, 0],
            gravity: [0, -60],
            emissive: 0.8,
          },
          18,
        );
        if (!quiet) this.ctx.sound.sfx.play('fuseBzzt', { gain: 0.5, pan: this.panOf(a.cell) });
        break;
      }
    }
  },

  /** All arrivals of strike `i` are in: settle each machine for this strike. */
  endPulse(this: AltarScene, i: number): void {
    const res = this.result!;
    this.boltSound?.stop(0.25);
    this.boltSound = null;
    for (let m = 0; m < res.machines.length; m++) {
      const mr = res.machines[m]!;
      if (mr.wokeOn >= 0 && mr.wokeOn < i) continue;
      const got = mr.readings[i] ?? this.readings[m] ?? 0;
      const need = mr.need;
      const prop = this.view.machines[m]!;
      const el = this.needs[m]!;
      this.strikeReadings[m]![i] = got;
      this.setNeed(m, need, got);
      const state = got === need && mr.wokeOn === i ? 'exact' : got > need ? 'over' : 'under';
      this.settleChips(i, m, state);
      if (got > 0) {
        this.view.machineGlow[m] = 1;
        const col = this.view.machineColor[m]!;
        for (let k = 0; k < 4; k++) col[k] = OUT_GLOW[state][k]!;
      }
      if (got === need && mr.wokeOn === i) {
        prop.solve();
        el.dataset.state = 'exact';
        this.ctx.sound.sfx.play('machineExact');
      } else if (got > need) {
        // polish-9: the needle stays in the red at what arrived once the breaker has tripped.
        prop.breaker(needleFor(got, need));
        el.dataset.state = 'over';
        this.breaker();
      } else if (got > 0) {
        // polish-9: the needle rests short of the mark, at what arrived this strike.
        prop.gauge = needleFor(got, need);
        el.dataset.state = 'under';
        if (i === res.pulsesRun - 1) this.ctx.sound.sfx.play('machineUnder');
      } else {
        prop.gauge = 0;
        el.dataset.state = 'under';
      }
    }
    // Capacitors keep glowing between strikes.
    for (const b of this.view.board)
      if (!b.holding) b.energyTarget = Math.min(b.energyTarget, 0.35);
  },

  breaker(this: AltarScene): void {
    const soft = this.reduceFlashes;
    this.ctx.sound.sfx.play('breakerTrip');
    if (!soft) {
      this.view.shake = 1;
      this.bloomBoost = 1.4;
      this.view.bolts[Math.max(0, this.pulse)]!.flash(1);
    } else {
      this.bloomBoost = 0.15;
    }
  },

  showResult(this: AltarScene): void {
    const res = this.result!;
    this.verdictShown = true;
    this.mode = 'result';
    this.resultAge = 0;
    // solve-truth: the ribbon settles to a trace so the gems under it (glyph and direction)
    // read while the player studies the verdict.
    for (const b of this.view.bolts) b.dimTo(res.outcome === 'exact' ? 0.5 : 0.25, 0.15);
    const L = this.view.layout;
    const o = res.outcome;
    const ms = res.machines;
    const root = o === 'exact' ? undefined : rootCell(this.fizzleList);
    this.verdictAvoid =
      root && root.x >= 0 && root.y >= 0 && root.x < L.cols && root.y < L.rows ? root : null;
    // The numbers name the machine: its need label shows the same "Needs N · got M", lit in
    // the outcome colour, so a multi-machine verdict needs no "second machine" ordinal.
    const say = (_i: number, text: string) => text;
    let free = false;
    if (o === 'exact') {
      // The solve moment's FUSE line follows at once, so the exact line rides in the verdict.
      const [title, body] = verdictParts(
        exactLine(Math.min(4, this.ctx.tier()) as 1 | 2 | 3 | 4).text,
      );
      this.showVerdict(title, 'exact', body);
      this.wakeTimer = this.ctx.settings.reducedMotion ? 0.9 : 1.5;
      this.solved = true;
      this.ctx.sound.music.duck(0.5, 1.6);
    } else {
      const over = ms.findIndex((m) => m.outcome === 'over');
      const under = ms.findIndex((m) => m.outcome !== 'exact' && m.outcome !== 'over');
      // Phones, multi-strike: the strike line and the Capacitor read-out in the lane already
      // tell each strike, so the verdict skips the story and keeps the next step.
      const story =
        L.phone && this.puzzle.pulses > 1
          ? ''
          : strikeStory(this.puzzle.pulses, res, this.capBeats);
      // altar-truth: the hint names only gems this altar has, and the real cause.
      const about = o === 'over' ? ms[over] : ms[under];
      const room = hintRoom(this.puzzle, this.board.placements, res, this.capBeats, about);
      const hint = nextStep(
        o,
        this.fizzleList.map((f) => f.cause),
        this.touch && !this.keyboard,
        room,
      );
      // Phones: the root cause is in the verdict (the headline when nothing arrived, else a line
      // unless the strike's story already fills it); the red mark on the socket says where.
      const phone = !!L.phone;
      const why = phone ? rootFizzle('dead', this.fizzleList) : undefined;
      // Phones (mobile-7-strike): the cause in plain words ("The charge hit an empty socket"),
      // and the Try line under it, so cause and fix read together.
      const cause = why ? causeHeadline(why.cause) : '';
      // Phones, multi-strike: a plain headline, then each strike's reading in words ("Got 0,
      // then 8; needs 20 in one strike."); the gauge's own card stays compact.
      const multi = phone && this.puzzle.pulses > 1;
      const head = (m: SimResult['machines'][number], oc: 'over' | 'under') =>
        multi ? failHead(m, oc) : failText(m, oc, this.puzzle.pulses);
      const each = (m: SimResult['machines'][number]) =>
        multi ? strikesLine(m, this.puzzle.pulses) : '';
      if (o === 'over') {
        const m = ms[over]!;
        const text = say(over, head(m, 'over'));
        const also = alsoMissed(ms, over);
        this.showVerdict(text, 'over', story, hint, story ? '' : cause, each(m), also);
      } else if (o === 'under') {
        const m = ms[under] ?? ms[0]!;
        const text = say(under, head(m, 'under'));
        const also = alsoMissed(ms, Math.max(0, under));
        this.showVerdict(text, 'under', story, hint, story ? '' : cause, each(m), also);
      } else {
        // A title and the fix. On a phone the cause is the title ("The charge hit an empty
        // socket"); a separate title line would push the card past its line budget.
        this.showVerdict(
          cause.replace(/\.$/, '') || 'No charge reached the machine',
          'dead',
          '',
          hint,
        );
      }
      this.setStrikeWord('fail');
      // Idle hints ("Bend already here") give way to the verdict and its fizzle tags.
      this.clearTags();
      this.tagTimer = 0;
      this.refusedKey = '';
      // Teaching: name where it went wrong (first few fizzles, last strike first).
      const shown = new Set<string>();
      const placed: HTMLElement[] = [];
      let count = 0;
      const pt = { x: 0, y: 0 };
      for (let i = this.fizzleList.length - 1; !phone && i >= 0 && count < 3; i--) {
        const f = this.fizzleList[i]!;
        const k = `${f.cell.x},${f.cell.y}`;
        if (shown.has(k)) continue;
        shown.add(k);
        anchorOf(L, f.cell, pt);
        const tag = this.addTag(pt.x, pt.y - L.pitch * 0.38, causeText(f.cause));
        if (!this.placeClear(tag, pt.y - L.pitch * 0.38, pt.y + L.pitch * 0.38, placed)) continue;
        placed.push(tag);
        count++;
      }
      // D-043: the first miss ever says once that a strike is a free test.
      // Only where it fits: a long verdict keeps its room, and the line waits for a later miss.
      free = this.ctx.flow.firstMissDue() && this.verdictNote(FIRST_MISS_LINE);
      if (free) this.ctx.flow.tellFirstMiss();
      const line = reactionLine(
        o,
        Math.min(3, this.ctx.tier()) as 1 | 2 | 3,
        rootFizzle(o, this.fizzleList),
        this.attempts - 1,
      );
      // Phones: one message at a time. The quip waits until the player acts on the verdict.
      if (line && this.view.layout.phone) {
        this.ctx.fuse.hush();
        this.pendingQuip = line;
      } else if (line) void this.ctx.fuse.say(line, { interrupt: true });
    }
    // No attempt count anywhere (D-043): a strike is a free test, not a scored try.
    this.subtitle.textContent = o === 'exact' ? 'Restored' : 'Change anything and strike again';
    this.updateCapLive();
    const head = this.verdict.firstChild?.textContent ?? '';
    const told = this.verdict.querySelector('.lr-verdict-story')?.textContent;
    const next = this.verdict.querySelector('.lr-verdict-hint')?.textContent;
    this.announce(
      this.resultText(told ? `${head}. ${told}` : head) +
        (next ? ` ${next}` : '') +
        (o === 'exact'
          ? ''
          : `${free ? ` ${FIRST_MISS_LINE}` : ''} Change anything and strike again.`),
    );
    this.refreshHud();
  },

  lastReading(this: AltarScene, m: SimResult['machines'][number]): number {
    for (let i = m.readings.length - 1; i >= 0; i--)
      if ((m.readings[i] ?? 0) > 0) return m.readings[i]!;
    return 0;
  },

  /** Leave the result: bolts fade, gems cool, gauges drop. */
  backToEdit(this: AltarScene): void {
    this.mode = 'edit';
    this.verdict.hidden = true;
    this.verdictAvoid = null;
    this.subtitle.style.display = '';
    this.clearTags();
    this.clearChips();
    for (let m = 0; m < this.view.machineGlow.length; m++) this.view.machineGlow[m] = 0;
    this.view.deenergise();
    for (const b of this.view.bolts) b.fadeOut(0.35);
    for (const m of this.view.machines) m.reset();
    this.wakeTimer = -1;
    this.setStrikeRow(-1);
    this.refreshHud();
  },

  skip(this: AltarScene): void {
    if (this.skipping) return;
    this.skipping = true;
    this.rate = SKIP_RATE;
    this.boltSound?.stop(0.1);
    this.boltSound = null;
  },

  updateStrike(this: AltarScene, dt: number): void {
    const input = this.ctx.input;
    if (input.pressed('select') || input.pressed('confirm') || input.pressed('cancel')) this.skip();
    const rate = this.skipping
      ? SKIP_RATE
      : input.held('strike') && !input.pressed('strike')
        ? FF_RATE
        : this.rate;
    this.view.boltRate = rate;
    this.st += dt * rate;
    const tl = this.timeline!;
    while (this.pulse + 1 < tl.pulses.length && this.st >= tl.pulses[this.pulse + 1]!.start) {
      this.startPulse(++this.pulse);
    }
    while (this.arrival < tl.arrivals.length && tl.arrivals[this.arrival]!.t <= this.st) {
      this.onArrival(tl.arrivals[this.arrival++]!);
    }
    while (this.pulseEnded < this.pulse && this.st >= tl.pulses[this.pulseEnded + 1]!.end) {
      this.endPulse(++this.pulseEnded);
    }
    this.updateChips();
    this.updateCapLive();
    if (this.st >= tl.verdictAt && !this.verdictShown) {
      this.view.boltRate = 1;
      this.showResult();
    }
  },
};
