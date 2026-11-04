import { describe, expect, it } from 'vitest';
import { keepTogether } from './nowrap';

const NB = ' ';
const show = (s: string) => s.replaceAll(NB, '_');

describe('keepTogether (teach-4: no mid-expression wraps)', () => {
  it('joins sums and steps', () => {
    expect(show(keepTogether('It let out 8 + 8 = 16.'))).toBe('It let out_8_+_8_=_16.');
    expect(show(keepTogether('Strike 2: 8 + 8 → 16'))).toBe('Strike_2: 8_+_8_→_16');
  });

  it('joins value phrases', () => {
    expect(show(keepTogether('Needs 20'))).toBe('Needs_20');
    expect(show(keepTogether('needs 8 in one strike.'))).toBe('needs_8 in_one_strike.');
    expect(show(keepTogether('needs 8 in either strike.'))).toBe('needs_8 in_either_strike.');
    expect(show(keepTogether('in any one strike'))).toBe('in_any_one_strike');
    // teach-7: the gauge's note.
    expect(show(keepTogether('needs 8 on strike 1 or 2.'))).toBe('needs_8 on_strike_1_or_2.');
    expect(show(keepTogether('on any strike'))).toBe('on_any_strike');
    expect(show(keepTogether(' 1 of 2'))).toBe(' 1_of_2');
    expect(show(keepTogether('Strike ×2'))).toBe('Strike_×2');
    expect(show(keepTogether('Gives 8 per strike'))).toBe('Gives_8_per_strike');
  });

  it('leaves other spaces free to wrap', () => {
    expect(keepTogether('Turns the charge along its bent line.')).toBe(
      'Turns the charge along its bent line.',
    );
    expect(show(keepTogether('Got 0, then 16; needs 8.'))).toBe('Got_0, then_16; needs_8.');
  });
});
