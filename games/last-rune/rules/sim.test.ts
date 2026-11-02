import { describe, expect, it } from 'vitest';
import { blockedFromAscii, fromAscii } from './ascii';
import type { MachineTarget, Placement, PuzzleDef } from './model';
import { simulate } from './sim';
import type { StormStrength } from './types';
import { puzzleProblems, validatePlacement } from './validate';

/** 6x4 test bench: storm fires east into (0,1); default machine east of (5,1). */
function bench(
  opts: {
    machines?: MachineTarget[];
    strength?: StormStrength;
    pulses?: number;
    blocked?: string[];
    fixed?: Placement[];
  } = {},
): PuzzleDef {
  return {
    id: 'intake-desk',
    altar: '6x4',
    blocked: opts.blocked ? blockedFromAscii(opts.blocked) : [],
    fixed: opts.fixed ?? [],
    storm: { at: { x: -1, y: 1 }, dir: 'E', strength: opts.strength ?? 1 },
    machines: opts.machines ?? [{ at: { x: 6, y: 1 }, need: 4 }],
    tray: { channel: 24, bend: 24, split: 24, amplify: 24, gate: 24, capacitor: 24 },
    pulses: opts.pulses ?? 1,
    design: { insight: '', minutes: 1, assumes: [], essential: [], intended: [] },
  };
}

const run = (p: PuzzleDef, rows: string[]) => simulate(p, fromAscii(rows));
const readings = (p: PuzzleDef, rows: string[]) => run(p, rows).machines.map((m) => m.readings);

