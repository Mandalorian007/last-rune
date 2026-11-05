import { describe, expect, it } from 'vitest';
import script from '../../../../docs/design/script.md?raw';
import {
  DISCORD_INVITE_URL,
  ENDING_COPY,
  ENDING_SEQUENCE,
  HANGOUT_CHANNELS,
  HANGOUT_COPY,
  HANGOUT_HISTORY,
  HANGOUT_MEMBERS,
  HANGOUT_SCRIPT,
  HANGOUT_SERVER,
  HANGOUT_SUMMARY,
  type HangoutStep,
} from '../../content/ending';
import {
  CLIP_FALL_SECONDS,
  CREDITS,
  clipDropPose,
  emojiRuns,
  endCard,
  endingBeats,
  endingSkippable,
  fusePostText,
  hangoutSeconds,
} from './ending-model';

describe('clipDropPose', () => {
  // As staged: his clamp at the door's edge, the rest spot bottom right (ENDING_LAYOUT.clip).
  const from = { x: 1354, y: 872, scale: 0.3, rot: 0.14 };
  const rest = { x: 1640, y: 905, h: 264, rot: -0.22 };
  const at = (t: number) => clipDropPose(t, from, rest);
  const bottom = (p: { y: number; scale: number }) => p.y + (rest.h * p.scale) / 2;

  it('starts in his clamp and ends exactly at the resting pose', () => {
    expect(at(0)).toMatchObject({ x: from.x, scale: from.scale, rot: from.rot });
    expect(at(0).y).toBeCloseTo(from.y);
    const end = at(CLIP_FALL_SECONDS + 1);
    expect(end.x).toBeCloseTo(rest.x);
    expect(end.y).toBeCloseTo(rest.y);
    expect(end.scale).toBeCloseTo(1);
    expect(end.rot).toBeCloseTo(rest.rot);
  });

  it('is a drop, not a toss: it leaves the clamp slowly and drifts out late', () => {
    // A toss leaves the hand at speed; a drop starts from rest. Over the first 30% of the
    // fall it covers well under a sixth of the way across (a linear path would cover 30%).
    const p = at(CLIP_FALL_SECONDS * 0.3);
    expect(bottom(p)).toBeGreaterThan(bottom(at(0)));
    expect((p.x - from.x) / (rest.x - from.x)).toBeLessThan(1 / 6);
    expect(at(0.01).x - from.x).toBeLessThan(0.5);
  });

  it('its bottom edge only ever falls until it lands', () => {
    let prev = bottom(at(0));
    for (let i = 1; i <= 60; i++) {
      const b = bottom(at((CLIP_FALL_SECONDS * i) / 60));
      expect(b).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = b;
    }
  });
});

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
      'hangout',
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

  it('offers the ThunderClap Gaming door and the Ko-fi link', () => {
    const c = endCard(stats);
    expect(c.join?.href).toBe(DISCORD_INVITE_URL);
    expect(c.join?.label).toBe('Join ThunderClap Gaming');
    expect(c.coffee?.href).toBe('https://ko-fi.com/thundersoap');
    expect(c.footer).toBe(ENDING_COPY.footer);
    expect(c.title).toEqual(ENDING_COPY.titleCard);
    expect(c.safety).toContain('1h 29m');
    expect(c.safety).toContain('Breakers reset at no charge.');
    expect(c.safety).not.toContain('7');
  });

  it('hides the Ko-fi link while its URL is blank', () => {
    expect(endCard(stats, DISCORD_INVITE_URL, '').coffee).toBeNull();
  });

  it('drops non-https links; the title card is lore and stays whole', () => {
    const c = endCard(stats, 'http://discord.gg/x', 'javascript:alert(1)');
    expect(c.join).toBeNull();
    expect(c.coffee).toBeNull();
    expect(c.title).toEqual(ENDING_COPY.titleCard);
  });
});

describe('endingSkippable', () => {
  it('is skippable on the first viewing and on replays (teach-5)', () => {
    expect(endingSkippable({ firstTime: true })).toBe(true);
    expect(endingSkippable({ firstTime: false })).toBe(true);
  });
});

describe('ending UI copy (D-032, D-038)', () => {
  it('says FUSE went to ThunderClap Gaming, and credits ThunderSoap', () => {
    expect(ENDING_COPY.titleCard[0]).toBe('FUSE went to ThunderClap Gaming.');
    expect(ENDING_COPY.joinLabel).toBe('Join ThunderClap Gaming');
    expect(CREDITS).toContainEqual(['Made by', 'ThunderSoap']);
  });
});

