import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// polish-1 captures: the altar key-hint line against FUSE's caption, and every overlay screen
// at each text size. Dev server (uses the DEV-only `window.__game` handle to jump to screens).
//   PLAYTEST_OUT=/tmp/pt-polish pnpm exec playwright test -c scripts/playtest/playwright.config.ts polish
// Writes <screen>-<viewport>-<scale>.png and polish.json: text boxes that overlap each other,
// clip, or leave the screen.

const ALTARS = process.env.PT_ALL
  ? [...MACHINE_IDS]
  : ['intake-desk', 'archive', 'control-booth', 'the-last-rune'];
const OUT = resolve(process.env.PLAYTEST_OUT ?? 'test-results/playtest-polish');
const SCALES = (process.env.PT_SCALES ?? '100,150').split(',').map(Number);
const VIEWPORTS = (process.env.PT_VIEWPORTS ?? '1280x720,1920x1080').split(',').map((v) => {
  const [width, height] = v.split('x').map(Number) as [number, number];
  return { width, height };
});

interface GameHandle {
  flow: {
    state: string;
    continueGame(): void;
    openPuzzle(id: string): boolean;
    closePuzzle(): void;
    completePuzzle(id: string): unknown;
    finishSolve(): void;
    openJournal?(): void;
  };
  fuse: { say(id: unknown, o?: unknown): unknown; hush(): void };
  openSettings?(): void;
  // biome-ignore lint/suspicious/noExplicitAny: seeding a save from the test side
  save: { update(fn: (d: any) => void): void };
  // biome-ignore lint/suspicious/noExplicitAny: settings from the test side
  settings: { set(p: any): void };
}

interface Problem {
  shot: string;
  kind: string;
  what: string;
}
const problems: Problem[] = [];

/** Text boxes that clip, leave the 16:9 frame, or overlap another text box. */
async function audit(page: Page, shot: string) {
  const found = await page.evaluate(() => {
    const out: { kind: string; what: string }[] = [];
    const root = document.querySelector<HTMLElement>('.tc-overlay')!.getBoundingClientRect();
    const name = (el: Element) =>
      `${el.className || el.tagName}`.toString().split(' ')[0] +
      `("${(el.textContent ?? '').trim().slice(0, 24)}")`;
    const vis = (el: HTMLElement) => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.1)
        return false;
      if (el.closest('[hidden]') || el.closest('[inert]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    const blocks = [
      '.lr-altar-hint',
      '.lr-altar-title',
      '.lr-altar-actions',
      '.lr-altar-count',
      '.lr-altar-need',
      '.lr-altar-verdict',
      '.lr-altar-tip',
      '.tc-caption',
      '.lr-hud',
      '.lr-nameplate',
      '.tc-panel',
      '.lr-solve',
    ];
    const els: HTMLElement[] = [];
    for (const sel of blocks) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) if (vis(el)) els.push(el);
    }
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (
        r.left < root.left - 1 ||
        r.right > root.right + 1 ||
        r.top < root.top - 1 ||
        r.bottom > root.bottom + 1
      ) {
        out.push({ kind: 'offscreen', what: name(el) });
      }
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!;
        const b = els[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 2 && oy > 2) out.push({ kind: 'overlap', what: `${name(a)} × ${name(b)}` });
      }
    }
    // Clipping: any element whose content is taller/wider than its box with overflow hidden.
    for (const el of document.querySelectorAll<HTMLElement>('.tc-overlay *')) {
      if (!vis(el)) continue;
      const s = getComputedStyle(el);
      const hides = /(hidden|clip|auto|scroll)/.test(s.overflow + s.overflowX + s.overflowY);
      if (!hides) continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        out.push({
          kind: /auto|scroll/.test(s.overflowY) ? 'scrolls' : 'clipped',
          what: `${name(el)} ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`,
        });
      }
    }
    return out;
  });
  for (const f of found) problems.push({ shot, ...f });
}

async function boot(page: Page, scale: number, solved: 'none' | 'most' | 'all') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: GameHandle }).__game?.flow.state === 'title',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ({ scale, solved, MACHINE_IDS }) => {
      const g = (window as unknown as { __game: GameHandle }).__game;
      g.save.update((d) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.journal.found = [1, 2, 3, 4, 5, 6];
        d.progress.solved =
          solved === 'none'
            ? []
            : solved === 'all'
              ? [...MACHINE_IDS]
              : MACHINE_IDS.filter((id) => id !== 'the-last-rune');
      });
      if (scale !== 100) g.settings.set({ textScale: scale });
      g.flow.continueGame();
    },
    { scale, solved, MACHINE_IDS: [...MACHINE_IDS] },
  );
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string) {
  await waitFrames(page, 8);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await audit(page, name);
}

test.setTimeout(240_000);

for (const vp of VIEWPORTS) {
  for (const scale of SCALES) {
    const tag = `${vp.width}-${scale}`;
    // Four altars per page load keeps each test short (a long headless WebGPU session can lose
    // its device and reload).
    for (let c = 0; c < ALTARS.length; c += 4) {
      test(`altar ${tag} ${c / 4 + 1}`, async ({ page }) => {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize(vp);
        await boot(page, scale, 'most');
        for (const id of ALTARS.slice(c, c + 4)) {
          await page.evaluate((id) => {
            const g = (window as unknown as { __game: GameHandle }).__game;
            g.flow.openPuzzle(id);
          }, id);
          await expect(page.locator('.lr-altar')).toBeVisible();
          await page.waitForTimeout(500);
          await shot(page, `altar-${id}-caption-${tag}`);
          // Keyboard: take a gem so the hint shows the keyboard line.
          await page.keyboard.press('Digit1');
          await page.waitForTimeout(200);
          await page.evaluate(() => {
            (window as unknown as { __game: GameHandle }).__game.fuse.hush();
          });
          await page.keyboard.press('Escape');
          await shot(page, `altar-${id}-nocaption-${tag}`);
          await page.keyboard.press('KeyF');
          await page.waitForTimeout(400);
          await shot(page, `altar-${id}-strike-${tag}`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);
          await shot(page, `altar-${id}-verdict-${tag}`);
          await page.evaluate(() => {
            (window as unknown as { __game: GameHandle }).__game.flow.closePuzzle();
          });
          await page.waitForTimeout(300);
        }
      });
    }

    test(`screens ${tag}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize(vp);
      await boot(page, scale, 'none');
      await shot(page, `hall-${tag}`);
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(500);
      await shot(page, `settings-${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('KeyC');
      await page.waitForTimeout(600);
      await shot(page, `codex-${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(1200);
      await shot(page, `journal-${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        g.flow.openPuzzle('intake-desk');
        g.flow.completePuzzle('intake-desk');
      });
      await page.waitForTimeout(3500);
      await shot(page, `solve-${tag}`);
    });

    test(`end card ${tag}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize(vp);
      await boot(page, scale, 'all');
      await page.evaluate(() => {
        const g = (window as unknown as { __game: GameHandle }).__game;
        g.flow.openPuzzle('the-last-rune');
        g.flow.completePuzzle('the-last-rune');
        g.flow.finishSolve();
      });
      await page.keyboard.press('Escape');
      await expect(page.locator('.lr-end-back')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await shot(page, `end-${tag}`);
    });
  }
}

test.afterAll(() => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'polish.json'), JSON.stringify(problems, null, 2));
});