describe('channel and the basic circuit', () => {
  it('a full row of channels delivers exactly one bolt (4 sparks)', () => {
    const r = run(bench(), ['. . . . . .', '= = = = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('exact');
    expect(r.machines[0]!.readings).toEqual([4]);
    expect(r.machines[0]!.wokeOn).toBe(0);
  });

  it('an empty socket breaks the circuit', () => {
    const r = run(bench(), ['. . . . . .', '= = . = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
    expect(r.trace.at(-1)!.end).toBe('fizzle');
  });

  it('nothing placed: dead, and the only segment is the storm hop', () => {
    const r = simulate(bench(), []);
    expect(r.outcome).toBe('dead');
    expect(r.trace).toHaveLength(1);
    expect(r.trace[0]!.from).toEqual({ x: -1, y: 1 });
    expect(r.trace[0]!.to).toEqual({ x: 0, y: 1 });
  });

  it('channels carry in any direction', () => {
    // storm from the north into column 2, machine south of it
    const p = bench({ machines: [{ at: { x: 2, y: 4 }, need: 4 }] });
    p.storm = { at: { x: 2, y: -1 }, dir: 'S', strength: 1 };
    expect(run(p, ['. . = . . .', '. . = . . .', '. . = . . .', '. . = . . .']).outcome).toBe(
      'exact',
    );
  });

  it('a bolt leaving the altar where no machine sits grounds harmlessly', () => {
    const r = run(bench(), ['. . . . . .', '= = └ . . .', '. . . . . .', '. . . . . .']);
    // bend N-E entered from W? no: └ joins N and E; entering from W bounces.
    expect(r.trace.at(-1)!.end).toBe('fizzle');
    const r2 = run(bench(), ['. . = . . .', '= = ┘ . . .', '. . . . . .', '. . . . . .']);
    expect(r2.trace.at(-1)!.end).toBe('ground');
    expect(r2.outcome).toBe('dead');
  });

  it('a blocked socket stops the bolt and cannot hold a gem', () => {
    const p = bench({ blocked: ['. . . . . .', '. . # . . .', '. . . . . .', '. . . . . .'] });
    const r = run(p, ['. . . . . .', '= = = = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
    expect(validatePlacement(p, [], { x: 2, y: 1 }, 'channel')).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });
});

describe('bend', () => {
  // The storm bolt enters (0,1) heading east, i.e. through the west side of (0,1).
  const at01 = (glyph: string) =>
    run(bench(), ['. . . . . .', `${glyph} . . . . .`, '. . . . . .', '. . . . . .']);

  it('└ (N-E) and ┌ (E-S) bounce a bolt arriving from the west', () => {
    for (const g of ['└', '┌']) {
      const r = at01(g);
      expect(r.trace).toHaveLength(1);
      expect(r.trace[0]!.end).toBe('fizzle');
    }
  });

  it('┐ (S-W) turns it south and ┘ (W-N) turns it north', () => {
    const south = at01('┐').trace[1]!;
    expect(south.colour).toBe('bend');
    expect(south.to).toEqual({ x: 0, y: 2 });
    expect(at01('┘').trace[1]!.to).toEqual({ x: 0, y: 0 });
  });

  it('a detour of four bends around a stone wakes the machine', () => {
    const p = bench({ blocked: ['. . . . . .', '. . # . . .', '. . . . . .', '. . . . . .'] });
    const r = run(p, ['. . . . . .', '= ┐ # ┌ = =', '. └ = ┘ . .', '. . . . . .']);
    expect(r.outcome).toBe('exact');
  });

  it('bends are reversible: either joined side is an entry', () => {
    // ┐ joins S and W. Enter from S (bolt heading N) and leave W.
    const p = bench({ machines: [{ at: { x: -1, y: 0 }, need: 4 }] });
    p.storm = { at: { x: 1, y: 4 }, dir: 'N', strength: 1 };
    const r = run(p, ['┐ ┐ . . . .', '. = . . . .', '. = . . . .', '. = . . . .']);
    // (1,0) ┐ entered from S leaves W into (0,0) ┐ entered from E: bounce.
    expect(r.outcome).toBe('dead');
    const r2 = run(p, ['= ┐ . . . .', '. = . . . .', '. = . . . .', '. = . . . .']);
    expect(r2.outcome).toBe('exact');
  });
});

describe('split', () => {
  const two: MachineTarget[] = [
    { at: { x: 3, y: -1 }, need: 2 },
    { at: { x: 3, y: 4 }, need: 2 },
  ];
  it('sends half out of each perpendicular side', () => {
    const r = run(bench({ machines: two }), [
      '. . . = . .',
      '= = = S1 . .',
      '. . . = . .',
      '. . . = . .',
    ]);
    expect(r.outcome).toBe('exact');
    expect(r.machines.map((m) => m.readings[0])).toEqual([2, 2]);
  });

  it('takes a bolt only through its one input side (rot 0: from the S)', () => {
    // Storm W, split at (3,1). Only S1 (input W) passes; every other turn fizzles there.
    for (const rot of [0, 1, 2, 3] as const) {
      const r = run(bench({ machines: two }), [
        '. . . = . .',
        `= = = S${rot} . .`,
        '. . . = . .',
        '. . . = . .',
      ]);
      expect(r.outcome).toBe(rot === 1 ? 'exact' : 'dead');
      const into = r.trace.find((s) => s.to.x === 3 && s.to.y === 1)!;
      expect(into.end).toBe(rot === 1 ? 'gem' : 'fizzle');
    }
  });

  it('rot 0 takes from the S and sends halves W then E', () => {
    // Storm from below at column 2; S0 at (2,1) sends 2 west and 2 east.
    const p: PuzzleDef = {
      ...bench({
        machines: [
          { at: { x: -1, y: 1 }, need: 2 },
          { at: { x: 6, y: 1 }, need: 2 },
        ],
      }),
      storm: { at: { x: 2, y: 4 }, dir: 'N', strength: 1 },
    };
    const r = run(p, ['. . . . . .', '= = S0 = = =', '. . = . . .', '. . = . . .']);
    expect(r.outcome).toBe('exact');
    const out = r.trace.filter((s) => s.from.x === 2 && s.from.y === 1);
    expect(out.map((s) => s.to.x)).toEqual([1, 3]);
  });

  it('nothing goes straight on', () => {
    const r = run(bench(), ['. . . . . .', '= = = S1 = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
  });

  it('halves meeting again at one machine add back up', () => {
    // split at (1,1): halves go N and S, loop round to the machine row via bends
    const r = run(bench(), ['. ┌ = = ┐ .', '= S1 . . └ =', '. └ = = ┐ .', '. . . . . .']);
    // the south half reaches (4,2) ┐ entered from W -> leaves S: grounds. Only 2 arrives.
    expect(r.machines[0]!.readings).toEqual([2]);
    expect(r.outcome).toBe('under');
  });

  it('an odd charge into a split fizzles there', () => {
    // 1x storm, split twice to make 1, then a third split.
    const p = bench({ machines: [{ at: { x: 6, y: 2 }, need: 1 }] });
    const ok = run(p, ['. . . . . .', '= = S1 . . .', '. . ┘ . . .', '. . . . . .']);
    expect(ok.outcome).toBe('dead');
    // Build 4 -> S(2,1): 2 south -> (2,2) S: 1 east -> (3,2) = ... machine at (6,2) needs 1
    const ok2 = run(p, ['. . . . . .', '= = S1 . . .', '. . S2 = = =', '. . . . . .']);
    expect(ok2.outcome).toBe('exact');
    // 1 -> another split shorts
    const bad = run(p, ['. . . . . .', '= = S1 . . .', '. . S2 = S1 =', '. . . . . .']);
    expect(bad.outcome).toBe('dead');
    expect(bad.trace.find((s) => s.to.x === 4 && s.to.y === 2)!.end).toBe('fizzle');
  });
});

describe('amplify', () => {
  it('doubles the charge', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 8 }] });
    expect(
      readings(
        p,
        ['', '= = A = = =', '', ''].map((s) => s || '. . . . . .'),
      ),
    ).toEqual([[8]]);
  });

  it('once per path: a second amber does nothing', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 8 }] });
    const r = run(p, ['. . . . . .', '= A = A = =', '. . . . . .', '. . . . . .']);
    expect(r.machines[0]!.readings).toEqual([8]);
    expect(r.outcome).toBe('exact');
  });

  it('too much trips the breaker', () => {
    const r = run(bench(), ['. . . . . .', '= = A = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('over');
    expect(r.machines[0]!.outcome).toBe('over');
  });

  const two: MachineTarget[] = [
    { at: { x: 4, y: -1 }, need: 4 },
    { at: { x: 4, y: 4 }, need: 4 },
  ];
  it('amber before magenta: amplify then split gives 4 + 4', () => {
    const r = run(bench({ machines: two }), [
      '. . . . = .',
      '= A = = S1 .',
      '. . . . = .',
      '. . . . = .',
    ]);
    expect(r.outcome).toBe('exact');
  });

  it('never after: split then amplify gives 4 + 2', () => {
    const r = run(bench({ machines: two }), [
      '. . . . A .',
      '= = = = S1 .',
      '. . . . = .',
      '. . . . = .',
    ]);
    expect(r.machines.map((m) => m.readings[0])).toEqual([4, 2]);
    expect(r.outcome).toBe('under');
  });

  it('halves of an amplified bolt stay marked', () => {
    const r = run(bench({ machines: two }), [
      '. . . . A .',
      '= A = = S1 .',
      '. . . . A .',
      '. . . . = .',
    ]);
    expect(r.machines.map((m) => m.readings[0])).toEqual([4, 4]);
  });
});

