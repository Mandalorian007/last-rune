import { describe, expect, it } from 'vitest';
import { CODEX } from '../../content/codex';
import { PUZZLES, puzzleFor } from '../../content/puzzles';
import { type Placement, type PuzzleDef, simulate } from '../../rules';
import { altarDims } from '../../rules/model';
import type { GemKind } from '../../rules/types';
import { capacitorBeats, capBeatText, planOver } from './circuit-model';
import { anchorOf, cellAt, computeLayout, DESIGN_H, DESIGN_W } from './layout';
import {
  buildTimeline,
  causeHeadline,
  causeText,
  failText,
  fizzles,
  hintRoom,
  nextStep,
  roomGems,
  rootCell,
  rootFizzle,
  strikeStory,
  strikesLine,
  verdictParts,
} from './strike';

function bench(over: Partial<PuzzleDef> = {}): PuzzleDef {
  return {
    id: 'intake-desk',
    altar: '6x4',
    blocked: [{ x: 2, y: 2 }],
    fixed: [],
    storm: { at: { x: -1, y: 1 }, dir: 'E', strength: 1 },
    machines: [{ at: { x: 6, y: 1 }, need: 4 }],
    tray: { channel: 6, bend: 2, split: 1, gate: 1 },
    pulses: 1,
    design: { insight: '', minutes: 1, assumes: [], essential: [], intended: [] },
    ...over,
  };
}

describe('strike timeline', () => {
  it('times the intended solution and ends at the machine', () => {
    const p = puzzleFor('intake-desk');
    const r = simulate(p, p.design.intended);
    expect(r.outcome).toBe('exact');
    const tl = buildTimeline(r, { tickSeconds: 0.1, verdictDelay: 0.5 });
    expect(tl.segments).toHaveLength(r.trace.length);
    for (let i = 1; i < tl.arrivals.length; i++) {
      expect(tl.arrivals[i]!.t).toBeGreaterThanOrEqual(tl.arrivals[i - 1]!.t);
    }
    const last = tl.arrivals[tl.arrivals.length - 1]!;
    expect(last.end).toBe('machine');
    expect(last.machine).toBe(0);
    expect(tl.verdictAt).toBeCloseTo(tl.pulses[0]!.end + 0.5);
    expect(tl.segments[0]!.t0).toBe(0);
  });

  it('lays strikes end to end with a gap', () => {
    const p = puzzleFor('capacitor-bay');
    const r = simulate(p, p.design.intended);
    expect(r.pulsesRun).toBe(2);
    const tl = buildTimeline(r, { tickSeconds: 0.1, pulseGap: 1 });
    expect(tl.pulses[1]!.start).toBeCloseTo(tl.pulses[0]!.end + 1);
    for (const s of tl.segments) {
      const span = tl.pulses[s.seg.pulse]!;
      expect(s.t0).toBeGreaterThanOrEqual(span.start - 1e-9);
      expect(s.t1).toBeLessThanOrEqual(span.end + 1e-9);
    }
  });
});

