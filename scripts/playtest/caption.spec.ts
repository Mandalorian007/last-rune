import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { cardsOf, LINES } from '../../games/last-rune/content/lines';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { altarDims, isRotational } from '../../games/last-rune/rules';
import {
  availableMachines,
  getMachine,
  initialState,
  type ProgressState,
  solveMachine,
} from '../../games/last-rune/rules/progression';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { deriveHall, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';
import { PREVIEW_URL, pressKey, SAVE_KEY, waitFrames } from '../../tests/e2e/helpers';

// FUSE caption layout captures (caption-layout workstream): hall first entry, the hall with a
// long line over the right-hand alcoves, settings opened over a line, and the archive solve
// card, at 960x540 and 1280x720. Each shot waits for the line to finish typing, and the run
// writes caption.json: the card's box against the alcoves, the dialog and its own text.
//   PLAYTEST_OUT=/tmp/pt-caption pnpm exec playwright test -c scripts/playtest/playwright.config.ts caption

const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-caption');

/** The hall's play order (front to back, first open machine), as in full-run.spec.ts. */
function playOrder(): MachineId[] {
  const order: MachineId[] = [];
  let state: ProgressState = initialState();
  for (;;) {
    const open = new Set(availableMachines(state).map((m) => m.id));
    const next = focusOrder(deriveHall(state)).find((id) => open.has(id));
    if (!next) return order;
    order.push(next);
    state = solveMachine(state, next);
  }
}
const ORDER = playOrder();
const BEFORE_ARCHIVE = ORDER.slice(0, ORDER.indexOf('archive'));

interface Measure {
  shot: string;
  caption: { x: number; y: number; w: number; h: number } | null;
  /** Text box taller than the card shows (clipped), in CSS px. */
  clipped: boolean;
  /** Caption painted over the open dialog. */
  overDialog: boolean;
  text: string;
}

const measures: Measure[] = [];

async function measure(page: Page, shot: string): Promise<Measure> {
  const m = await page.evaluate(() => {
    const cap = document.querySelector<HTMLElement>('.tc-caption');
    const shown = cap && !cap.hidden && getComputedStyle(cap).visibility !== 'hidden';
    const r = shown ? cap.getBoundingClientRect() : null;
    const text = cap?.querySelector<HTMLElement>('.tc-caption-text');
    const clipped =
      !!(shown && text) &&
      (text.getBoundingClientRect().bottom > r!.bottom + 1 ||
        text.scrollHeight > text.clientHeight + 2);
    // Inert layers aren't hit-testable, so compare layer order instead of elementFromPoint:
    // a visible card in a layer that follows the dialog's is painted over it.
    const dlg = document.querySelector('[role="dialog"]');
    const overDialog =
      !!(shown && dlg && cap) &&
      !!(dlg.compareDocumentPosition(cap) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      caption: r
        ? {
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
          }
        : null,
      clipped,
      overDialog,
      text: text?.textContent ?? '',
    };
  });
  return { shot, ...m };
}

/** Wait until FUSE's current card has finished typing. */
async function lineDone(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const cap = document.querySelector<HTMLElement>('.tc-caption');
          const pending = cap?.querySelector('.tc-caption-pending')?.textContent ?? '';
          return !!cap && !cap.hidden && pending === '';
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await waitFrames(page, 6);
}

async function snap(page: Page, tag: string, name: string) {
  const shot = `${name}-${tag}`;
  await page.screenshot({ path: join(OUT, `${shot}.png`) });
  measures.push(await measure(page, shot));
}

async function plateName(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.lr-nameplate');
    return el && !el.hidden ? (el.querySelector('span')?.textContent ?? '') : null;
  });
}

async function focus(page: Page, id: MachineId) {
  const name = getMachine(id).name;
  for (let i = 0; i < 40 && (await plateName(page)) !== name; i++) {
    await pressKey(page, 'ArrowRight');
  }
  expect(await plateName(page)).toBe(name);
}

/** Start a game, then rewrite the save's solved list and come back through Continue. */
async function seeded(page: Page, solved: MachineId[]) {
  await page.goto(PREVIEW_URL);
  await expect(page.locator('[data-action="play"], [data-action="continue"]')).toBeVisible();
  if (await page.locator('[data-action="play"]').isVisible()) {
    await waitFrames(page, 10);
    await pressKey(page, 'Enter');
    await expect(page.locator('.lr-hud')).toBeVisible();
  }
  // The game writes its in-memory save on unload, so seed the slot before the next load.
  const env = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY))!);
  env.d.progress.solved = solved;
  env.d.flags.hallIntro = true;
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem('pt-seeded')) return;
      sessionStorage.setItem('pt-seeded', '1');
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(env)] as const,
  );
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeVisible();
  await waitFrames(page, 10);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible();
  await waitFrames(page, 20);
}