describe('the community hangout (D-038)', () => {
  const posters = new Set<string>([
    ...HANGOUT_SCRIPT.flatMap((s) =>
      s.type === 'post' ? [s.who] : s.type === 'pin' ? [s.by] : s.type === 'fuse' ? ['fuse'] : [],
    ),
    ...Object.values(HANGOUT_HISTORY).flatMap((posts) => posts.map((p) => p.who)),
  ]);
  const fusePosts = HANGOUT_SCRIPT.filter(
    (s): s is Extract<HangoutStep, { type: 'fuse' }> => s.type === 'fuse',
  );
  /** Every string the hangout can put on screen. */
  const shown = [
    HANGOUT_SERVER,
    ...HANGOUT_CHANNELS.flatMap((c) => [c.emoji, c.name]),
    ...Object.values(HANGOUT_MEMBERS).map((m) => m.name),
    ...Object.values(HANGOUT_COPY),
    ...Object.values(HANGOUT_HISTORY).flatMap((posts) => posts.map((p) => p.text)),
    ...HANGOUT_SCRIPT.flatMap((s) =>
      s.type === 'post' || s.type === 'join' || s.type === 'pin'
        ? [s.text]
        : s.type === 'fuse'
          ? [fusePostText(s), ...(s.form ?? []).flat()]
          : s.type === 'react'
            ? [s.emoji]
            : [],
    ),
    ...Object.values(HANGOUT_SUMMARY),
  ].join(' \n ');

  it('lists the real channels in order, with their emoji', () => {
    expect(HANGOUT_SERVER).toBe('ThunderClap Gaming');
    expect(HANGOUT_CHANNELS.map((c) => `${c.emoji} ${c.name}`)).toEqual([
      '👋 welcome',
      '🧑 introductions',
      '💬 the-hangout',
      '👀 supporter-sneak-peeks',
      '💬 supporter-chat',
      '🏆 events-and-contests',
      '🐈 furry-friends',
      '🍔 omg-food',
      '🎶 jammin-out',
      '🍜 otaku-oasis',
      '📚 book-worms',
      '🌱 watch-me-grow',
      '⚽ sports-ball',
      '🚗 gearhead',
    ]);
  });

  it('has no real members but ThunderSoap: every other poster is invented', () => {
    for (const who of posters) {
      const m = HANGOUT_MEMBERS[who as keyof typeof HANGOUT_MEMBERS];
      expect(m, who).toBeDefined();
      if (who !== 'fuse' && who !== 'thundersoap') expect(m.invented, who).toBe(true);
    }
    const real = Object.values(HANGOUT_MEMBERS).filter((m) => !m.invented);
    expect(real.map((m) => m.name).sort()).toEqual(['FUSE', 'ThunderSoap']);
  });

  it('FUSE is a game character, not a bot; no member counts', () => {
    expect(shown).not.toMatch(/\bbot\b|\bapp\b|\bverified\b/i);
    expect(shown).not.toMatch(/\bmembers?\b|\bonline\b|\bonline\s*[-—]\s*\d/i);
    expect(HANGOUT_MEMBERS.fuse.emoji).toBe('');
  });

  it("FUSE's three closing lines anchor the chat, in order", () => {
    expect(fusePosts.filter((p) => p.line).map((p) => p.line)).toEqual([
      'beat.beyond-arrived',
      'beat.beyond-arguing',
      'beat.beyond-day-1',
    ]);
  });

  it('every reaction is a real emoji, and every message it targets exists first', () => {
    const keys = new Set<string>();
    for (const s of HANGOUT_SCRIPT) {
      if (s.type === 'fuse' || s.type === 'join' || (s.type === 'post' && s.key)) keys.add(s.key!);
      if (s.type === 'react' || s.type === 'pin') expect(keys.has(s.key), s.key).toBe(true);
      if (s.type === 'react') {
        expect(emojiRuns(s.emoji), s.emoji).toEqual([{ text: s.emoji, emoji: true }]);
        expect(s.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every channel FUSE visits is a real channel, and he ends on Day 1 in watch-me-grow', () => {
    const ids = new Set<string>(HANGOUT_CHANNELS.map((c) => c.id));
    const visits = HANGOUT_SCRIPT.flatMap((s) => (s.type === 'go' ? [s.channel] : []));
    for (const v of visits) expect(ids.has(v)).toBe(true);
    expect(visits[visits.length - 1]).toBe('watch-me-grow');
  });

  it('keeps the ending close to its old length (about 30 s, not minutes)', () => {
    expect(hangoutSeconds(45)).toBeGreaterThan(20);
    expect(hangoutSeconds(45)).toBeLessThan(36);
    expect(hangoutSeconds(0)).toBeLessThan(hangoutSeconds(45));
  });

  it('every chat text is in script.md', () => {
    const texts = [
      ...Object.values(HANGOUT_HISTORY).flatMap((posts) => posts.map((p) => p.text)),
      ...HANGOUT_SCRIPT.flatMap((s) =>
        s.type === 'post' || s.type === 'join'
          ? [s.text]
          : s.type === 'fuse'
            ? [fusePostText(s)]
            : [],
      ),
    ];
    for (const t of texts) expect(script.includes(t), t).toBe(true);
  });
});

describe('emojiRuns', () => {
  it('splits text from emoji, keeping joined emoji whole', () => {
    expect(emojiRuns('he brought a FORM 😭')).toEqual([
      { text: 'he brought a FORM ', emoji: false },
      { text: '😭', emoji: true },
    ]);
    expect(emojiRuns('🔊🔊 up')).toEqual([
      { text: '🔊', emoji: true },
      { text: '🔊', emoji: true },
      { text: ' up', emoji: false },
    ]);
    expect(emojiRuns('Day 1.')).toEqual([{ text: 'Day 1.', emoji: false }]);
  });
});