describe('fizzle causes', () => {
  it('empty socket on a bare altar', () => {
    const p = bench();
    const r = simulate(p, []);
    expect(r.outcome).toBe('dead');
    expect(fizzles(p, [], r)).toEqual([{ cell: { x: 0, y: 1 }, pulse: 0, cause: 'empty', t: 0 }]);
  });

  it('blocked stone, bend facing away, odd split, lone gate, grounded', () => {
    const p = bench({ blocked: [{ x: 1, y: 1 }] });
    const ch = (x: number) => ({ gem: 'channel' as const, cell: { x, y: 1 }, rot: 0 as const });
    expect(fizzles(p, [ch(0)], simulate(p, [ch(0)]))[0]!.cause).toBe('blocked');

    const q = bench();
    // Bend rot 0 accepts N and E; a bolt travelling east enters from the W.
    const bend = [{ gem: 'bend' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, bend, simulate(q, bend))[0]!.cause).toBe('facing');
    // Split rot 0 takes its bolt from the S only; fed from the W it refuses.
    const split = [{ gem: 'split' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, split, simulate(q, split))[0]!.cause).toBe('facing');

    // Gate rot 1 outputs east, inputs N and S; fed from W it refuses.
    const gate = [{ gem: 'gate' as const, cell: { x: 0, y: 1 }, rot: 1 as const }];
    expect(fizzles(q, gate, simulate(q, gate))[0]!.cause).toBe('facing');
    // FUSE's quip hears the same root, with the gem it happened on.
    expect(rootFizzle('dead', fizzles(q, bend, simulate(q, bend)))).toEqual({
      cause: 'facing',
      gem: 'bend',
    });
    expect(rootFizzle('dead', fizzles(q, gate, simulate(q, gate)))).toEqual({
      cause: 'facing',
      gem: 'gate',
    });
    expect(rootFizzle('dead', fizzles(p, [], simulate(p, [])))).toEqual({ cause: 'empty' });
    expect(rootFizzle('over', fizzles(p, [], simulate(p, [])))).toBeUndefined();
    // The verdict keeps clear of the red mark the Try line names.
    expect(rootCell(fizzles(q, bend, simulate(q, bend)))).toEqual({ x: 0, y: 1 });
    expect(rootCell([])).toBeUndefined();
    // Gate rot 0 outputs north, inputs E and W: one input only.
    const lone = [{ gem: 'gate' as const, cell: { x: 0, y: 1 }, rot: 0 as const }];
    expect(fizzles(q, lone, simulate(q, lone))[0]!.cause).toBe('gate-alone');

    // A channel at the top edge pointing north runs off the altar.
    const up = [
      { gem: 'bend' as const, cell: { x: 0, y: 1 }, rot: 3 as const }, // W–N
      { gem: 'channel' as const, cell: { x: 0, y: 0 }, rot: 0 as const },
    ];
    const g = fizzles(q, up, simulate(q, up));
    expect(g[0]!.cause).toBe('ground');
  });

  it('split halves that run off or into empty sockets', () => {
    const p = bench({ tray: { split: 2, channel: 4, bend: 2 } });
    // Split (0,1) (input W) sends 2 north to split (0,0) (input S): 1 west (off the altar),
    // 1 east (empty).
    const pl = [
      { gem: 'split' as const, cell: { x: 0, y: 1 }, rot: 1 as const },
      { gem: 'split' as const, cell: { x: 0, y: 0 }, rot: 0 as const },
    ];
    const r = simulate(p, pl);
    const f = fizzles(p, pl, r);
    expect(f.map((x) => x.cause)).toContain('empty');
    expect(f.map((x) => x.cause)).toContain('ground');
  });
});

describe('layout', () => {
  it('fits every puzzle on the design canvas and round-trips cells', () => {
    for (const p of Object.values(PUZZLES)) {
      const L = computeLayout(p);
      const { w, h } = altarDims(p.altar);
      expect(L.cols).toBe(w);
      expect(L.left).toBeGreaterThan(0);
      expect(L.right).toBeLessThan(DESIGN_W);
      expect(L.top).toBeGreaterThan(40);
      expect(L.frontBottom).toBeLessThan(L.trayY - 60);
      const pt = { x: 0, y: 0 };
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          anchorOf(L, { x, y }, pt);
          expect(cellAt(L, pt.x, pt.y)).toEqual({ x, y });
        }
      for (const m of [L.storm, ...L.machines]) {
        expect(m.port.x).toBeGreaterThan(0);
        expect(m.port.x).toBeLessThan(DESIGN_W);
        expect(m.port.y).toBeGreaterThan(0);
        expect(m.port.y).toBeLessThan(DESIGN_H);
      }
    }
  });
});

