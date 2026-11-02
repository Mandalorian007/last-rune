import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// itch.io serves the zip from a nested CDN path inside an iframe:
// every asset URL must be relative (base: './').
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./engine', import.meta.url)),
      '@game': fileURLToPath(new URL('./games/last-rune', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  test: {
    include: [
      'engine/**/*.test.ts',
      'games/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
});
