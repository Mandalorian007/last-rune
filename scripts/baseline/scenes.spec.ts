/**
 * The v1.0 desktop baselines (D-041 Phase 0): every scene a player sees, at each viewport in
 * playwright.config.ts. Each test boots a fresh page on a paused fake clock with a seeded save
 * (stage.ts), drives the game through the DEV-only `window.__game` handle, runs a fixed amount
 * of game time and takes one shot. File names are `<scene>.png` per project folder.
 */
import { expect, type Page, test } from '@playwright/test';
import { pagesFound } from '../../games/last-rune/content/journal';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import {
  advance,
  advanceTo,
  type G,
  game,
  intended,
  key,
  type SaveSeed,
  saveData,
  shot,
  solvedBefore,
  stage,
  until,
} from './stage';

/** Mid-run: tier 1 and part of tier 2 restored, journal pages found and read. */
const MID: MachineId[] = solvedBefore('boiler-room');
const midSeed = (extra: SaveSeed = {}): SaveSeed => {
  const pages = pagesFound(MID).map((p) => p.page);
  return {
    solved: MID,
    hallIntro: true,
    journalFound: pages,
    journalRead: pages.slice(0, -1),
    playSeconds: 1834,
    breakersTripped: 3,
    attempts: 9,
    ...extra,
  };
};

async function toHall(page: Page, seed: SaveSeed, how: 'continue' | 'new' = 'continue') {
  await stage(page, saveData(seed));
  await game(page, (g: G, how) => (how === 'new' ? g.flow.newGame() : g.flow.continueGame()), how);
  await until(page, () => (window as G).__game.flow.state === 'hall');
}

async function toAltar(page: Page, id: MachineId, seed: SaveSeed) {
  await toHall(page, seed);
  await advance(page, 500);
  const ok = await game(page, (g: G, id) => g.flow.openPuzzle(id), id);
  expect(ok, `${id} opens`).toBe(true);
  await until(page, () => !!document.querySelector('.lr-altar'));
}

test.describe('title and hall', () => {
  // Shots land between lightning strikes: the title's first strike is at 2.2 s and the hall's at
  // 3 s, each over in ~1.1 s, and the next is at least 3 s later (art/hall/lightning.ts). A
  // frame of jitter during a flash would change the whole room's light.
  test('title', async ({ page }) => {
    await stage(page, saveData({ titleKnock: false }));
    await advance(page, 4300);
    await shot(page, 'title');
  });

  test('title (returning)', async ({ page }) => {
    await stage(page, saveData(midSeed()));
    await advance(page, 4300);
    await shot(page, 'title-continue');
  });

  test('hall, first visit', async ({ page }) => {
    await toHall(page, { titleKnock: false }, 'new');
    await advance(page, 5500);
    await shot(page, 'hall-first');
  });

  test('hall, mid-run', async ({ page }) => {
    await toHall(page, midSeed());
    await advance(page, 5500);
    await shot(page, 'hall-mid');
  });

  test('settings', async ({ page }) => {
    await toHall(page, midSeed());
    await advance(page, 1500);
    await key(page, 'KeyO');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await advance(page, 800);
    await shot(page, 'settings');
  });

  test('journal', async ({ page }) => {
    await toHall(page, midSeed());
    await advance(page, 1000);
    await game(page, (g: G) => g.flow.openJournal());
    await until(page, () => !!document.querySelector('.lr-journal'));
    await advance(page, 1500);
    await shot(page, 'journal');
  });

  test('codex', async ({ page }) => {
    await toHall(page, midSeed());
    await advance(page, 1500);
    await key(page, 'KeyC');
    await expect(page.getByRole('dialog', { name: 'Codex' })).toBeVisible();
    await advance(page, 800);
    await shot(page, 'codex');
  });
});

test.describe('altars', () => {
  for (const id of MACHINE_IDS) {
    test(`${id}, empty`, async ({ page }) => {
      await toAltar(page, id, { solved: solvedBefore(id), hallIntro: true });
      await advance(page, 2500);
      await shot(page, `altar-${id}-empty`);
    });

    test(`${id}, solved`, async ({ page }) => {
      const puzzles = { [id]: { placements: intended(id), attempts: 1 } };
      await toAltar(page, id, { solved: solvedBefore(id), hallIntro: true, puzzles });
      await advance(page, 2500);
      await shot(page, `altar-${id}-solved`);
    });
  }
});

test.describe('verdicts', () => {
  test('fail verdict', async ({ page }) => {
    await toAltar(page, 'intake-desk', { hallIntro: true });
    await advance(page, 1500);
    await key(page, 'KeyF');
    await until(page, () => {
      const v = document.querySelector<HTMLElement>('.lr-altar-verdict');
      return v && !v.hidden && v.dataset.outcome;
    });
    // To a fixed game time, not a fixed delay: which frame the verdict lands on still varies by
    // one or two, and the idle animations (FUSE, the source orb) follow game time.
    await advanceTo(page, 7);
    // Its own limit, 1%: at the same game time, frame and random draws, repeat runs still
    // differ by up to ~0.5% in the failed strike's smoke over the source and FUSE's idle pose.
    // The cause wasn't found. 1% still fails on a changed verdict box, board or layout.
    await shot(page, 'verdict-fail', 0.01);
  });

  test('solve card', async ({ page }) => {
    const id: MachineId = 'furnace';
    const puzzles = { [id]: { placements: intended(id), attempts: 0 } };
    await toAltar(page, id, { solved: solvedBefore(id), hallIntro: true, puzzles });
    await advance(page, 1500);
    await key(page, 'KeyF');
    await until(page, () => !!document.querySelector('.lr-solve-card'), 60_000);
    // Let the card play in fully; Enter would reveal it at once but also races the reveal.
    await advance(page, 6000);
    await shot(page, 'solve-card');
  });
});

test.describe('ending', () => {
  const toEnding = async (page: Page, replay: boolean) => {
    const solved = replay ? [...MACHINE_IDS] : MACHINE_IDS.filter((m) => m !== 'the-last-rune');
    await toHall(page, { solved, hallIntro: true, playSeconds: 5321, breakersTripped: 7 });
    const state = await game(page, (g: G) => {
      g.flow.openPuzzle('the-last-rune');
      g.flow.completePuzzle('the-last-rune');
      g.flow.finishSolve();
      return g.flow.state;
    });
    expect(state).toBe('ending');
  };

  test('ending, the hangout', async ({ page }) => {
    test.setTimeout(300_000);
    await toEnding(page, false);
    await until(
      page,
      () => {
        const posts = document.querySelectorAll('.lr-hg-msg[data-who="fuse"] .lr-hg-text');
        return posts[posts.length - 1]?.textContent?.trim() === 'Day 1.';
      },
      240_000,
      undefined,
      { stepMs: 250, settleMs: 5 },
    );
    await advance(page, 500);
    await shot(page, 'ending-hangout');
  });

  test('end card', async ({ page }) => {
    await toEnding(page, true);
    await advance(page, 500);
    await key(page, 'Escape');
    await until(page, () => {
      const a = document.querySelector<HTMLElement>('.lr-end-card a.lr-end-join');
      return a && a.offsetParent !== null;
    });
    await advance(page, 3000);
    await shot(page, 'end-card');
  });
});