async function buildSolution(page: Page, machine: MachineId) {
  const p = puzzleFor(machine);
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const rows = altarDims(p.altar).h;
  const cursor = { x: 0, y: Math.min(Math.max(0, p.storm.at.y), rows - 1) };
  for (const g of p.design.intended) {
    await pressKey(page, `Digit${tray.indexOf(g.gem) + 1}`);
    const dx = g.cell.x - cursor.x;
    const dy = g.cell.y - cursor.y;
    await pressKey(page, dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(dx));
    await pressKey(page, dy > 0 ? 'ArrowDown' : 'ArrowUp', Math.abs(dy));
    // R turns the gem under the cursor: the held gem, over the socket it will land in.
    if (isRotational(g.gem)) await pressKey(page, 'KeyR', g.rot);
    cursor.x = g.cell.x;
    cursor.y = g.cell.y;
    await pressKey(page, 'Enter');
  }
}

for (const [w, h] of [
  [960, 540],
  [1280, 720],
] as const) {
  const tag = `${w}`;
  test.describe(`caption at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
    test.afterAll(() => {
      writeFileSync(join(OUT, `caption-${tag}.json`), JSON.stringify(measures, null, 2));
    });

    test('hall', async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(PREVIEW_URL);
      await expect(page.locator('[data-action="play"]')).toBeVisible();
      await waitFrames(page, 10);
      await pressKey(page, 'Enter');
      await expect(page.locator('.lr-hud')).toBeVisible();
      await lineDone(page);
      await snap(page, tag, 'hall-first-entry');

      await seeded(page, BEFORE_ARCHIVE.slice(0, 5));
      // A line while an alcove on the right-hand wall has focus.
      await focus(page, 'boiler-room');
      await lineDone(page);
      await snap(page, tag, 'hall-caption-right');
      // The longest card in the game: the last rune's locked line.
      await focus(page, 'the-last-rune');
      await lineDone(page);
      await snap(page, tag, 'hall-caption-longest');
      // Every card in the game, laid into the live card: its tallest box in design px.
      const cards = LINES.flatMap((l) => cardsOf(l.text));
      const tallest = await page.evaluate((cards) => {
        const cap = document.querySelector<HTMLElement>('.tc-caption')!;
        const text = cap.querySelector<HTMLElement>('.tc-caption-text')!;
        const [shown, pending] = [...text.children] as HTMLElement[];
        const keep = [shown!.textContent, pending!.textContent];
        let worst = { h: 0, top: 1080, left: 1920, text: '' };
        for (const c of cards) {
          shown!.textContent = c;
          pending!.textContent = '';
          if (cap.offsetHeight > worst.h) {
            worst = { h: cap.offsetHeight, top: cap.offsetTop, left: cap.offsetLeft, text: c };
          }
        }
        [shown!.textContent, pending!.textContent] = keep;
        return worst;
      }, cards);
      writeFileSync(join(OUT, `tallest-${tag}.json`), JSON.stringify(tallest, null, 2));
      await pressKey(page, 'Escape');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await waitFrames(page, 20);
      await snap(page, tag, 'hall-settings-open');
      await pressKey(page, 'Escape');
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      await waitFrames(page, 10);
      await snap(page, tag, 'hall-settings-closed');
    });

    test('archive solve card', async ({ page }) => {
      test.setTimeout(180_000);
      await seeded(page, BEFORE_ARCHIVE);
      await focus(page, 'archive');
      await pressKey(page, 'Enter');
      await expect(page.locator('.lr-altar')).toBeVisible();
      await buildSolution(page, 'archive');
      await page.keyboard.press('KeyF', { delay: 50 });
      await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 60_000 });
      await lineDone(page);
      await snap(page, tag, 'archive-solve-card1');
      // The second card of the same line.
      await expect
        .poll(() => page.locator('.tc-caption-text').textContent(), { timeout: 20_000 })
        .toContain('Regulation 8');
      await lineDone(page);
      await snap(page, tag, 'archive-solve-card2');
    });
  });
}
