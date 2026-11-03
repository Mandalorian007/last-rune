import { describe, expect, it } from 'vitest';
import { DISCORD_INVITE_URL, ENDING_COPY, ENDING_SEQUENCE } from '../../content/ending';
import { CREDITS, endCard, endingBeats, endingSkippable } from './ending-model';

describe('endingBeats', () => {
  const beats = endingBeats();

  it('starts at the final report and ends on the post-credits idle', () => {
    const first = beats[0];
    expect(first?.kind).toBe('line');
    if (first?.kind === 'line') expect(first.line.id).toBe('beat.rune-final-report');
    const last = beats[beats.length - 1];
    expect(last?.kind).toBe('idle');
    if (last?.kind === 'idle') expect(last.seconds).toBe(30);
  });

  it('plays the lines and cues in the pitch order', () => {
    const shape = beats.map((b) =>
      b.kind === 'line'
        ? `${b.kind}:${b.line.id}`
        : b.kind === 'direction'
          ? `cue:${b.cue}`
          : b.kind,
    );
    const order = [
      'line:beat.rune-final-report',
      'line:beat.rune-lights',
      'cue:door',
      'line:beat.rune-not-for-you',
      'cue:edge',
      'line:beat.door-list',
      'line:beat.door-key',
      'cue:through',
      'cue:beyond',
      'line:beat.beyond-arrived',
      'line:beat.beyond-arguing',
      'line:beat.beyond-day-1',
      'cue:flood',
      'title-card',
      'idle',
    ];
    let at = -1;
    for (const want of order) {
      const i = shape.indexOf(want, at + 1);
      expect(i, `${want} after index ${at} in ${shape.join(', ')}`).toBeGreaterThan(at);
      at = i;
    }
  });

  it('drops the silent arrival and every direction it has no cue for', () => {
    expect(beats.some((b) => (b as { kind: string }).kind === 'silence')).toBe(false);
    const directions = ENDING_SEQUENCE.filter((s) => s.type === 'direction').length;
    expect(beats.filter((b) => b.kind === 'direction').length).toBeLessThanOrEqual(directions);
  });

  it('cues each direction exactly once', () => {
    const cues = beats.flatMap((b) => (b.kind === 'direction' ? [b.cue] : []));
    expect(new Set(cues).size).toBe(cues.length);
  });
});

describe('endCard', () => {
  const stats = { playSeconds: 5321, breakersTripped: 7 };

  it('offers the ThunderClap Gaming door and hides the tip jar while its URL is blank', () => {
    const c = endCard(stats);
    expect(c.join?.href).toBe(DISCORD_INVITE_URL);
    expect(c.buttons.map((b) => b.id)).toEqual(['join']);
    expect(c.footer).toBe(ENDING_COPY.footer);
    expect(c.title).toEqual(ENDING_COPY.titleCard);
    expect(c.safety).toContain('1h 29m');
    expect(c.safety).toContain('Breakers tripped: 7');
  });

  it('shows the tip jar once it has an https URL', () => {
    const c = endCard(stats, DISCORD_INVITE_URL, 'https://example.invalid/tip');
    expect(c.buttons.map((b) => b.id)).toEqual(['join', 'tip']);
  });

  it('drops non-https links; the title card is lore and stays whole', () => {
    const c = endCard(stats, 'http://discord.gg/x', 'javascript:alert(1)');
    expect(c.join).toBeNull();
    expect(c.buttons).toEqual([]);
    expect(c.title).toEqual(ENDING_COPY.titleCard);
  });
});

describe('endingSkippable', () => {
  it('is skippable only after the first viewing', () => {
    expect(endingSkippable({ firstTime: true })).toBe(false);
    expect(endingSkippable({ firstTime: false })).toBe(true);
  });
});

describe('ending UI copy (D-032)', () => {
  it('says FUSE went to ThunderClap Gaming, and credits ThunderSoap', () => {
    expect(ENDING_COPY.titleCard[0]).toBe('FUSE went to ThunderClap Gaming.');
    expect(ENDING_COPY.joinLabel).toBe('Join ThunderClap Gaming');
    expect(CREDITS).toContainEqual(['Made by', 'ThunderSoap']);
  });

  it('gives no chat or server details', () => {
    const shown = [
      ...ENDING_COPY.titleCard,
      ...CREDITS.flat(),
      ...ENDING_SEQUENCE.flatMap((s) => (s.type === 'direction' ? [s.text] : [])),
    ].join(' ');
    expect(shown).not.toMatch(/discord|chat|channel|#|\bbot\b|typing|avatar/i);
  });
});
