import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { GEM_WGSL } from '../../games/last-rune/shaders/gem-wgsl';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// glyph-truth-3 (D-027, D-040 addendum 9 d, blind review 8): a lit Bend read as a T on the
// Furnace's solve (iphone/20-solve). A Bend has two arms, so on the real solve, lit and under
// the solve bloom, each Bend's two dead sides must stay dark where its two live sides glow.

const ORDER = playOrder();

test.setTimeout(120_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.use({ viewport: { width: 915, height: 360 }, isMobile: true, hasTouch: true });

interface BendShot {
  cell: string;
  rot: number;
  /** Luma at 0.3 and 0.55 of the gem's radius out from its centre, per side (N, E, S, W). */
  near: number[];
  far: number[];
}

/** Every lit Bend on screen: the luma just past its turn and along each side. */
async function bendLumas(page: Page): Promise<BendShot[]> {
  const bends = await page.evaluate(() =>
    (window as G).__altarView.board
      .filter((b: G) => b.g.kind === 'bend' && b.g.state === 'energised')
      .map((b: G) => ({
        cell: `${b.cell.x},${b.cell.y}`,
        rot: ((Math.round(b.rotTarget) % 4) + 4) % 4,
        x: b.g.x,
        y: b.g.y,
        size: b.g.size,
      })),
  );
  const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const png = await page.screenshot();
  return page.evaluate(
    async ({ b64, bends, ob, vw }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const dpr = bmp.width / vw;
      const k = ob.width / 1920;
      const luma = (x: number, y: number) => {
        // Mean over a 3x3 CSS px patch.
        const px = Math.round(x * dpr);
        const py = Math.round(y * dpr);
        const r = Math.max(1, Math.round(1.5 * dpr));
        const d = ctx.getImageData(px - r, py - r, 2 * r + 1, 2 * r + 1).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4)
          s += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
        return s / (d.length / 4);
      };
      const DX = [0, 1, 0, -1];
      const DY = [-1, 0, 1, 0];
      return bends.map((b: G) => {
        const cx = ob.x + b.x * k;
        const cy = ob.y + b.y * k;
        const rad = (b.size * k) / 2;
        const at = (f: number) => DX.map((dx, d) => luma(cx + dx * rad * f, cy + DY[d]! * rad * f));
        return { cell: b.cell, rot: b.rot, near: at(0.3), far: at(0.55) };
      });
    },
    { b64: png.toString('base64'), bends, ob, vw: page.viewportSize()!.width },
  );
}

test('a lit Bend on the solve is two-armed: nothing glows on its dead sides', async ({ page }) => {
  const pz = puzzleFor('furnace');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ placements, solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { furnace: { attempts: 0, placements } };
      });
      g.flow.continueGame();
      g.flow.openPuzzle('furnace');
    },
    { placements: pz.design.intended, solved: ORDER.slice(0, ORDER.indexOf('furnace')) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 10);
  await page.evaluate(() => (window as G).__game.fuse.hush());
  await page.evaluate(() => (window as G).__game.flow.completePuzzle('furnace'));
  await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 20_000 });
  await waitFrames(page, 20);

  const shots = await bendLumas(page);
  // The Furnace's route turns four times, two of them as ┐ (west to south).
  expect(shots.length).toBeGreaterThanOrEqual(4);
  const problems: string[] = [];
  for (const s of shots) {
    const live = [s.rot, (s.rot + 1) & 3];
    const dead = [0, 1, 2, 3].filter((d) => !live.includes(d));
    const armLo = Math.min(...live.map((d) => s.far[d]!));
    for (const d of dead) {
      // Just past the turn and out along the dead side, the gem is its dark body, well below
      // either lit arm (a stub or a glowing elbow there is what read as a T).
      const near = s.near[d]!;
      const far = s.far[d]!;
      if (near > armLo * 0.75 || far > armLo * 0.6)
        problems.push(
          `${s.cell} rot ${s.rot}: side ${'NESW'[d]} ${near.toFixed(0)}/${far.toFixed(0)}, arms ${armLo.toFixed(0)}`,
        );
    }
  }
  expect(problems).toEqual([]);
});