describe('failed-verdict guidance', () => {
  it('a machine that got nothing is a broken path, not "not enough"', () => {
    const m = { at: { x: 0, y: 0 }, need: 2, outcome: 'dead' as const, readings: [0], wokeOn: -1 };
    expect(failText(m, 'under', 1)).toBe('Got 0, needs 2: no charge reached this machine');
  });

  it('names one next step: the root fizzle first, else the outcome', () => {
    // The relay with one arm missing: the empty socket is the cause, the lone Gate the effect.
    expect(nextStep('dead', ['gate-alone', 'empty'])).toMatch(/put a gem in the socket/);
    expect(nextStep('dead', ['facing'])).toMatch(/turn the gem/);
    expect(nextStep('over', ['ground'])).toMatch(/less charge/);
    const withAmp = {
      gems: new Set(['channel', 'amplify'] as const),
      path: new Set(['channel'] as const),
      beats: [],
    };
    expect(nextStep('under', [], false, withAmp)).toMatch(/Amplify/);
    expect(nextStep('exact', [])).toBe('');
    const all = [
      'empty',
      'blocked',
      'ground',
      'facing',
      'odd-split',
      'gate-alone',
      'spent',
    ] as const;
    for (const c of all) expect(nextStep('dead', [c])).toMatch(/^Try: /);
    // A finger is told the on-screen control, not R or scroll.
    expect(nextStep('dead', ['facing'], true)).toMatch(/Turn\)/);
    expect(nextStep('dead', ['facing'], true)).not.toMatch(/scroll/);
  });

  it('says "charge", never the untaught bolt or fizzle (mobile-6-moments)', () => {
    const words = /\b(bolts?|fizzl\w*|stem|arms?|sparks?)\b/i;
    const all = [
      'empty',
      'blocked',
      'ground',
      'facing',
      'odd-split',
      'gate-alone',
      'spent',
    ] as const;
    for (const c of all) {
      expect(causeText(c)).not.toMatch(words);
      expect(nextStep('dead', [c])).not.toMatch(words);
    }
    for (const o of ['over', 'under', 'dead'] as const) expect(nextStep(o, [])).not.toMatch(words);
  });
});

/** Capacitor Bay's natural first try: straight up through the Capacitor to the 8 machine. */
const BAY_OVER: Placement[] = [
  { cell: { x: 4, y: 5 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 4 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 3 }, gem: 'channel', rot: 0 },
  { cell: { x: 4, y: 2 }, gem: 'bend', rot: 1 },
  { cell: { x: 6, y: 2 }, gem: 'channel', rot: 0 },
  { cell: { x: 7, y: 2 }, gem: 'channel', rot: 0 },
];

