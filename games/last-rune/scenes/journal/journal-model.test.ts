import { describe, expect, it } from 'vitest';
import { JOURNAL } from '../../content/journal';
import { initialPage, journalModel, stepPage, tierNumeral } from './journal-model';
import { journalSketch, trailingSignature } from './journal-sketch';

describe('journalModel', () => {
  it('lists all sixteen slots in page order, whatever order pages were found in', () => {
    const m = journalModel([9, 2, 16, 5], []);
    expect(m.slots.map((s) => s.page)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(m.readable).toEqual([2, 5, 9, 16]);
    expect(m.foundCount).toBe(4);
    expect(m.total).toBe(JOURNAL.length);
  });

  it('unfound slots carry their tier but never their text', () => {
    const m = journalModel([1], []);
    for (const s of m.slots) {
      const page = JOURNAL.find((p) => p.page === s.page)!;
      expect(s.tier).toBe(page.tier);
      if (s.page === 1) expect(s.entry?.text).toBe(page.text);
      else expect(s.entry).toBeNull();
    }
  });

  it('marks found-but-unread pages fresh', () => {
    const m = journalModel([1, 2, 3], [2, 7]);
    expect(m.slots.filter((s) => s.fresh).map((s) => s.page)).toEqual([1, 3]);
    expect(m.freshCount).toBe(2);
    expect(m.slots[6]!.fresh).toBe(false); // read but unfound: not shown, not fresh
  });

  it('opens on the first new page, else the first found, else nothing', () => {
    expect(initialPage(journalModel([1, 4, 6], [1]))).toBe(4);
    expect(initialPage(journalModel([3, 4], [3, 4]))).toBe(3);
    expect(initialPage(journalModel([], []))).toBeNull();
  });

  it('steps through readable pages only, wrapping both ways', () => {
    const m = journalModel([2, 5, 9], []);
    expect(stepPage(m, 2, 1)).toBe(5);
    expect(stepPage(m, 9, 1)).toBe(2);
    expect(stepPage(m, 2, -1)).toBe(9);
    expect(stepPage(m, null, 1)).toBe(2);
    expect(stepPage(m, null, -1)).toBe(9);
    expect(stepPage(journalModel([], []), null, 1)).toBeNull();
    expect(stepPage(journalModel([4], []), 4, 1)).toBe(4);
  });

  it('tier numerals', () => {
    expect([1, 2, 3, 4].map((t) => tierNumeral(t as 1 | 2 | 3 | 4))).toEqual([
      'I',
      'II',
      'III',
      'IV',
    ]);
  });
});

describe('journal sketches', () => {
  it('are deterministic per page and differ between pages', () => {
    expect(journalSketch(3)).toEqual(journalSketch(3));
    expect(journalSketch(3).strokes).not.toEqual(journalSketch(4).strokes);
    expect(trailingSignature()).toBe(trailingSignature());
    expect(trailingSignature()).toMatch(/^M[\d.]+ [\d.-]+/);
  });
});
