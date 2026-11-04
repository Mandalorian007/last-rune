import { expect, type Page, test } from '@playwright/test';
import { hallLines } from '../../games/last-rune/content/lines';
import { DEV_URL, waitFrames } from './helpers';

// mobile-3-chrome: the title, hall and menus at the four realistic phone viewports (D-040):
//  1. Control sizes: Play ≥140×48 and Settings ≥44 tall on the title; Full screen and the title
//     links ≥36 drawn; every ✕ ≥36 drawn with a ≥44 hit; Codex tabs ≥36; Settings rows ≥44 and
//     slider thumbs ≥20; Journal rows ≥36 with text ≥12; Journal page arrows ≥44.
//  2. Nothing is clipped: every control in Settings, the Codex and the Journal lies on screen
//     (Settings after scrolling its body into view).
//  3. The title art reaches the safe-area edges; the hall's art leaves at most slim side bars.
// mobile-4-chrome (gate review 1):
//  4. FUSE's welcome plays on a fresh save only, and its card keeps off the Start here door; a
//     save with progress but no welcome flag stays quiet.
//  5. Settings scrolls to its Save box (Reset included); the thumb shows while there is more.
//  6. No Codex page runs under the tabs or the ✕; the Journal's handwriting is ≥15 px with one
//     exit; with no Fullscreen API (iPhone Safari) there is no Full screen button.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

/**
 * The hall fills the width on every phone (mobile-5-chrome: the hall camera zooms out about the
 * doorway band and the wall widens, scenes/hall/hall-frame.ts): side bars at most 3% a side.
 */
const HALL_BAR = 0.03;

/** A wall alcove's drawn arch and sill around its centre, design px (the floor seal is round). */
const ARCH = { l: -100, r: 100, t: -118, b: 92 } as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(120_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  // Init scripts run before <html> exists, so apply on DOMContentLoaded (mobile-3-ending finding).
  await page.addInitScript((px) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.head.append(s);
    });
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

/** Screen (client px) of a hall world point under the scene's own camera (phones zoom it). */
const HALL_TO_SCREEN = `
  const st = window.__game.stack.top.state;
  const f = st.frame;
  const ov = document.querySelector('.tc-overlay:not([data-units="css"])').getBoundingClientRect();
  const k = ov.width / 1920;
  const sx = (x) => ov.left + (960 + (x - 960 - f.camX) * f.zoom) * k;
  const sy = (y) => ov.top + (540 + (y - 540 - f.camY) * f.zoom) * k;
`;

/**
 * Doorways (arch to sill) and the suggestion ring and tag that are not wholly on screen; the
 * tag and every door plate also keep 4 px inside the edges (mobile-5-chrome).
 */
