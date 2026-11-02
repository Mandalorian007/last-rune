/**
 * Save schema v1 for The Last Rune, on top of engine/save (versioned slot,
 * migrations, schema guard, memory fallback, export/import).
 *
 * Key: `thunderclap:last-rune:main`. Audio volumes live in their own slot
 * (`thunderclap:last-rune:audio`, via engine/audio `persistMixer`) so resetting
 * progress never resets the mixer, and importing a friend's save never blasts
 * your speakers.
 *
 * Progress is stored as plain strings and repaired on load with
 * `parseProgressState` (unknown ids dropped, unreachable solves removed), so a
 * renamed machine in a later build downgrades gracefully instead of wiping
 * the save.
 */

import type { StorageLike } from '@engine/save';
import { createSaveStore, type Infer, type Migrations, type SaveStore, s } from '@engine/save';
import { type ProgressState, parseProgressState } from '../rules/progression';
import { GEM_KINDS, type GemKind, type MachineId } from '../rules/types';

export const SAVE_GAME_ID = 'last-rune';
export const SAVE_VERSION = 1;

// ─── Schema ──────────────────────────────────────────────────────────────────

const Gem = s.literal(...GEM_KINDS);

/** Mirrors rules C2 `Placement` ({ gem, cell, rot }) so in-progress altars survive reloads. */
const PlacementSchema = s.object({
  gem: Gem,
  cell: s.object({ x: s.number({ int: true }), y: s.number({ int: true }) }),
  rot: s.literal(0, 1, 2, 3),
});

const PuzzleProgress = s.object({
  /** Gems currently set on the altar (restored when the puzzle reopens). */
  placements: s.array(PlacementSchema, { maxLength: 200 }),
  /** Bolts fired at this puzzle (all outcomes). */
  attempts: s.number({ min: 0, int: true }),
});

export const ReducedMotionPref = s.literal('system', 'reduce', 'full');
export const CaptionSpeed = s.literal('normal', 'fast', 'instant');
/** `auto` follows the effective reduced-motion setting. */
export const ReduceFlashesPref = s.literal('auto', 'on', 'off');

const Settings = s.object({
  /** `system` follows `prefers-reduced-motion`. */
  reducedMotion: ReducedMotionPref,
  /** FUSE caption typewriter speed. */
  captionSpeed: CaptionSpeed,
  /**
   * Photosensitivity: soften full-screen whiteouts and lightning flashes. Optional so saves
   * written before it existed still validate (missing = `auto`).
   */
  reduceFlashes: s.optional(ReduceFlashesPref),
});

const Stats = s.object({
  /** Seconds in the hall/puzzles (not the title, not while the tab is hidden). */
  playSeconds: s.number({ min: 0 }),
  /** Over-charge outcomes (feeds `safetyRecordLine`). */
  breakersTripped: s.number({ min: 0, int: true }),
  /** Every bolt fired, any outcome. */
  attempts: s.number({ min: 0, int: true }),
  /** ms epoch of New Game, 0 before. */
  startedAt: s.number({ min: 0 }),
  /** ms epoch of the final solve, 0 before. */
  completedAt: s.number({ min: 0 }),
});

const Flags = s.object({
  /** The title's "someone's at the door" beat has played once. */
  titleKnock: s.boolean(),
  /** The hall's first-entry line has played. */
  hallIntro: s.boolean(),
});

export const SaveV1 = s.object({
  progress: s.object({ solved: s.array(s.string(), { maxLength: 64 }) }),
  /** Journal page numbers the player has picked up (shown) / opened. */
  journal: s.object({
    found: s.array(s.number({ min: 1, int: true }), { maxLength: 64 }),
    read: s.array(s.number({ min: 1, int: true }), { maxLength: 64 }),
  }),
  /** Codex pages the player has opened (drives "new" markers). */
  codex: s.object({ seen: s.array(Gem, { maxLength: 16 }) }),
  /** In-progress altar per machine id. */
  puzzles: s.record(PuzzleProgress),
  settings: Settings,
  stats: Stats,
  flags: Flags,
});

export type SaveData = Infer<typeof SaveV1>;
export type SavedPlacement = Infer<typeof PlacementSchema>;
export type GameSettings = Infer<typeof Settings>;
export type PlayStatsData = Infer<typeof Stats>;

export function defaultSettings(): GameSettings {
  return { reducedMotion: 'system', captionSpeed: 'normal', reduceFlashes: 'auto' };
}

export function defaultSave(): SaveData {
  return {
    progress: { solved: [] },
    journal: { found: [], read: [] },
    codex: { seen: [] },
    puzzles: {},
    settings: defaultSettings(),
    stats: { playSeconds: 0, breakersTripped: 0, attempts: 0, startedAt: 0, completedAt: 0 },
    flags: { titleKnock: false, hallIntro: false },
  };
}

/**
 * `MIGRATIONS[n]` upgrades v`n` → v`n+1`. Empty at v1. When v2 lands, add
 * `1: (old) => ({ ...old, newField: … })` and bump `SAVE_VERSION`; the engine
 * backs up the v1 value before overwriting it.
 */
export const MIGRATIONS: Migrations = {};

// ─── Store ───────────────────────────────────────────────────────────────────

export type GameSave = SaveStore<SaveData>;

export interface GameSaveOptions {
  storage?: StorageLike | null;
  debounceMs?: number;
  autoFlush?: boolean;
  now?: () => number;
}

export function createGameSave(opts: GameSaveOptions = {}): GameSave {
  const store = createSaveStore<SaveData>({
    game: SAVE_GAME_ID,
    slot: 'main',
    version: SAVE_VERSION,
    migrations: MIGRATIONS,
    defaults: defaultSave,
    schema: SaveV1,
    ...opts,
  });
  repairSave(store);
  return store;
}

/** Drops unknown/unreachable solves and stale journal pages. Returns true if it changed anything. */
export function repairSave(store: GameSave): boolean {
  const cur = store.get();
  const fixed = parseProgressState(cur.progress);
  if (fixed.solved.length === cur.progress.solved.length) return false;
  store.update((d) => {
    d.progress.solved = [...fixed.solved];
  });
  return true;
}

// ─── Typed accessors (pure) ──────────────────────────────────────────────────

export function progressOf(data: SaveData): ProgressState {
  // Already repaired on load and only ever written through `solveMachine`, so a cast is safe.
  return { solved: data.progress.solved as MachineId[] };
}

export function hasProgress(data: SaveData): boolean {
  return data.progress.solved.length > 0 || data.flags.hallIntro;
}

/** New game: wipes progress, journal, codex, puzzles, stats and story flags; keeps settings. */
export function newGameData(prev: SaveData, now: number): SaveData {
  const d = defaultSave();
  d.settings = { ...prev.settings };
  d.stats.startedAt = now;
  d.flags.titleKnock = prev.flags.titleKnock;
  return d;
}

export function markCodexSeen(d: SaveData, gem: GemKind): void {
  if (!d.codex.seen.includes(gem)) d.codex.seen.push(gem);
}