describe('gate', () => {
  // 4 -> split at (1,1) -> halves loop round into a gate at (3,1) facing E (rot 1).
  const loop = ['. ┌ = ┐ . .', '= S1 . G1 = =', '. └ = ┘ . .', '. . . . . .'];

  it('fires when both inputs are live, sending the sum', () => {
    const r = run(bench(), loop);
    expect(r.outcome).toBe('exact');
    expect(r.machines[0]!.readings).toEqual([4]);
    const out = r.trace.find((s) => s.from.x === 3 && s.from.y === 1)!;
    expect(out.colour).toBe('gate');
    expect(out.charge).toBe(4);
  });

  it('a lone input does nothing', () => {
    const r = run(bench(), ['. ┌ = ┐ . .', '= S1 . G1 = =', '. └ = . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
    expect(r.trace.filter((s) => s.end === 'wait')).toHaveLength(0);
    expect(r.trace.filter((s) => s.to.x === 3 && s.to.y === 1)[0]!.end).toBe('fizzle');
  });

  it('a bolt into the output side or the back fizzles', () => {
    const r = run(bench(), ['. . . . . .', '= = G1 = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
    const r2 = run(bench(), ['. . . . . .', '= = G3 = = =', '. . . . . .', '. . . . . .']);
    expect(r2.outcome).toBe('dead');
  });

  it('waits for a late input within the same strike', () => {
    // the south half takes a longer route (arrives tick 8, north arrives tick 6)
    const r = run(bench(), ['. ┌ = ┐ . .', '= S1 . G1 = =', '. = . = . .', '. └ = ┘ . .']);
    expect(r.outcome).toBe('exact');
    const inputs = r.trace.filter((s) => s.to.x === 3 && s.to.y === 1);
    expect(inputs.map((s) => [s.tick + 1, s.end])).toEqual([
      [6, 'wait'],
      [8, 'wait'],
    ]);
    expect(r.trace.find((s) => s.from.x === 3 && s.from.y === 1)!.tick).toBe(8);
  });

  it('re-joins an asymmetric split: amber on one branch makes 6', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 6 }] });
    const r = run(p, ['. ┌ A ┐ . .', '= S1 . G1 = =', '. └ = ┘ . .', '. . . . . .']);
    expect(r.machines[0]!.readings).toEqual([6]);
    expect(r.outcome).toBe('exact');
  });

  it('carries the amber mark if either input had it', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 6 }] });
    const r = run(p, ['. ┌ A ┐ . .', '= S1 . G1 A =', '. └ = ┘ . .', '. . . . . .']);
    expect(r.machines[0]!.readings).toEqual([6]);
  });
});

