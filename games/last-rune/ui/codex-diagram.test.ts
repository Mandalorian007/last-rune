import { describe, expect, it } from 'vitest';
import { acceptMask, GEM_CODE } from '../rules/sim';
import { type Dir, GEM_KINDS } from '../rules/types';
import { chipAt, diagramSvg, fizzleAt, GEM_DIAGRAMS, turnSide } from './codex-diagram';

const BIT: Record<Dir, number> = { N: 1, E: 2, S: 4, W: 8 };
const mask = (sides: readonly Dir[]) => sides.reduce((m, s) => m | BIT[s], 0);

describe('codex bolt diagrams', () => {
  it('match the simulator at rotation 0', () => {
    for (const gem of GEM_KINDS) {
      const d = GEM_DIAGRAMS[gem];
      const accept = acceptMask(GEM_CODE[gem], 0);
      const ins = mask(d.ins.map((a) => a.side));
      const outs = mask(d.outs.map((a) => a.side));
      const fizzle = mask(d.fizzle);
      expect(ins & accept, `${gem} enters where it accepts`).toBe(ins);
      expect(fizzle & accept, `${gem} fizzles only where it refuses`).toBe(0);
      expect(fizzle, `${gem} draws every refusing side`).toBe(15 & ~accept & ~outs);
      expect(ins & outs, `${gem} in and out sides differ`).toBe(0);
    }
  });

  it('turned with the gem, still match the simulator (teach-4 altar cards)', () => {
    for (const gem of ['bend', 'split', 'gate'] as const)
      for (const rot of [0, 1, 2, 3]) {
        const d = GEM_DIAGRAMS[gem];
        const accept = acceptMask(GEM_CODE[gem], rot);
        const ins = mask(d.ins.map((a) => turnSide(a.side, rot)));
        const fizzle = mask(d.fizzle.map((s) => turnSide(s, rot)));
        expect(ins & accept, `${gem} rot ${rot}`).toBe(ins);
        expect(fizzle & accept, `${gem} rot ${rot}`).toBe(0);
      }
  });

  it('accounts for every side of the shaped gems', () => {
    for (const gem of ['bend', 'split', 'gate'] as const) {
      const d = GEM_DIAGRAMS[gem];
      const all = mask([...d.ins.map((a) => a.side), ...d.outs.map((a) => a.side), ...d.fizzle]);
      expect(all, gem).toBe(15);
    }
  });

  it('marks a gem one-way exactly when the simulator refuses charge at its outs', () => {
    // glyph-truth-4 (blind review 10, B): Channel, Bend, Amplify and Capacitor take charge
    // either way ("whichever way it enters"); only Split and Gate are one-way.
    for (const gem of GEM_KINDS) {
      const d = GEM_DIAGRAMS[gem];
      const outs = mask(d.outs.map((a) => a.side));
      const oneWay = (acceptMask(GEM_CODE[gem], 0) & outs) === 0;
      expect(d.oneWay, gem).toBe(oneWay);
    }
    const one = GEM_KINDS.filter((g) => GEM_DIAGRAMS[g].oneWay);
    expect(one.sort()).toEqual(['gate', 'split']);
  });

  it('draws an arrowhead per bolt out, a port per bolt in, and keeps marks inside the plate', () => {
    for (const gem of GEM_KINDS) {
      const d = GEM_DIAGRAMS[gem];
      const svg = diagramSvg(d);
      // held-gem: arrow = out, round port = in, as on the gem's own glyph, but only on the
      // one-way gems. glyph-truth-4: a two-way gem's bolts end plain on both sides, alike.
      const arrows = svg.match(/<polygon/g)?.length ?? 0;
      const ports = svg.match(/<circle/g)?.length ?? 0;
      expect(arrows, gem).toBe(d.oneWay ? d.outs.length : 0);
      expect(ports, gem).toBe(d.oneWay ? d.ins.length : 0);
      // A port is a hollow ring, never a filled blob.
      for (const c of svg.match(/<circle[^>]*>/g) ?? []) expect(c, gem).toContain('fill="none"');
      expect(svg.match(/<line/g)?.length, gem).toBe(d.ins.length + d.outs.length);
      expect(svg).not.toContain('id=');
      expect(d.alt.length).toBeGreaterThan(10);
      const marks = [
        ...[...d.ins, ...d.outs].map((a) => chipAt(a.side)),
        ...d.fizzle.map(fizzleAt),
      ];
      for (const p of marks) {
        expect(p.left).toBeGreaterThan(5);
        expect(p.left).toBeLessThan(95);
        expect(p.top).toBeGreaterThan(5);
        expect(p.top).toBeLessThan(95);
      }
    }
  });
});
