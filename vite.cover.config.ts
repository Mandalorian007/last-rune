import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The itch cover candidates page (D-043, ws/cover-art): a separate build so the game's own
// bundle stays exactly as it was. It lands in dist/cover-image/ after the game build
// (`pnpm build` runs both), so GitHub Pages serves it at /cover-image/. package-itch leaves it
// out of the itch zip. Dev: `pnpm exec vite -c vite.cover.config.ts`.
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
    outDir: fileURLToPath(new URL('./dist/cover-image', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  },
});