describe('hints come from the room (altar-truth)', () => {
  const OUTCOMES = ['over', 'under', 'dead'] as const;
  const CAUSES = [
    'empty',
    'blocked',
    'ground',
    'facing',
    'odd-split',
    'gate-alone',
    'spent',
  ] as const;
  /** A cause only happens where its gem is: an odd split needs a Split, a lone side a Gate. */
  const possible = (gems: ReadonlySet<GemKind>, c: (typeof CAUSES)[number]) =>
    (c !== 'odd-split' || gems.has('split')) && (c !== 'gate-alone' || gems.has('gate'));
  const named = (text: string) =>
    (Object.keys(CODEX) as GemKind[]).filter((g) =>
      new RegExp(`\\b${CODEX[g].name}s?\\b`).test(text),
    );
  const verdictText = (p: PuzzleDef, places: readonly Placement[]) => {
    const res = simulate(p, places);
    const beats = capacitorBeats(p, places, res);
    const ms = res.machines;
    const about =
      res.outcome === 'over'
        ? ms.find((m) => m.outcome === 'over')
        : ms.find((m) => m.outcome !== 'exact' && m.outcome !== 'over');
    const room = hintRoom(p, places, res, beats, about);
    const causes = fizzles(p, places, res).map((f) => f.cause);
    return [
      nextStep(res.outcome, causes, false, room),
      nextStep(res.outcome, causes, true, room),
      strikeStory(p.pulses, res, beats),
    ].join(' ');
  };

  it('for every puzzle × outcome × cause, the hint names no gem the puzzle lacks', () => {
    for (const p of Object.values(PUZZLES)) {
      const gems = roomGems(p);
      // Worst case: the charge went through every gem the room has, and a Capacitor (if any)
      // let out more than the machine needs.
      const beats = gems.has('capacitor')
        ? [
            {
              cell: { x: 0, y: 0 },
              pulse: 1,
              kind: 'release' as const,
              stored: 8,
              incoming: 8,
              out: 16,
              seg: 0,
            },
          ]
        : [];
      const room = { gems, path: gems, beats };
      for (const o of OUTCOMES)
        for (const touch of [false, true])
          for (const cs of [[], ...CAUSES.filter((c) => possible(gems, c)).map((c) => [c])]) {
            const hint = nextStep(o, cs, touch, room);
            for (const g of named(hint)) expect(gems, `${p.id} ${o} [${cs}]: ${hint}`).toContain(g);
          }
    }
  });

  it('on real attempts (every prefix of the intended solve), names only gems the puzzle has', () => {
    for (const p of Object.values(PUZZLES)) {
      const gems = roomGems(p);
      const plan = p.design.intended;
      for (let n = 0; n <= plan.length; n++) {
        const text = verdictText(p, plan.slice(0, n));
        for (const g of named(text)) expect(gems, `${p.id} first ${n}: ${text}`).toContain(g);
      }
    }
  });

  it('names the real cause: the Capacitor let out 8 + 8 on Capacitor Bay, no Amplify', () => {
    const p = puzzleFor('capacitor-bay');
    expect(roomGems(p).has('amplify')).toBe(false);
    const res = simulate(p, BAY_OVER);
    expect(res.outcome).toBe('over');
    const beats = capacitorBeats(p, BAY_OVER, res);
    const m = res.machines.find((x) => x.outcome === 'over');
    const hint = nextStep('over', [], true, hintRoom(p, BAY_OVER, res, beats, m));
    expect(hint).toBe('Try: feed the Capacitor less. It let out 8 + 8 = 16. A Split halves it.');
    expect(hint).not.toMatch(/Amplify/);
  });

  it("the Capacitor's plan warns when it lets out more than the machine takes", () => {
    const p = puzzleFor('capacitor-bay');
    const res = simulate(p, BAY_OVER);
    const beats = capacitorBeats(p, BAY_OVER, res);
    const over = planOver(beats, res);
    const i = beats.findIndex((b) => b.kind === 'release');
    expect(over.beats.get(i)).toBe(8);
    expect(capBeatText(beats[i]!, p.pulses, 8)).toBe('Strike 2 sends 16; needs 8.');
    expect([...over.machines].map((j) => res.machines[j]!.need)).toEqual([8]);
    // The intended solve warns nowhere.
    const ok = simulate(p, p.design.intended);
    expect(planOver(capacitorBeats(p, p.design.intended, ok), ok).machines.size).toBe(0);
  });

  it('with no room, names no gem at all', () => {
    for (const o of OUTCOMES) expect(named(nextStep(o, []))).toEqual([]);
  });

  it('every verdict line is a full sentence: causes end in a full stop, strikes too', () => {
    for (const c of CAUSES) expect(causeHeadline(c)).toMatch(/\.$/);
    const m = {
      at: { x: 0, y: 0 },
      need: 8,
      outcome: 'over' as const,
      readings: [0, 16],
      wokeOn: 1,
    };
    expect(strikesLine(m, 2)).toBe('Got 0, then 16; needs 8 in either strike.');
    expect(verdictParts('Exactly right. Look at it go.')).toEqual([
      'Exactly right.',
      'Look at it go.',
    ]);
    expect(verdictParts('Exact')).toEqual(['Exact', '']);
  });
});
