import { MemoryStorage, saveKey } from '@engine/save';
import { describe, expect, it } from 'vitest';
import {
  createGameSave,
  defaultSave,
  gemsAt,
  hasProgress,
  MIGRATIONS,
  markGemsMet,
  metGems,
  newGameData,
  progressOf,
  SAVE_GAME_ID,
  SAVE_VERSION,
  SaveV1,
} from './save';

describe('codex.met (gems seen at an altar)', () => {
  it('lists fixed and tray gems at an altar', () => {
    expect(gemsAt('furnace')).toContain('amplify');
    expect(gemsAt('intake-desk')).toContain('bend');
  });

  it('adds each gem once and reports what was new', () => {
    const d = defaultSave();
    expect(markGemsMet(d, ['bend', 'channel'])).toEqual(['bend', 'channel']);
    expect(markGemsMet(d, ['bend', 'amplify'])).toEqual(['amplify']);
    expect(metGems(d)).toEqual(['bend', 'channel', 'amplify']);
  });

  it('backfills older saves without the field from altars already visited', () => {
    const st = new MemoryStorage();
    const a = createGameSave(opts(st));
    a.update((d) => {
      d.progress.solved = ['intake-desk'];
      d.puzzles.furnace = { placements: [], attempts: 1 };
      delete d.codex.met;
    });
    expect(SaveV1.validate(a.get())).toBeNull();
    a.flush();
    const b = createGameSave(opts(st));
    const met = metGems(b.get());
    expect(met).toContain('bend');
    expect(met).toContain('amplify');
    expect(met).not.toContain('gate');
  });

  it('starts empty on a new game', () => {
    const d = defaultSave();
    markGemsMet(d, ['gate']);
    expect(metGems(newGameData(d, 5))).toEqual([]);
  });
});

const opts = (storage: MemoryStorage) => ({
  storage,
  debounceMs: 0,
  autoFlush: false,
  now: () => 1000,
});

describe('save schema v1', () => {
  it('defaults validate', () => {
    expect(SaveV1.validate(defaultSave())).toBeNull();
    expect(hasProgress(defaultSave())).toBe(false);
  });

  it('migration chain covers 1 → current', () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('round-trips through storage', () => {
    const st = new MemoryStorage();
    const a = createGameSave(opts(st));
    a.update((d) => {
      d.progress.solved = ['intake-desk', 'furnace'];
      d.puzzles.furnace = {
        placements: [{ gem: 'amplify', cell: { x: 2, y: 1 }, rot: 3 }],
        attempts: 4,
      };
      d.settings.captionSpeed = 'fast';
      return undefined;
    });
    a.flush();
    const b = createGameSave(opts(st));
    expect(b.status.loadResult).toBe('loaded');
    expect(b.get().progress.solved).toEqual(['intake-desk', 'furnace']);
    expect(b.get().puzzles.furnace!.placements[0]!.rot).toBe(3);
    expect(b.get().settings.captionSpeed).toBe('fast');
  });

  it('repairs unreachable or unknown solves on load', () => {
    const st = new MemoryStorage();
    const raw = defaultSave();
    raw.progress.solved = ['furnace', 'not-a-machine', 'intake-desk', 'the-last-rune'];
    st.setItem(saveKey(SAVE_GAME_ID, 'main'), JSON.stringify({ v: 1, t: 1, d: raw }));
    const save = createGameSave(opts(st));
    // furnace needs Bend (intake desk), so it lands after it; junk and the rune drop.
    expect(progressOf(save.get()).solved).toEqual(['intake-desk', 'furnace']);
  });

  it('recovers from a corrupt save with defaults and a backup', () => {
    const st = new MemoryStorage();
    st.setItem(saveKey(SAVE_GAME_ID, 'main'), '{"v":1,"t":1,"d":{"progress":42}}');
    const save = createGameSave(opts(st));
    expect(save.status.loadResult).toBe('recovered');
    expect(save.get()).toEqual(defaultSave());
    expect(st.getItem(`${saveKey(SAVE_GAME_ID, 'main')}:backup`)).not.toBeNull();
  });

  it('rejects bad placements', () => {
    const d = defaultSave();
    (d.puzzles as Record<string, unknown>).crane = {
      placements: [{ gem: 'ruby', cell: { x: 0, y: 0 }, rot: 0 }],
      attempts: 0,
    };
    expect(SaveV1.validate(d)).toMatch(/gem/);
  });

  it('new game keeps settings and resets progress', () => {
    const prev = defaultSave();
    prev.progress.solved = ['intake-desk'];
    prev.settings.reducedMotion = 'reduce';
    prev.stats.breakersTripped = 9;
    const d = newGameData(prev, 5);
    expect(d.progress.solved).toEqual([]);
    expect(d.stats.breakersTripped).toBe(0);
    expect(d.stats.startedAt).toBe(5);
    expect(d.settings.reducedMotion).toBe('reduce');
  });

  it('export/import round-trips', () => {
    const a = createGameSave(opts(new MemoryStorage()));
    a.update((d) => {
      d.progress.solved = ['intake-desk'];
      return undefined;
    });
    const text = a.exportString();
    const b = createGameSave(opts(new MemoryStorage()));
    expect(b.importString(text)).toEqual({ ok: true, migrated: false });
    expect(b.get().progress.solved).toEqual(['intake-desk']);
  });

  it('works without storage (memory fallback)', () => {
    const save = createGameSave({ storage: null, debounceMs: 0, autoFlush: false });
    expect(save.persistent).toBe(false);
    expect(
      save.update((d) => {
        d.progress.solved.push('intake-desk');
        return undefined;
      }),
    ).toBe(true);
  });
});
