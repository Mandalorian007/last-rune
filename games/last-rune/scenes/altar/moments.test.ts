import { describe, expect, it } from 'vitest';
import {
  HINT_RETIRE,
  hintRetired,
  INTRO_PAGE_SECS,
  introPage,
  introSecs,
  phoneHint,
} from './moments';

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

describe('phone arrival card', () => {
  it('shows one new piece at a time, then loops', () => {
    expect(introPage(1, 99)).toBe(0);
    expect(introPage(3, 0)).toBe(0);
    expect(introPage(3, INTRO_PAGE_SECS + 0.1)).toBe(1);
    expect(introPage(3, 2 * INTRO_PAGE_SECS + 0.1)).toBe(2);
    expect(introPage(3, 3 * INTRO_PAGE_SECS + 0.1)).toBe(0);
  });

  it('stays long enough to show every page once', () => {
    expect(introSecs(1, 7)).toBe(7);
    expect(introSecs(3, 7)).toBe(3 * INTRO_PAGE_SECS);
  });
});
