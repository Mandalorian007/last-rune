import { describe, expect, it } from 'vitest';
import { HINT_RETIRE, hintRetired, phoneHint } from './moments';

describe('phone how-to line', () => {
  it('teaches the tap until the player has restored a few machines', () => {
    expect(hintRetired([])).toBe(false);
    expect(hintRetired(['intake-desk', 'furnace'])).toBe(false);
    expect(HINT_RETIRE).toBe(3);
    expect(hintRetired(['intake-desk', 'furnace', 'splitter-mill'])).toBe(true);
  });

  it('says the next tap: a gem, then (holding one) a socket; nothing once retired', () => {
    expect(phoneHint(false, false)).toBe('touch');
    expect(phoneHint(false, true)).toBe('touchHeld');
    expect(phoneHint(true, false)).toBe('off');
    expect(phoneHint(true, true)).toBe('off');
  });
});
