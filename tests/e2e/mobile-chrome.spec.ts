import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, waitFrames } from './helpers';

// mobile-3-chrome: the title, hall and menus at the four realistic phone viewports (D-040):
//  1. Control sizes: Play ≥140×48 and Settings ≥44 tall on the title; Full screen and the title
//     links ≥36 drawn; every ✕ ≥36 drawn with a ≥44 hit; Codex tabs ≥36; Settings rows ≥44 and
//     slider thumbs ≥20; Journal rows ≥36 with text ≥12; Journal page arrows ≥44.
//  2. Nothing is clipped: every control in Settings, the Codex and the Journal lies on screen
//     (Settings after scrolling its body into view).
//  3. The title art reaches the safe-area edges; the hall's art leaves at most slim side bars.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

/**
 * The hall keeps every doorway whole (FILL_BANDS minVisible 880), so the widest phones (Android
 * 20:9) keep slim, soft-edged side bars: at most this share of the width each side.
 */
const HALL_BAR = 0.08;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(120_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    document.documentElement.style.setProperty('--lr-safe-l', `${px}px`);
    document.documentElement.style.setProperty('--lr-safe-r', `${px}px`);
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

type Size = { sel: string; w: number; h: number; hitW: number; hitH: number; font: number };

/** Drawn size, hit size (the phone `::before` target) and font size of each shown match. */
function sizes(page: Page, sel: string): Promise<Size[]> {
  return page.evaluate((sel) => {
    const out: Size[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0) continue;
      const b = getComputedStyle(el, '::before');
      const bw = b.content !== 'none' && b.position === 'absolute' ? Number.parseFloat(b.width) : 0;
      const bh =
        b.content !== 'none' && b.position === 'absolute' ? Number.parseFloat(b.height) : 0;
      out.push({
        sel: `${sel} "${(el.textContent ?? '').trim().slice(0, 24)}"`,
        w: r.width,
        h: r.height,
        hitW: Math.max(r.width, bw || 0),
        hitH: Math.max(r.height, bh || 0),
        font: Number.parseFloat(cs.fontSize),
      });
    }
    return out;
  }, sel);
}

/** Controls under `root` that are not wholly inside the app's box (client px). */
function offscreen(page: Page, root: string, scrollIn = false): Promise<string[]> {
  return page.evaluate(
    ({ root, scrollIn }) => {
      const app = document.getElementById('app')!.getBoundingClientRect();
      const bad: string[] = [];
      const els = document.querySelectorAll<HTMLElement>(
        `${root} :is(button, input, select, textarea, a[href], .tc-field, .lr-choice, h2, h3, .lr-j-slip, .lr-j-more)`,
      );
      for (const el of els) {
        if (el.closest('[hidden]')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.closest('.lr-choice') && el.matches('.lr-choice select, .lr-choice label *'))
          continue;
        if (scrollIn) el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (
          r.left < app.left - 1 ||
          r.right > app.right + 1 ||
          r.top < app.top - 1 ||
          r.bottom > app.bottom + 1
        ) {
          bad.push(
            `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? '').trim().slice(0, 20)}" at ${r.left.toFixed(0)},${r.top.toFixed(0)}–${r.right.toFixed(0)},${r.bottom.toFixed(0)}`,
          );
        }
      }
      return bad;
    },
    { root, scrollIn },
  );
}

/** How far the canvas falls short of the app's left and right edges (client px). */
function bars(page: Page) {
  return page.evaluate(() => {
    const app = document.getElementById('app')!.getBoundingClientRect();
    const c = document.querySelector('#app canvas')!.getBoundingClientRect();
    return { l: Math.max(0, c.left - app.left), r: Math.max(0, app.right - c.right) };
  });
}

function small(
  list: Size[],
  min: { w?: number; h?: number; hitW?: number; hitH?: number; font?: number },
) {
  if (!list.length) return ['a checked control is not shown'];
  return list
    .filter(
      (s) =>
        (min.w !== undefined && s.w < min.w - 0.5) ||
        (min.h !== undefined && s.h < min.h - 0.5) ||
        (min.hitW !== undefined && s.hitW < min.hitW - 0.5) ||
        (min.hitH !== undefined && s.hitH < min.hitH - 0.5) ||
        (min.font !== undefined && s.font < min.font - 0.05),
    )
    .map(
      (s) =>
        `${s.sel}: ${s.w.toFixed(1)}×${s.h.toFixed(1)} (hit ${s.hitW.toFixed(0)}×${s.hitH.toFixed(0)}, font ${s.font.toFixed(1)}) < ${JSON.stringify(min)}`,
    );
}