describe('capacitor and strikes', () => {
  const need8 = [{ at: { x: 6, y: 1 }, need: 8 }];
  const row = ['. . . . . .', '= = C = = =', '. . . . . .', '. . . . . .'];

  it('stores the first strike: nothing comes out', () => {
    const r = run(bench({ machines: need8, pulses: 1 }), row);
    expect(r.outcome).toBe('dead');
    expect(r.trace.find((s) => s.to.x === 2)!.end).toBe('store');
  });

  it('releases stored + incoming on the next strike', () => {
    const r = run(bench({ machines: need8, pulses: 2 }), row);
    expect(r.outcome).toBe('exact');
    expect(r.machines[0]!.readings).toEqual([0, 8]);
    expect(r.machines[0]!.wokeOn).toBe(1);
  });

  it('ignores once-per-path: amber then capacitor makes 16', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 16 }], pulses: 2 });
    expect(readings(p, ['. . . . . .', '= A = C = =', '. . . . . .', '. . . . . .'])).toEqual([
      [0, 16],
    ]);
  });

  it('alternates store / release across strikes', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 99 }], pulses: 4 });
    expect(readings(p, row)).toEqual([[0, 8, 0, 8]]);
  });

  it('two capacitors in a row need four strikes', () => {
    const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 16 }], pulses: 4 });
    expect(readings(p, ['. . . . . .', '= C = C = =', '. . . . . .', '. . . . . .'])).toEqual([
      [0, 0, 0, 16],
    ]);
  });

  it('the storm stops once every machine is awake', () => {
    const r = run(bench({ pulses: 3 }), [
      '. . . . . .',
      '= = = = = =',
      '. . . . . .',
      '. . . . . .',
    ]);
    expect(r.pulsesRun).toBe(1);
  });

  it('an awake machine ignores later strikes; a tripped breaker ends the attempt', () => {
    // Machine A (east) needs 4 and gets 4 every strike through a split; machine B (south)
    // gets 2 then the capacitor's 4.
    const p = bench({
      pulses: 3,
      machines: [
        { at: { x: 3, y: -1 }, need: 2 },
        { at: { x: 3, y: 4 }, need: 4 },
      ],
    });
    const r = run(p, ['. . . = . .', '= = = S1 . .', '. . . C . .', '. . . = . .']);
    expect(r.outcome).toBe('exact');
    expect(r.machines[0]!.readings).toEqual([2]);
    expect(r.machines[1]!.readings).toEqual([0, 4]);
    expect(r.pulsesRun).toBe(2);

    const q = bench({
      pulses: 3,
      machines: [
        { at: { x: 3, y: -1 }, need: 4 },
        { at: { x: 3, y: 4 }, need: 2 },
      ],
    });
    const r2 = run(q, ['. . . = . .', '= = = S1 . .', '. . . C . .', '. . . = . .']);
    expect(r2.outcome).toBe('over');
    expect(r2.pulsesRun).toBe(2);
    expect(r2.machines[1]!.outcome).toBe('over');
  });
});

