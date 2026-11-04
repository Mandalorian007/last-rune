import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The itch cover page (D-043 addendum 1, ws/cover-final): a separate build so the game's own
// bundle stays exactly as it was. Local only: `pnpm cover` builds it into build/cover-image/
// (ignored by version control, never in dist/ or on Pages) and saves the cover PNGs
// (scripts/cover/). Dev: `pnpm exec vite -c vite.cover.config.ts`.
const root = fileURLToPath(new URL('./games/last-rune/cover', import.meta.url));

export default defineConfig({
  root,
  base: './',
  publicDir: false,
  resolve: {
    alias: {
      '@game': fileURLToPath(new URL('./games/last-rune', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('./build/cover-image', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  },
});