function doorsOff(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ A, src }) => {
      const { st, sx, sy } = new Function(`${src} return { st, sx, sy };`)();
      const app = document.getElementById('app')!.getBoundingClientRect();
      const bad: string[] = [];
      const check = (name: string, l: number, t: number, r: number, b: number, pad = 0) => {
        if (
          l < app.left + pad - 1 ||
          r > app.right - pad + 1 ||
          t < app.top + pad - 1 ||
          b > app.bottom - pad + 1
        )
          bad.push(`${name} at ${l.toFixed(0)},${t.toFixed(0)}–${r.toFixed(0)},${b.toFixed(0)}`);
      };
      for (const d of st.model.alcoves) {
        const e = d.floor ? { l: -110, r: 110, t: -110, b: 110 } : A;
        check(`door ${d.id}`, sx(d.x + e.l), sy(d.y + e.t), sx(d.x + e.r), sy(d.y + e.b));
      }
      for (const sel of ['.lr-hall-next', '.lr-hall-next-tag', '.lr-door']) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          const name = `${sel} ${el.dataset.door ?? ''}`.trim();
          check(name, r.left, r.top, r.right, r.bottom, sel === '.lr-hall-next' ? 0 : 4);
        }
      }
      return bad;
    },
    { A: ARCH, src: HALL_TO_SCREEN },
  );
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
      await expect(page.locator('.tc-overlay:not([data-units="css"])')).toHaveAttribute(
        'data-phone',
        '',
      );
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
      // mobile-6-chrome: FUSE's card never covers the logo, nor the menu.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.fuse.hush();
        g.stack.top.chat?.();
      });
      await expect(
        page.locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]'),
      ).toBeVisible();
      await page.waitForTimeout(400);
      const cover = await page.evaluate(() => {
        const c = document
          .querySelector(
            '.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]',
          )!
          .getBoundingClientRect();
        const out: string[] = [];
        for (const sel of ['.lr-title', '.lr-title-menu']) {
          const r = document.querySelector(sel)!.getBoundingClientRect();
          if (c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom)
            out.push(`FUSE's card covers ${sel}`);
        }
        return out;
      });
      problems.push(...cover.map((s) => `title: ${s}`));
      await page.evaluate(() => (window as G).__game.fuse.hush());

      // Hall, first entry: a new game, nothing solved. The Intake Desk (the floor doorway) and its
      // "Start here" tag are whole on screen and FUSE points at it.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.flow.newGame();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await page.waitForTimeout(800);
      await waitFrames(page, 6);
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Start here/);
      problems.push(...(await doorsOff(page)).map((s) => `hall first entry: ${s}`));
      const start = (await page.locator('.lr-hall-next').boundingBox())!;
      const { cx, cy } = await page.evaluate((src) => {
        const { st, sx, sy } = new Function(`${src} return { st, sx, sy };`)();
        const desk = st.model.alcoves.find((a: G) => a.id === 'intake-desk');
        return { cx: sx(desk.x), cy: sy(desk.y) };
      }, HALL_TO_SCREEN);
      if (
        Math.abs(start.x + start.width / 2 - cx) > 2 ||
        start.y > cy ||
        start.y + start.height < cy
      )
        problems.push('hall first entry: the Start here ring is not on the Intake Desk');
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        g.flow.toTitle();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'title');

      // Hall, mid-game.
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
      problems.push(...(await doorsOff(page)).map((s) => `hall: ${s}`));

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
      // mobile-7-ending: the page arrows sit on the book's outer edges (the leaves span design
      // px 669..1835), not out at the screen edges.
      const turns = await page.evaluate(() => {
        const o = document
          .querySelector('.tc-overlay:not([data-units="css"])')!
          .getBoundingClientRect();
        const k = o.width / 1920;
        return [...document.querySelectorAll<HTMLElement>('.lr-j-turn')]
          .filter((b) => !b.hidden)
          .map((b) => {
            const r = b.getBoundingClientRect();
            const edge = o.left + (b.ariaLabel === 'Previous page' ? 669 : 1835) * k;
            return { label: b.ariaLabel, off: Math.abs((r.left + r.right) / 2 - edge) };
          });
      });
      for (const t of turns) {
        if (t.off > 6) problems.push(`journal: ${t.label} ${t.off.toFixed(0)} px off the book`);
      }
      problems.push(...small(await sizes(page, '.lr-j-x'), { w: 36, h: 36, hitW: 44, hitH: 44 }));
      problems.push(...(await offscreen(page, '.lr-journal')).map((s) => `journal: ${s}`));

      expect(problems).toEqual([]);
    });
  });
}

type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

