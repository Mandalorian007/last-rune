import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The social card page (D-050): a separate build so the game's own bundle stays exactly as it
// was. Local only: `pnpm social` builds it into build/cover-image/ (ignored by git) and saves
// public/social.jpg and public/apple-touch-icon.png (scripts/cover/), which are committed and
// ship with the Pages build. Dev: `pnpm exec vite -c vite.cover.config.ts`.
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