test('the Bend glyph has no cross bar at either end', () => {
  const at = GEM_WGSL.indexOf('if (kind == 1)');
  const bend = GEM_WGSL.slice(at, GEM_WGSL.indexOf('if (kind == 2)', at));
  // Each end is plain: a door bar across an arm's end reads as a third arm (a T) when lit.
  expect(bend).not.toMatch(/-0\.16/);
});

// glyph-truth-3 (PM, polish-8 shots): on a phone the held tray slot's gold ring cut across the
// count of the gem above it, and a dark ↻ chip sat on the ring's corner. The held ring keeps
// clear of every other slot's count, and the gem in hand wears no chip (Turn names it).
test.describe('the held tray slot on a phone (SE)', () => {
  test.use({ viewport: { width: 667, height: 320 }, isMobile: true, hasTouch: true });
  for (const id of ['press-unit-4', 'furnace'] as const) {
    test(`${id}: the held ring clears every other count, no chip on the gem in hand`, async ({
      page,
    }) => {
      const pz = puzzleFor(id);
      const half = pz.design.intended.slice(0, Math.floor(pz.design.intended.length / 2));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(
        ({ id, placements, solved }) => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.flags.hallIntro = true;
            d.settings.captionSpeed = 'instant';
            d.progress.solved = solved;
            d.puzzles = { [id]: { attempts: 0, placements } };
          });
          g.flow.continueGame();
          g.flow.openPuzzle(id);
        },
        { id, placements: half, solved: ORDER.slice(0, ORDER.indexOf(id)) },
      );
      await expect(page.locator('.lr-altar')).toBeVisible();
      await page.waitForFunction(() => !!(window as G).__altarLayout);
      // Put the arrival card away.
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => (window as G).__game.fuse.hush());
        await waitFrames(page, 4);
        const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
        if (!(await next.isVisible())) break;
        await next.tap({ timeout: 2000 }).catch(() => {});
      }
      const L = await page.evaluate(() => (window as G).__altarLayout);
      const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
      const k = ob.width / 1920;
      const problems: string[] = [];
      for (const slot of L.tray as { gem: string; x: number; y: number }[]) {
        if (slot.gem === 'amplify') continue;
        await page.touchscreen.tap(ob.x + slot.x * k, ob.y + slot.y * k);
        const got = await page
          .waitForFunction((g) => (window as G).__altarView?.held?.kind === g, slot.gem, {
            timeout: 3000,
          })
          .then(() => true)
          .catch(() => false);
        if (!got) continue;
        await waitFrames(page, 4);
        const seen = await page.evaluate(() => {
          const ring = document.querySelector<HTMLElement>('.lr-altar-slot[data-held]');
          const rr = ring?.getBoundingClientRect();
          const counts = [
            ...document.querySelectorAll<HTMLElement>('.lr-altar-count:not([data-held])'),
          ].map((c) => {
            const r = c.getBoundingClientRect();
            return { l: r.left, r: r.right, t: r.top, b: r.bottom, text: c.textContent ?? '' };
          });
          const chip = document.querySelector<HTMLElement>('.lr-turn-target');
          return {
            ring: rr && { cx: rr.x + rr.width / 2, cy: rr.y + rr.height / 2, r: rr.width / 2 },
            counts,
            chip: !!chip?.checkVisibility(),
          };
        });
        if (!seen.ring) {
          problems.push(`${slot.gem}: no held ring`);
          continue;
        }
        // The ring's outer edge (2.5 px gold + 1.5 px dark outline) against each other count.
        const outer = seen.ring.r + 4;
        for (const c of seen.counts) {
          const dx = Math.max(c.l - seen.ring.cx, 0, seen.ring.cx - c.r);
          const dy = Math.max(c.t - seen.ring.cy, 0, seen.ring.cy - c.b);
          if (Math.hypot(dx, dy) < outer)
            problems.push(`${slot.gem}: held ring over the "${c.text}" count`);
        }
        if (seen.chip) problems.push(`${slot.gem}: a ↻ chip on the gem in hand`);
        // With SHOTS=<dir>, keep a look at each held slot (git-ignored, docs/design/screens/local).
        if (process.env.SHOTS)
          await page.screenshot({
            path: `docs/design/screens/local/${process.env.SHOTS}/se/12-${id}-held-${slot.gem}.png`,
          });
      }
      expect(problems).toEqual([]);
    });
  }
});