describe('collisions and loops', () => {
  it('a bolt looping back into its own path fizzles; the strike ends', () => {
    // 4 -> split at (2,1): north half loops ┌┐ back down into the split.
    const r = run(bench(), ['. . ┌ ┐ . .', '= = S1 ┘ . .', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead');
    expect(r.trace.length).toBeLessThan(20);
  });

  it('a second bolt into an already-used gem fizzles; the first one counts', () => {
    // North half reaches channel (5,0) on tick 7 and exits to the machine; the south half
    // winds round and reaches (5,0) from below on tick 9: already used, so it fizzles.
    const p = bench({ machines: [{ at: { x: 6, y: 0 }, need: 2 }] });
    const r = run(p, ['. ┌ = = = =', '= S1 . . ┌ ┘', '. └ = = ┘ .', '. . . . . .']);
    expect(r.outcome).toBe('exact');
    const hits = r.trace.filter((s) => s.to.x === 5 && s.to.y === 0);
    expect(hits.map((s) => [s.tick + 1, s.end])).toEqual([
      [7, 'gem'],
      [9, 'fizzle'],
    ]);
  });

  it('two bolts reaching the same gem on the same tick both fizzle', () => {
    const p = bench({ machines: [{ at: { x: 3, y: 4 }, need: 2 }] });
    // halves: north via (1,0) east, south via (1,2) east, both turn into column 3 toward (3,1)
    const r = run(p, ['. ┌ = ┐ . .', '= S1 . = . .', '. └ = ┘ . .', '. . . . . .']);
    // Both halves reach (3,1) channel on the same tick: short.
    const hits = r.trace.filter((s) => s.to.x === 3 && s.to.y === 1);
    expect(hits).toHaveLength(2);
    expect(hits.every((s) => s.end === 'fizzle')).toBe(true);
    expect(r.outcome).toBe('dead');
  });
});

describe('render trace', () => {
  const p = bench({ machines: [{ at: { x: 6, y: 1 }, need: 6 }] });
  const rows = ['. ┌ A ┐ . .', '= S1 . G1 = =', '. └ = ┘ . .', '. . . . . .'];

  it('is well-formed: adjacent hops, normalised times, colours from the last gem', () => {
    const r = run(p, rows);
    for (const s of r.trace) {
      expect(Math.abs(s.from.x - s.to.x) + Math.abs(s.from.y - s.to.y)).toBe(1);
      expect(s.t0).toBeGreaterThanOrEqual(0);
      expect(s.t1).toBeLessThanOrEqual(1);
      expect(s.t1).toBeGreaterThan(s.t0);
    }
    expect(r.trace[0]!.colour).toBe('channel');
    const amberOut = r.trace.find((s) => s.from.x === 2 && s.from.y === 0)!;
    expect(amberOut.colour).toBe('amplify');
    expect(amberOut.charge).toBe(4);
    expect(r.trace.at(-1)!.end).toBe('machine');
    expect(r.trace.at(-1)!.t1).toBe(1);
  });

  it('is deterministic', () => {
    expect(run(p, rows)).toEqual(run(p, rows));
  });

  it('spans every strike, in order', () => {
    const q = bench({ machines: [{ at: { x: 6, y: 1 }, need: 8 }], pulses: 2 });
    const r = run(q, ['. . . . . .', '= = C = = =', '. . . . . .', '. . . . . .']);
    const p0 = r.trace.filter((s) => s.pulse === 0);
    const p1 = r.trace.filter((s) => s.pulse === 1);
    expect(p0.length).toBe(3);
    expect(p1.length).toBe(7);
    expect(Math.max(...p0.map((s) => s.t1))).toBeLessThan(Math.min(...p1.map((s) => s.t0)));
  });
});

describe('validation', () => {
  it('validatePlacement reports every reason', () => {
    const p = bench({
      blocked: ['# . . . . .', '. . . . . .', '. . . . . .', '. . . . . .'],
      fixed: [{ gem: 'amplify', cell: { x: 1, y: 0 }, rot: 0 }],
    });
    p.tray = { channel: 1 };
    const placed: Placement[] = [{ gem: 'channel', cell: { x: 2, y: 0 }, rot: 0 }];
    expect(validatePlacement(p, [], { x: 6, y: 0 }, 'channel').reason).toBe('out-of-bounds');
    expect(validatePlacement(p, [], { x: 0, y: 0 }, 'channel').reason).toBe('blocked');
    expect(validatePlacement(p, [], { x: 1, y: 0 }, 'channel').reason).toBe('fixed');
    expect(validatePlacement(p, placed, { x: 2, y: 0 }, 'channel').reason).toBe('occupied');
    expect(validatePlacement(p, placed, { x: 3, y: 0 }, 'channel').reason).toBe('tray-empty');
    expect(validatePlacement(p, [], { x: 3, y: 0 }, 'bend').reason).toBe('tray-empty');
    expect(validatePlacement(p, [], { x: 3, y: 0 }, 'channel')).toEqual({ ok: true });
  });

  it('puzzleProblems catches bad storm and machine slots', () => {
    const p = bench();
    expect(puzzleProblems(p)).toEqual([]);
    p.storm = { at: { x: -1, y: 1 }, dir: 'W', strength: 1 };
    expect(puzzleProblems(p)).toContain('storm does not face the altar');
    p.storm = { at: { x: -1, y: -1 }, dir: 'E', strength: 1 };
    expect(puzzleProblems(p)).toContain('storm not on an edge slot');
    p.machines = [{ at: { x: 2, y: 2 }, need: 4 }];
    expect(puzzleProblems(p).some((s) => s.includes('not on an edge slot'))).toBe(true);
  });

  it('simulate ignores placements on blocked or fixed sockets', () => {
    const p = bench({
      fixed: [{ gem: 'channel', cell: { x: 0, y: 1 }, rot: 0 }],
      blocked: ['. . . . . .', '. . . . . #', '. . . . . .', '. . . . . .'],
    });
    const r = run(p, ['. . . . . .', 'A = = = = =', '. . . . . .', '. . . . . .']);
    expect(r.outcome).toBe('dead'); // fixed channel kept, (5,1) blocked
  });
});