for (const vp of PHONES) {
  test.describe(`phone chrome ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`title, hall, Settings, Codex and Journal meet D-040 at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      await insets(page, vp.inset);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(DEV_URL);
      await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
        timeout: 30_000,
      });
      await page.evaluate(() =>
        document.dispatchEvent(
          new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
        ),
      );
      await expect(page.locator('.tc-overlay')).toHaveAttribute('data-phone', '');
      await waitFrames(page, 6);
      const problems: string[] = [];

      // Title.
      problems.push(
        ...small(await sizes(page, '.lr-title-menu .lr-gold-button'), { w: 140, h: 48 }),
      );
      problems.push(...small(await sizes(page, '.lr-title-menu .lr-stone-button'), { h: 44 }));
      problems.push(
        ...small(await sizes(page, '.lr-fullscreen, .lr-title-links a, .lr-title-links button'), {
          h: 36,
          hitH: 44,
        }),
      );
      problems.push(...(await offscreen(page, '.lr-title-menu')).map((s) => `title: ${s}`));
      const tb = await bars(page);
      if (tb.l > 4 || tb.r > 4)
        problems.push(`title art bars ${tb.l.toFixed(0)}/${tb.r.toFixed(0)} px`);

      // Hall.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.progress.solved = ['intake-desk'];
          d.puzzles = {};
          d.journal.found = [1, 2, 3, 4];
          d.journal.read = [1, 2, 3];
        });
        g.flow.continueGame();
        g.fuse.hush();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await waitFrames(page, 6);
      const hb = await bars(page);
      if (Math.max(hb.l, hb.r) > HALL_BAR * vp.width)
        problems.push(`hall art bars ${hb.l.toFixed(0)}/${hb.r.toFixed(0)} px`);
      await expect(page.locator('.lr-hall-next')).toBeVisible();
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Next/);
      const tag = await page.locator('.lr-hall-next-tag').boundingBox();
      const app = (await page.locator('#app').boundingBox())!;
      if (!tag || tag.y < app.y - 1) problems.push('hall: the Next tag is cut off');

      // Settings.
      await page.evaluate(() => (window as G).__game.openSettings());
      await expect(page.locator('.lr-settings')).toBeVisible();
      await waitFrames(page, 4);
      // The panel body takes focus (so Tab starts inside it) but draws no ring.
      const focused = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        return cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) > 0
          ? `${a.tagName}.${a.className} outline ${cs.outlineStyle} ${cs.outlineWidth}`
          : null;
      });
      if (focused) problems.push(`settings: a focus ring shows on first open (${focused})`);
      problems.push(
        ...small(await sizes(page, '.lr-settings .tc-field, .lr-settings .lr-choice'), { h: 44 }),
      );
      problems.push(
        ...small(await sizes(page, '.lr-settings .lr-seg button'), { h: 30, hitH: 44 }),
      );
      problems.push(
        ...small(await sizes(page, '.lr-settings-host .lr-panel-x'), {
          w: 36,
          h: 36,
          hitW: 44,
          hitH: 44,
        }),
      );
      const thumbs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLInputElement>('.lr-settings input[type="range"]')].map(
          (el) => el.getBoundingClientRect().height,
        ),
      );
      if (!thumbs.length || thumbs.some((h) => h < 20))
        problems.push(`settings: slider heights ${thumbs}`);
      const reset = await page.evaluate(() => {
        const r = [...document.querySelectorAll('.lr-settings button')].find((b) =>
          /reset/i.test(b.textContent ?? ''),
        );
        return r
          ? {
              danger: r.classList.contains('lr-danger'),
              alone: !r.parentElement?.querySelector('button:not(.lr-danger)'),
            }
          : null;
      });
      if (!reset?.danger || !reset.alone) problems.push(`settings: Reset ${JSON.stringify(reset)}`);
      problems.push(
        ...(await offscreen(page, '.lr-settings-host', true)).map((s) => `settings: ${s}`),
      );
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Codex.
      await page.evaluate(() => (window as G).__game.codex.open());
      await expect(page.locator('.lr-codex-nav')).toBeVisible();
      await waitFrames(page, 4);
      await expect(page.locator('.lr-hud-menu')).toBeHidden();
      problems.push(...small(await sizes(page, '.lr-codex-nav button'), { h: 36, hitH: 44 }));
      problems.push(
        ...small(await sizes(page, '.lr-codex-close'), { w: 36, h: 36, hitW: 44, hitH: 44 }),
      );
      problems.push(...(await offscreen(page, '.tc-panel-host')).map((s) => `codex: ${s}`));
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Journal.
      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await expect(page.locator('.lr-journal')).toBeVisible();
      await page.waitForTimeout(400);
      await waitFrames(page, 4);
      const rows = await sizes(page, '.lr-j-slip:not([data-blank])');
      if (rows.length !== 4) problems.push(`journal: ${rows.length} page rows, want 4`);
      problems.push(...small(rows, { h: 36, font: 12 }));
      await expect(page.locator('.lr-j-more')).toHaveText(/12 more pages to find/);
      problems.push(...small(await sizes(page, '.lr-j-more'), { h: 36, font: 12 }));
      problems.push(...small(await sizes(page, '.lr-j-turn'), { w: 44, h: 44 }));
      problems.push(...small(await sizes(page, '.lr-j-x'), { w: 36, h: 36, hitW: 44, hitH: 44 }));
      problems.push(...(await offscreen(page, '.lr-journal')).map((s) => `journal: ${s}`));

      expect(problems).toEqual([]);
    });
  });
}
