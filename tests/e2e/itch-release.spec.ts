import { expect, type Frame, type Page, test } from '@playwright/test';
import { itchGameFrame, trackProblems, waitForBoot } from './helpers';
import { ITCH_SIM_URL } from './ports';

// The itch release checks from docs/shipping-itch.md §2 that smoke.spec.ts doesn't cover:
// audio starts after the first click inside the game, and progress survives a reload, in the
// built game inside itch-sim's cross-site iframe behind the "Run game" button.

/** Record every AudioContext the game makes, in every frame, so the test can read its state. */
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ctxs: AudioContext[]; AudioContext: typeof AudioContext };
    w.__ctxs = [];
    const Base = w.AudioContext;
    if (!Base) return;
    w.AudioContext = class extends Base {
      constructor(opts?: AudioContextOptions) {
        super(opts);
        w.__ctxs.push(this);
      }
    };
  });
}

const audioStates = (frame: Frame) =>
  frame.evaluate(() =>
    (window as unknown as { __ctxs: AudioContext[] }).__ctxs.map((c) => c.state),
  );

async function launch(page: Page): Promise<Frame> {
  await page.goto(ITCH_SIM_URL);
  await page.getByRole('button', { name: /Run game/ }).click();
  const frame = await itchGameFrame(page);
  await waitForBoot(frame);
  return frame;
}

test('itch-sim: audio starts on the first click, and progress survives a reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await watchAudio(page);

  let frame = await launch(page);
  const play = frame.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible({ timeout: 20_000 });

  // No sound before the player has touched the game (autoplay policy).
  expect(await audioStates(frame)).not.toContain('running');
  // The first click inside the game (Play) unlocks audio.
  await play.click();
  await expect.poll(() => audioStates(frame), { timeout: 10_000 }).toContain('running');

  // Into the hall: the run has started and the save is written.
  await expect
    .poll(
      () =>
        frame.evaluate(() =>
          Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? '').includes('"d"')),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.waitForTimeout(1500);

  // Reload the whole itch page and run the game again: the title offers Continue.
  await page.reload();
  frame = await launch(page);
  await expect(frame.getByRole('button', { name: 'Continue', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  expect(problems).toEqual([]);
});