for (const vp of PHONES) {
  test.describe(`phone chrome polish ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`welcome, Settings to Save, Codex, Journal and Full screen at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      await insets(page, vp.inset);
      // iPhone Safari: no element Fullscreen API.
      await page.addInitScript(() => {
        Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      });
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
      await waitFrames(page, 6);
      const problems: string[] = [];
      if (await page.locator('.lr-fullscreen').isVisible())
        problems.push('title: Full screen shows with no Fullscreen API');

      // A fresh save: the welcome plays and keeps off the Start here ring and tag.
      const welcome = hallLines('first-entry', 1)[0]!.text.slice(0, 24);
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.flow.newGame();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await expect(
        page.locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]'),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]'),
      ).toContainText(welcome);
      await waitFrames(page, 4);
      const cap = (await page
        .locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]')
        .boundingBox())!;
      for (const sel of ['.lr-hall-next', '.lr-hall-next-tag']) {
        const b = await page.locator(sel).boundingBox();
        if (b && meets(cap, b)) problems.push(`hall welcome: FUSE's card covers ${sel}`);
      }
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        g.flow.toTitle();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'title');

      // Progress but no welcome flag (an old or hand-made save): no welcome over a later door.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = false;
          d.progress.solved = ['intake-desk', 'furnace'];
          d.puzzles = {};
          d.journal.found = [1, 2, 3, 4];
          d.journal.read = [1, 2, 3];
        });
        g.flow.continueGame();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await page.waitForTimeout(600);
      const said = await page
        .locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]')
        .isVisible();
      if (
        said &&
        (
          (await page
            .locator('.tc-overlay:not([data-units="css"]) .tc-caption, .tc-caption[data-docked]')
            .textContent()) ?? ''
        ).includes(welcome)
      )
        problems.push('hall: the welcome played on a save with progress');
      await page.evaluate(() => (window as G).__game.fuse.hush());

      // Settings (mobile-6-chrome): two tabs, each a whole view; Reset is on "Graphics & Save".
      await page.evaluate(() => (window as G).__game.openSettings());
      await expect(page.locator('.lr-settings')).toBeVisible();
      await waitFrames(page, 4);
      const tabs6 = page.locator('.lr-settings-tab');
      await expect(tabs6).toHaveText(['Sound & Comfort', 'Graphics & Save']);
      await expect(tabs6.nth(0)).toHaveAttribute('aria-selected', 'true');
      await tabs6.nth(1).click();
      await expect(tabs6.nth(1)).toHaveAttribute('aria-selected', 'true');
      await waitFrames(page, 3);
      const save = await page.evaluate(() => {
        const cols = document.querySelector('.lr-settings-cols:not([hidden])')!;
        // Scroll the rest of the way by hand, as a thumb would.
        cols.scrollTop = cols.scrollHeight;
        const view = cols.getBoundingClientRect();
        const app = document.getElementById('app')!.getBoundingClientRect();
        const reset = [...document.querySelectorAll<HTMLElement>('.lr-settings button')].find((b) =>
          /reset/i.test(b.textContent ?? ''),
        )!;
        const r = reset.getBoundingClientRect();
        return {
          inView: r.top >= view.top - 1 && r.bottom <= view.bottom + 1,
          onScreen: r.top >= app.top - 1 && r.bottom <= app.bottom + 1,
        };
      });
      if (!save.inView || !save.onScreen)
        problems.push(`settings: the Save box's Reset is not reachable ${JSON.stringify(save)}`);
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Codex: every page's box keeps clear of the tabs and the ✕, on every tab.
      await page.evaluate(() => (window as G).__game.codex.open());
      await expect(page.locator('.lr-codex-nav')).toBeVisible();
      const tabs = await page.locator('.lr-codex-nav button').count();
      for (let i = 0; i < tabs; i++) {
        await page.locator('.lr-codex-nav button').nth(i).click();
        await waitFrames(page, 3);
        const hits = await page.evaluate(() => {
          const box = (e: Element) => e.getBoundingClientRect();
          const meet = (a: DOMRect, b: DOMRect) =>
            a.left < b.right - 0.5 &&
            b.left < a.right - 0.5 &&
            a.top < b.bottom - 0.5 &&
            b.top < a.bottom - 0.5;
          const nav = box(document.querySelector('.lr-codex-nav')!);
          const x = box(document.querySelector('.lr-codex-close')!);
          const out: string[] = [];
          for (const p of document.querySelectorAll('.lr-codex-page')) {
            const r = box(p);
            const name = p.querySelector('h3')?.textContent?.trim().slice(0, 20);
            if (meet(r, nav)) out.push(`page "${name}" runs under the tabs`);
            if (meet(r, x)) out.push(`page "${name}" runs under the ✕`);
            const cs = getComputedStyle(p);
            if (p.scrollHeight > p.clientHeight + 2 && !/auto|scroll/.test(cs.overflowY))
              out.push(`page "${name}" is cut and does not scroll`);
          }
          return out;
        });
        problems.push(...hits.map((s) => `codex tab ${i}: ${s}`));
      }
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Journal: the handwriting ≥15 px; the ✕ is the one exit; every page's words fit its two
      // leaves, at 100% and 150% text.
      await page.evaluate(() =>
        (window as G).__game.save.update((d: G) => {
          d.journal.found = Array.from({ length: 16 }, (_, i) => i + 1);
          d.journal.read = d.journal.found.slice();
        }),
      );
      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await expect(page.locator('.lr-journal')).toBeVisible();
      await page.waitForTimeout(400);
      const fonts = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.lr-j-body')]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
      );
      if (!fonts.length || fonts.some((f) => f < 15 - 0.05))
        problems.push(`journal: body text ${fonts.map((f) => f.toFixed(1))} px, want ≥15`);
      await expect(page.locator('.lr-j-x')).toBeVisible();
      if (await page.locator('.lr-j-back').isVisible())
        problems.push('journal: "Back to the hall" shows beside the ✕');
      // The arrows wrap, so sixteen turns visit every page once.
      const next = page.getByRole('button', { name: 'Next page' });
      const date = page.locator('.lr-j-date');
      for (const scale of [100, 150]) {
        await page.evaluate((scale) => {
          (window as G).__game.save.update((d: G) => {
            d.settings.textScale = scale;
          });
        }, scale);
        await waitFrames(page, 2);
        for (let n = 1; n <= 16; n++) {
          const over = await page.evaluate(() => {
            const b = document.querySelector<HTMLElement>('.lr-j-body')!;
            const cs = getComputedStyle(b);
            return {
              // A descender may dip a hair below the last rule.
              cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 4,
              lines: Number.parseFloat(cs.lineHeight) < Number.parseFloat(cs.fontSize),
            };
          });
          const day = (await date.textContent()) ?? '';
          if (over.cut) problems.push(`journal "${day}" at ${scale}%: the words overflow`);
          if (over.lines) problems.push(`journal "${day}" at ${scale}%: lines overlap`);
          await next.click();
          await expect(date).not.toHaveText(day);
          await page.waitForTimeout(300);
        }
      }

      expect(problems).toEqual([]);
    });
  });
}

/** Shown elements under `root` whose own text draws under `min` px on screen (client px). */
function tinyText(page: Page, root: string, min = 12): Promise<string[]> {
  return page.evaluate(
    ({ root, min }) => {
      const out: string[] = [];
      for (const host of document.querySelectorAll<HTMLElement>(root)) {
        for (const el of [host, ...host.querySelectorAll<HTMLElement>('*')]) {
          const own = [...el.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? '')
            .join('')
            .trim();
          if (!own || el.closest('[hidden], [aria-hidden="true"], svg, option')) continue;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (!r.width || !r.height || cs.visibility === 'hidden' || Number(cs.opacity) === 0)
            continue;
          // The overlay is scaled to the screen: measure the drawn size, not the design size.
          const k = el.offsetWidth ? r.width / el.offsetWidth : 1;
          const px = Number.parseFloat(cs.fontSize) * k;
          // A zero font is a deliberate textless mark (the journal's red "new" dot); the scale
          // rounds a 12 px design size to a hair under, hence the 0.2 px grace.
          if (px > 0 && px < min - 0.2) out.push(`"${own.slice(0, 24)}" ${px.toFixed(1)} px`);
        }
      }
      return out;
    },
    { root, min },
  );
}

// mobile-5-chrome (gate review 2): door plates, a full-width hall, the Settings fold, the SE
// Codex formula, a 12 px text floor on the chrome. (No hangout unread badge: mobile-ending.)
for (const vp of PHONES) {
  test.describe(`phone chrome plates and floors ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`door plates, Menu, Settings fold, Codex formula and text floors at ${vp.width}×${vp.height}`, async ({
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
      const problems: string[] = [];
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
          d.settings.captionSpeed = 'instant';
          d.progress.solved = ['intake-desk', 'furnace', 'splitter-mill'];
          d.puzzles = {};
          d.journal.found = [1, 2, 3, 4];
          d.journal.read = [1, 2, 3];
        });
        g.flow.continueGame();
        g.fuse.hush();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await page.waitForTimeout(600);
      await waitFrames(page, 6);

      // Every door has a plate: solved ones ✓ and named, open ones named, locked ones a lock and
      // their name. On screen 4 px in (doorsOff), none overlapping, and no pips (mobile-6-chrome).
      const plates = await page.evaluate(() => {
        const st = (window as G).__game.stack.top.state;
        const out: string[] = [];
        const boxes: [string, DOMRect][] = [];
        for (const a of st.model.alcoves) {
          const el = document.querySelector<HTMLElement>(`.lr-door[data-door="${a.id}"]`);
          if (!el?.getBoundingClientRect().width) {
            out.push(`${a.id}: no plate`);
            continue;
          }
          boxes.push([a.id, el.getBoundingClientRect()]);
          const text = el.textContent ?? '';
          if (a.status === 'locked') {
            if (!el.querySelector('svg')) out.push(`${a.id}: locked with no lock`);
            // mobile-6-chrome: a phone plate is the lock and the name; the tap card says
            // in plain words what opens it (no pips, no "+N").
            if (!text.includes(a.name)) out.push(`${a.id}: plate "${text}" lacks "${a.name}"`);
            if (el.querySelector('.lr-door-gem') || /\+\d/.test(text))
              out.push(`${a.id}: locked plate shows pips or a "+N"`);
          } else {
            if (!text.includes(a.name)) out.push(`${a.id}: plate "${text}" lacks "${a.name}"`);
            if (a.status === 'solved' && !el.querySelector('.lr-door-tick'))
              out.push(`${a.id}: solved with no ✓`);
          }
        }
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const [n, a] = boxes[i]!;
            const [m, b] = boxes[j]!;
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
              out.push(`plates ${n} and ${m} overlap`);
          }
        for (const g of document.querySelectorAll('.lr-door-gem')) {
          const r = g.getBoundingClientRect();
          if (r.width < 9.5 || r.height < 9.5)
            out.push(`a need pip is ${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
        }
        return out;
      });
      problems.push(...plates.map((s) => `hall: ${s}`));
      problems.push(...(await doorsOff(page)).map((s) => `hall: ${s}`));
      const hb = await bars(page);
      if (Math.max(hb.l, hb.r) > HALL_BAR * vp.width)
        problems.push(`hall art bars ${hb.l.toFixed(0)}/${hb.r.toFixed(0)} px`);
      await expect(page.locator('.lr-hud-menu-label')).toHaveText('Menu');
      await expect(page.locator('.lr-hud-menu-new')).toHaveText(/New page in journal/);
      problems.push(
        ...(await tinyText(page, '.lr-doors, .lr-hud-menu, .lr-hall-next-tag')).map(
          (s) => `hall text: ${s}`,
        ),
      );

      // A tap on a locked door gives its card (name, what it needs); the card goes when a panel
      // opens over the hall.
      const locked = await page.evaluate(() => {
        const st = (window as G).__game.stack.top.state;
        const a = st.model.alcoves.find((x: G) => x.status === 'locked');
        const f = st.frame;
        const ov = document
          .querySelector('.tc-overlay:not([data-units="css"])')!
          .getBoundingClientRect();
        const k = ov.width / 1920;
        return {
          name: a.name as string,
          x: ov.left + (960 + (a.x - 960 - f.camX) * f.zoom) * k,
          y: ov.top + (540 + (a.y - 540 - f.camY) * f.zoom) * k,
        };
      });
      await page.touchscreen.tap(locked.x, locked.y);
      await expect(page.locator('.lr-nameplate')).toBeVisible();
      await expect(page.locator('.lr-nameplate')).toContainText(locked.name);
      await expect(page.locator('.lr-nameplate')).toContainText(/Locked/);
      // The card never covers its own plate, and it closes when the Menu opens.
      const overPlate = await page.evaluate((name) => {
        const card = document.querySelector('.lr-nameplate')!.getBoundingClientRect();
        const plate = [...document.querySelectorAll<HTMLElement>('.lr-door')].find((d) =>
          (d.textContent ?? '').includes(name),
        );
        const r = plate?.getBoundingClientRect();
        return (
          !!r &&
          card.left < r.right &&
          r.left < card.right &&
          card.top < r.bottom &&
          r.top < card.bottom
        );
      }, locked.name);
      if (overPlate) problems.push('hall: the tap card covers its own plate');
      await page.locator('.lr-hud-menu').click();
      await expect(page.locator('.lr-nameplate')).toBeHidden();
      await page.locator('.lr-hud-menu').click();
      // A touch is a hover only when it moves, so tap a few px off the first spot.
      await page.touchscreen.tap(locked.x + 3, locked.y + 3);
      await expect(page.locator('.lr-nameplate')).toBeVisible();

      // Settings: no header or control is cut by the fold; the save box and Start over group.
      await page.evaluate(() => (window as G).__game.openSettings());
      await expect(page.locator('.lr-settings')).toBeVisible();
      await expect(page.locator('.lr-nameplate')).toBeHidden();
      await page.waitForTimeout(300);
      await waitFrames(page, 4);
      const cutAt = () =>
        page.evaluate(() => {
          const cols = document.querySelector<HTMLElement>('.lr-settings-cols:not([hidden])')!;
          const v = cols.getBoundingClientRect();
          const out: string[] = [];
          for (const e of cols.querySelectorAll<HTMLElement>('h3, .tc-field, .lr-choice')) {
            const r = e.getBoundingClientRect();
            if (r.top < v.bottom - 1 && r.bottom > v.bottom + 1)
              out.push(`"${(e.textContent ?? '').trim().slice(0, 20)}" is cut by the fold`);
          }
          return out;
        });
      const cut = await cutAt();
      await page.locator('.lr-settings-tab').nth(1).click();
      await waitFrames(page, 3);
      cut.push(...(await cutAt()));
      problems.push(...cut.map((s) => `settings: ${s}`));
      await expect(page.locator('.lr-save-box')).toContainText('Save code');
      await expect(page.locator('.lr-settings-danger')).toContainText('Start over');
      await expect(page.locator('.lr-settings .lr-seg button', { hasText: 'Auto' })).toHaveCount(2);
      problems.push(...(await tinyText(page, '.lr-settings-host')).map((s) => `settings: ${s}`));
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Codex: on every unlocked page the rule and its formula are wholly on screen, unscrolled.
      await page.evaluate(() => (window as G).__game.codex.open());
      await expect(page.locator('.lr-codex-nav')).toBeVisible();
      const tabs = await page.locator('.lr-codex-nav button').count();
      for (let i = 0; i < tabs; i++) {
        await page.locator('.lr-codex-nav button').nth(i).click();
        await waitFrames(page, 3);
        const miss = await page.evaluate(() => {
          const app = document.getElementById('app')!.getBoundingClientRect();
          const out: string[] = [];
          for (const p of document.querySelectorAll<HTMLElement>('.lr-codex-page')) {
            const pr = p.getBoundingClientRect();
            if (!pr.width) continue;
            const top = Math.max(pr.top, app.top);
            const bottom = Math.min(pr.bottom, app.bottom);
            for (const e of p.querySelectorAll<HTMLElement>('.lr-codex-rule, .lr-codex-maths')) {
              const r = e.getBoundingClientRect();
              if (r.top < top - 1 || r.bottom > bottom + 1 || r.right > app.right + 1)
                out.push(`${e.className} "${(e.textContent ?? '').trim().slice(0, 20)}" is cut`);
            }
          }
          return out;
        });
        problems.push(...miss.map((s) => `codex tab ${i}: ${s}`));
        problems.push(
          ...(await tinyText(page, '.lr-codex-nav, .lr-codex-page')).map(
            (s) => `codex tab ${i}: ${s}`,
          ),
        );
      }
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // Journal: the chrome (rows, counter, folio) is ≥12 px.
      await page.evaluate(() => (window as G).__game.flow.openJournal());
      await expect(page.locator('.lr-journal')).toBeVisible();
      await page.waitForTimeout(400);
      problems.push(...(await tinyText(page, '.lr-journal')).map((s) => `journal: ${s}`));

      expect(problems).toEqual([]);
    });
  });
}
